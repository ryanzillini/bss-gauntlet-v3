import { ApiMapping } from '../types';
import { OpenAI } from 'openai';

export class DocumentationMappingService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeDocumentationWithPreprocessed(
    endpoint: {
      path: string;
      method: string;
      specification: string;
    },
    preprocessedDoc: {
      endpoints: any[];
    }
  ): Promise<ApiMapping[]> {
    try {
      console.log('[DocumentationMappingService] Starting documentation analysis with preprocessed data');

      // Prepare the prompt for the OpenAI API
      const prompt = this.buildAnalysisPrompt(endpoint, preprocessedDoc);

      // Call OpenAI API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 4000,
          messages: [
            {
              role: 'system', 
              content: 'You are an API mapping expert. Your task is to analyze an endpoint and find matching endpoints in the documentation, then create field mappings between them.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Claude API');
      }

      const completion = await response.json();
      const responseContent = completion.content[0]?.text;

      if (!responseContent) {
        throw new Error('No response content from Claude API');
      }

      try {
        const mappings = JSON.parse(responseContent);
        return this.validateAndTransformMappings(mappings);
      } catch (error) {
        console.error('[DocumentationMappingService] Error parsing Claude response:', error);
        throw new Error('Failed to parse mapping suggestions');
      }

    } catch (error) {
      console.error('[DocumentationMappingService] Error in analyzeDocumentation:', error);
      throw error;
    }
  }

  private buildAnalysisPrompt(
    endpoint: {
      path: string;
      method: string;
      specification: string;
    },
    preprocessedDoc: {
      endpoints: any[];
    }
  ): string {
    // Prescreen endpoints by matching HTTP method
    const endpointMethod = endpoint.method.trim().toUpperCase();
    let filteredEndpoints = preprocessedDoc.endpoints;
    
    // Apply method filtering
    const methodMatchedEndpoints = preprocessedDoc.endpoints.filter((docEndpoint: any) => {
      const docMethod = (docEndpoint.method || '').trim().toUpperCase();
      return docMethod === endpointMethod;
    });
    
    // Use method-matched endpoints if available, otherwise use all endpoints
    if (methodMatchedEndpoints.length > 0) {
      console.log(`[DocumentationMappingService] Filtered to ${methodMatchedEndpoints.length} endpoints with method ${endpointMethod}`);
      filteredEndpoints = methodMatchedEndpoints;
    } else {
      console.log(`[DocumentationMappingService] No endpoints match method ${endpointMethod}, using all endpoints`);
    }
    
    return `
Analyze this endpoint and find matching endpoints in the documentation:

Source Endpoint:
Path: ${endpoint.path}
Method: ${endpoint.method}
Specification: ${JSON.stringify(endpoint.specification, null, 2)}

Available Documentation Endpoints:
${JSON.stringify(filteredEndpoints, null, 2)}

Create a mapping that includes:
1. The most similar endpoint from the documentation
2. Field mappings between the source and target endpoints
3. Any necessary transformations
4. Confidence score and reasoning

Return the result as a JSON array of mappings with this structure:
{
  "confidenceScore": number,
  "reasoning": "string",
  "steps": [
    {
      "endpoint": {
        "path": "string",
        "method": "string",
        "description": "string",
        "parameters": [],
        "responses": {},
        "matchReason": "string",
        "confidenceScore": number
      },
      "outputFields": [
        {
          "source": "string",
          "target": "string",
          "transform": "string"
        }
      ]
    }
  ]
}`;
  }

  private validateAndTransformMappings(mappings: any): ApiMapping[] {
    if (!Array.isArray(mappings)) {
      throw new Error('Invalid mapping format: expected an array');
    }

    return mappings.map((mapping, index) => {
      if (!mapping.confidenceScore || !mapping.steps || !Array.isArray(mapping.steps)) {
        throw new Error(`Invalid mapping at index ${index}: missing required fields`);
      }

      return {
        confidenceScore: mapping.confidenceScore,
        reasoning: mapping.reasoning || '',
        steps: mapping.steps.map((step: any) => ({
          endpoint: {
            path: step.endpoint.path,
            method: step.endpoint.method,
            description: step.endpoint.description || '',
            parameters: step.endpoint.parameters || [],
            responses: step.endpoint.responses || {},
            matchReason: step.endpoint.matchReason || '',
            confidenceScore: step.endpoint.confidenceScore || 0
          },
          outputFields: step.outputFields.map((field: any) => ({
            source: field.source,
            target: field.target,
            transform: field.transform || 'direct'
          }))
        }))
      };
    });
  }
} 