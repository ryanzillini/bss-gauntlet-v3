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
      // Log API key presence (but not the actual key)
      console.log('[find-documentation-matches] Claude API key present:', !!process.env.ANTHROPIC_API_KEY);
      
      const requestBody = JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 8000,
        temperature: 0.3,
        system: 'You are a precise API endpoint matching system. Respond with ONLY the requested JSON format.',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: requestBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[find-documentation-matches] Claude API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to get response from Claude API: ${response.status} ${response.statusText}`);
      }

      const completion = await response.json();
      console.log('[find-documentation-matches] Claude API response structure:', 
        JSON.stringify(Object.keys(completion), null, 2)
      );

      // Claude API returns a different structure than OpenAI
      // Check if we're getting the expected response format
      if (completion.content && Array.isArray(completion.content)) {
        const contentBlocks = completion.content;
        const textContent = contentBlocks
          .filter((block: { type: string }) => block.type === 'text')
          .map((block: { text: string }) => block.text)
          .join('');
          
        try {
          const matches = JSON.parse(textContent || '{}');
          res.status(200).json(matches);
        } catch (parseError) {
          console.error('[find-documentation-matches] Error parsing Claude response as JSON:', textContent);
          throw new Error('Invalid response format from Claude API');
        }
      } else if (completion.choices && completion.choices[0]?.message?.content) {
        // Handle OpenAI-like format (legacy code)
        const matches = JSON.parse(completion.choices[0].message.content || '{}');
        res.status(200).json(matches);
      } else {
        console.error('[find-documentation-matches] Unexpected Claude response format:', completion);
        throw new Error('Unexpected response format from Claude API');
      }
    } catch (error: any) {
      if (error?.error?.code === 'context_length_exceeded' || 
          (error.message && error.message.includes('529')) ||
          (error.message && error.message.includes('overloaded'))) {
        
        console.log('[find-documentation-matches] Claude API overloaded or token limit exceeded, using simplified fallback');
        
        try {
          // If Claude is overloaded, try with even fewer endpoints
          const reducedEndpoints = relevantEndpoints.slice(0, 3);
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

          const fallbackResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY || '',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-7-sonnet-20250219',
              max_tokens: 4000, // Reduced token count to lessen load
              temperature: 0.3,
              system: 'You are a precise API endpoint matching system. Respond with ONLY the requested JSON format.',
              messages: [
                {
                  role: 'user',
                  content: reducedPrompt
                }
              ]
            })
          });

          if (!fallbackResponse.ok) {
            throw new Error(`Fallback Claude API also failed: ${fallbackResponse.status}`);
          }

          const fallbackCompletion = await fallbackResponse.json();
          let fallbackMatches;
          
          if (fallbackCompletion.content && Array.isArray(fallbackCompletion.content)) {
            const contentBlocks = fallbackCompletion.content;
            const textContent = contentBlocks
              .filter((block: { type: string }) => block.type === 'text')
              .map((block: { text: string }) => block.text)
              .join('');
              
            fallbackMatches = JSON.parse(textContent || '{}');
          } else if (fallbackCompletion.choices && fallbackCompletion.choices[0]?.message?.content) {
            fallbackMatches = JSON.parse(fallbackCompletion.choices[0].message.content || '{}');
          } else {
            throw new Error('Unexpected response format from fallback Claude API');
          }
          
          res.status(200).json(fallbackMatches);
        } catch (fallbackError) {
          console.error('[find-documentation-matches] Fallback also failed:', fallbackError);
          
          // If both LLM approaches fail, use rule-based matching
          const ruleBasedMatches = {
            matches: relevantEndpoints.slice(0, 3).map(endpoint => {
              // Basic string similarity for path components
              const tmfPathParts = tmfEndpoint.path.toLowerCase().split('/').filter(Boolean);
              const endpointPathParts = endpoint.path.toLowerCase().split('/').filter(Boolean);
              
              // Count matching path segments
              const matchingSegments = tmfPathParts.filter((part: string) => 
                endpointPathParts.some((endpointPart: string) => 
                  endpointPart.includes(part) || part.includes(endpointPart)
                )
              ).length;
              
              // Calculate a simple confidence score
              const methodMatch = endpoint.method.toLowerCase() === tmfEndpoint.method.toLowerCase() ? 40 : 0;
              const pathScore = matchingSegments / Math.max(tmfPathParts.length, endpointPathParts.length) * 60;
              const confidence = Math.min(Math.round(methodMatch + pathScore), 100);
              
              return {
                path: endpoint.path,
                method: endpoint.method,
                confidence: confidence,
                matchedTerms: [],
                reasoning: `Simple rule-based matching found ${matchingSegments} matching path segments and ${methodMatch > 0 ? 'matching' : 'different'} HTTP method.`
              };
            }),
            confidence: 40, // Lower confidence for rule-based matching
            reasoning: "AI services unavailable. Used rule-based matching with path similarity and HTTP method matching."
          };
          
          res.status(200).json(ruleBasedMatches);
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error in find-documentation-matches:', error);
    res.status(500).json({ error: 'Failed to find documentation matches' });
  }
} 