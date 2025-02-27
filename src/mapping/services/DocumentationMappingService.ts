import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ApiMapping, TMFEndpoint } from '../types';
import fetch from 'node-fetch';

export class DocumentationMappingService {
  private openaiApiKey: string;
  private bedrockClient: BedrockRuntimeClient;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
    this.bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });
  }

  private getBaseUrl(): string {
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
  }

  async analyzeDocumentation(tmfEndpoint: TMFEndpoint, docId: string): Promise<ApiMapping[]> {
    try {
      console.log('[DocumentationMappingService] Starting documentation analysis:', {
        tmfEndpoint,
        docId
      });

      // Fetch documentation content
      const docResponse = await fetch(`${this.getBaseUrl()}/api/fetch-documentation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Vercel Serverless Function'
        },
        body: JSON.stringify({ docId })
      });

      if (!docResponse.ok) {
        throw new Error(`Failed to fetch documentation: ${docResponse.status} ${docResponse.statusText}`);
      }

      const documentation = await docResponse.json();

      // Prepare the prompt for Claude
      const prompt = `
        I need to analyze API documentation and find mappings between endpoints.
        
        Target TMF Endpoint:
        - Path: ${tmfEndpoint.path}
        - Method: ${tmfEndpoint.method}
        - Specification: ${tmfEndpoint.specification}
        
        Documentation Content:
        ${JSON.stringify(documentation.content, null, 2)}
        
        Please analyze the documentation and identify potential endpoint mappings.
        For each mapping, provide:
        1. The endpoint details (path, method, description)
        2. Required input/output field mappings
        3. A confidence score (0-1) for the mapping
        4. Reasoning for the suggested mapping
        
        Format the response as a JSON array of mappings.
      `;

      // Create the request payload for Claude 3
      const input = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 100000,
          temperature: 0.5,
          messages: [
            {
              role: 'system',
              content: 'You are an API mapping expert. Analyze the documentation and provide detailed endpoint mappings with field-level compatibility analysis.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      };

      // Send request to Claude
      const bedrockInput = {
        modelId: 'anthropic.claude-3-sonnet-20240229', // Required model identifier for Bedrock
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: '2023-06-01',
          max_tokens: 100000,
          temperature: 0.5,
          messages: [
            {
              role: 'system',
              content: 'You are an API mapping expert. Analyze the documentation and provide detailed endpoint mappings with field-level compatibility analysis.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      };

      const command = new InvokeModelCommand(bedrockInput);
      const bedrockResponse = await this.bedrockClient.send(command);

      // Parse the response
      if (!bedrockResponse.body) {
        throw new Error('Empty response from Bedrock');
      }

      const responseBody = new TextDecoder().decode(new Uint8Array(bedrockResponse.body));
      const parsedResponse = JSON.parse(responseBody);
      const mappings = JSON.parse(parsedResponse.completion || '[]');

      console.log('[DocumentationMappingService] Analysis complete:', {
        mappingsCount: mappings.length
      });

      return mappings;

    } catch (error) {
      console.error('[DocumentationMappingService] Error analyzing documentation:', error);
      throw new Error('Failed to analyze documentation');
    }
  }

  async generateMappingConfig(endpoint: TMFEndpoint): Promise<any> {
    // Implementation will be added later
    return {};
  }

  // ... rest of the DocumentationMappingService implementation ...
} 