import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { EndpointContext, TMFEndpoint } from '../../types/TMFTypes';
import { documentationService } from '../../services/DocumentationService';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EndpointSummary {
  path: string;
  method: string;
  description?: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
  }>;
}

function summarizeEndpoint(endpoint: any): EndpointSummary {
  return {
    path: endpoint.path,
    method: endpoint.method,
    description: endpoint.description,
    fields: (endpoint.fields || []).map((field: any) => ({
      name: field.name,
      type: field.type,
      required: field.required || false
    }))
  };
}

function filterRelevantEndpoints(endpoints: any[], tmfEndpoint: TMFEndpoint): any[] {
  // Basic filtering to reduce the number of endpoints
  return endpoints.filter(endpoint => {
    // Validate endpoint has required properties
    if (!endpoint || typeof endpoint !== 'object') {
      console.log('[find-documentation-matches] Invalid endpoint:', endpoint);
      return false;
    }

    if (!endpoint.method || !endpoint.path) {
      console.log('[find-documentation-matches] Endpoint missing required fields:', endpoint);
      return false;
    }

    // Keep endpoints with similar HTTP methods
    const methodMatch = endpoint.method.toLowerCase() === tmfEndpoint.method.toLowerCase();
    
    // Keep endpoints with similar path segments
    const tmfPathParts = tmfEndpoint.path.toLowerCase().split('/').filter(Boolean);
    const endpointPathParts = endpoint.path.toLowerCase().split('/').filter(Boolean);
    const pathSimilarity = tmfPathParts.some((part: string) => 
      endpointPathParts.some((endpointPart: string) => 
        endpointPart.includes(part) || part.includes(endpointPart)
      )
    );

    return methodMatch || pathSimilarity;
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { context, docId, tmfEndpoint } = req.body;
    const endpointContext = context as EndpointContext;

    // Fetch documentation content
    const documentationContent = await documentationService.getDocumentationById(docId);

    // Validate documentation content
    if (!documentationContent || !Array.isArray(documentationContent.endpoints)) {
      console.error('[find-documentation-matches] Invalid documentation content:', documentationContent);
      throw new Error('Invalid documentation content');
    }

    // Filter relevant endpoints to reduce token usage
    const relevantEndpoints = filterRelevantEndpoints(
      documentationContent.endpoints,
      tmfEndpoint
    ).slice(0, 10); // Limit to top 10 most relevant endpoints

    // If no relevant endpoints found, return empty result
    if (relevantEndpoints.length === 0) {
      return res.status(200).json({
        matches: [],
        confidence: 0,
        reasoning: 'No relevant endpoints found in documentation'
      });
    }

    // Create a summarized version of the documentation
    const summarizedDoc = {
      endpoints: relevantEndpoints.map(summarizeEndpoint)
    };

    const prompt = `Compare this TMF endpoint:
Path: ${tmfEndpoint.path}
Method: ${tmfEndpoint.method}
Purpose: ${endpointContext.semanticProfile?.purpose || 'Not specified'}
Domain: ${endpointContext.semanticProfile?.domain || 'Not specified'}
Key Terms: ${endpointContext.alternativeTerms?.join(', ') || 'None'}
Use Cases: ${endpointContext.useCases?.join(', ') || 'None'}

With these API endpoints:
${JSON.stringify(summarizedDoc.endpoints.map(e => ({
  path: e.path,
  method: e.method,
  description: e.description,
  fieldCount: e.fields.length,
  requiredFields: e.fields.filter(f => f.required).map(f => f.name)
})), null, 2)}

Find the best matches considering:
1. Path and method similarity
2. Field compatibility
3. Business purpose alignment
4. Use case overlap

Return ONLY a JSON object with:
{
  "matches": [
    {
      "path": "string",
      "method": "string",
      "confidence": number (0-100),
      "matchedTerms": string[],
      "reasoning": "string"
    }
  ],
  "confidence": number (0-100),
  "reasoning": "string"
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a precise API endpoint matching system. Respond with ONLY the requested JSON format.'
          },
          { 
            role: 'user',
            content: prompt 
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 2000
      });

      const matches = JSON.parse(completion.choices[0].message?.content || '{}');
      res.status(200).json(matches);
    } catch (error: any) {
      if (error?.error?.code === 'context_length_exceeded') {
        // If we still hit token limits, try with even fewer endpoints
        const reducedEndpoints = relevantEndpoints.slice(0, 5);
        const reducedDoc = {
          endpoints: reducedEndpoints.map(summarizeEndpoint)
        };

        // Create a more concise prompt
        const reducedPrompt = `Match TMF endpoint (${tmfEndpoint.method} ${tmfEndpoint.path}) with these endpoints:
${JSON.stringify(reducedDoc.endpoints.map(e => ({
  path: e.path,
  method: e.method,
  fields: e.fields.length
})), null, 2)}

Return ONLY: {"matches":[{"path":string,"method":string,"confidence":number,"matchedTerms":string[],"reasoning":string}],"confidence":number,"reasoning":string}`;

        const fallbackCompletion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a precise API endpoint matching system. Respond with ONLY the requested JSON format.'
            },
            { 
              role: 'user',
              content: reducedPrompt 
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        });

        const fallbackMatches = JSON.parse(fallbackCompletion.choices[0].message?.content || '{}');
        res.status(200).json(fallbackMatches);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error in find-documentation-matches:', error);
    res.status(500).json({ error: 'Failed to find documentation matches' });
  }
} 