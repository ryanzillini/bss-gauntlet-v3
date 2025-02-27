import { OpenAI } from 'openai';

export interface TMFEndpointContext {
  semanticDescription: string;
  suggestedMappingApproach: string;
  identifiedPatterns: string[];
  confidenceScore: number;
}

export class ContextAnalysisService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeTMFEndpoint(endpoint: {
    path: string;
    method: string;
    specification: {
      name: string;
      description: string;
      fields: Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
      }>;
      category: string;
    };
  }): Promise<TMFEndpointContext> {
    try {
      console.log('[ContextAnalysisService] Starting TMF endpoint analysis');

      const prompt = this.buildAnalysisPrompt(endpoint);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 100000,
          messages: [
            {
              role: 'system',
              content: 'You are an API analysis expert specializing in TMF APIs. Your task is to analyze the endpoint and provide semantic context and mapping suggestions.'
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
        const analysis = JSON.parse(responseContent);
        return this.validateAnalysis(analysis);
      } catch (error) {
        console.error('[ContextAnalysisService] Error parsing Claude response:', error);
        throw new Error('Failed to parse contextual analysis');
      }

    } catch (error) {
      console.error('[ContextAnalysisService] Error in analyzeTMFEndpoint:', error);
      throw error;
    }
  }

  private buildAnalysisPrompt(endpoint: {
    path: string;
    method: string;
    specification: {
      name: string;
      description: string;
      fields: Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
      }>;
      category: string;
    };
  }): string {
    return `
Analyze this TMF API endpoint and provide semantic context:

Endpoint Details:
Path: ${endpoint.path}
Method: ${endpoint.method}
Name: ${endpoint.specification.name}
Category: ${endpoint.specification.category}
Description: ${endpoint.specification.description}

Fields:
${JSON.stringify(endpoint.specification.fields, null, 2)}

Provide a detailed analysis that includes:
1. A semantic description of what this endpoint does
2. Suggested approach for mapping this endpoint to other APIs
3. Identified patterns in the field structure and naming
4. Confidence score for understanding the endpoint (0-100)

Return the analysis as a JSON object with this structure:
{
  "semanticDescription": "string - Detailed description of the endpoint's purpose and behavior",
  "suggestedMappingApproach": "string - Recommended strategy for mapping this endpoint",
  "identifiedPatterns": ["string array - List of identified patterns"],
  "confidenceScore": number
}`;
  }

  private validateAnalysis(analysis: any): TMFEndpointContext {
    if (!analysis.semanticDescription || 
        !analysis.suggestedMappingApproach || 
        !Array.isArray(analysis.identifiedPatterns) ||
        typeof analysis.confidenceScore !== 'number') {
      throw new Error('Invalid analysis format: missing required fields');
    }

    return {
      semanticDescription: analysis.semanticDescription,
      suggestedMappingApproach: analysis.suggestedMappingApproach,
      identifiedPatterns: analysis.identifiedPatterns,
      confidenceScore: analysis.confidenceScore
    };
  }
} 