import fetch from 'node-fetch';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import {
  ApiDocParser,
  ApiEndpoint,
  OpenAIConfig,
  ParserError,
  ApiParameter,
  ApiResponse
} from '../types';
import * as yaml from 'js-yaml';

interface OpenAPIDoc {
  paths?: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
    responses?: Record<string, any>;
    parameters?: Record<string, any>;
  };
}

export class OpenAPIParser implements ApiDocParser {
  private openai: OpenAI;
  private config: Required<OpenAIConfig>;

  constructor(config: OpenAIConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'gpt-4',
      temperature: config.temperature || 0.1,
      batchSize: config.batchSize || 5
    };
    this.openai = new OpenAI({ apiKey: this.config.apiKey });
  }

  private parseOpenAPIDoc(doc: OpenAPIDoc): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const paths = doc.paths || {};

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, details] of Object.entries(methods)) {
        if (method === 'parameters' || method === '$ref') continue;

        const endpoint: ApiEndpoint = {
          name: details.operationId || `${method}${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: method.toUpperCase(),
          path,
          description: details.description || details.summary,
          parameters: [],
          tags: details.tags,
          security: details.security
        };

        // Parse parameters
        const parameters: ApiParameter[] = [];
        if (details.parameters) {
          for (const param of details.parameters) {
            parameters.push({
              name: param.name,
              type: param.schema?.type || param.type,
              required: param.required || false,
              description: param.description,
              in: param.in,
              schema: param.schema
            });
          }
        }

        // Parse request body if exists
        if (details.requestBody) {
          const content = details.requestBody.content;
          const mediaType = content['application/json'] || content['application/xml'] || Object.values(content)[0];
          if (mediaType?.schema) {
            parameters.push({
              name: 'body',
              type: 'object',
              required: details.requestBody.required || false,
              description: details.requestBody.description,
              in: 'body',
              schema: mediaType.schema
            });
          }
        }

        endpoint.parameters = parameters;

        // Parse responses
        if (details.responses) {
          const successResponse = details.responses['200'] || details.responses['201'] || details.responses['2XX'];
          if (successResponse) {
            const content = successResponse.content;
            const mediaType = content?.['application/json'] || content?.['application/xml'] || Object.values(content || {})[0];
            endpoint.response = {
              type: mediaType?.schema?.type || 'object',
              description: successResponse.description,
              schema: mediaType?.schema
            };
          }

          // Collect error responses
          endpoint.errors = Object.entries(details.responses)
            .filter(([code]) => code.startsWith('4') || code.startsWith('5'))
            .map(([code, res]) => `${code}: ${(res as any).description}`);
        }

        endpoints.push(endpoint);
      }
    }

    return endpoints;
  }

  private async enhanceEndpointsWithAI(endpoints: ApiEndpoint[]): Promise<ApiEndpoint[]> {
    const results: ApiEndpoint[] = [];
    
    for (let i = 0; i < endpoints.length; i += this.config.batchSize) {
      const batch = endpoints.slice(i, i + this.config.batchSize);
      
      // Prepare the system and user messages
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: 'You are a specialized API documentation enhancer. Your task is to improve and clarify the API endpoint descriptions and make them more user-friendly while maintaining technical accuracy.'
        },
        {
          role: 'user',
          content: `Enhance these API endpoints by improving descriptions and adding any missing information. Return in this JSON format:
          {
            "endpoints": [
              {
                "name": "string",
                "type": "string",
                "path": "string",
                "description": "string (enhanced description)",
                "parameters": [
                  {
                    "name": "string",
                    "type": "string",
                    "required": boolean,
                    "description": "string (enhanced description)"
                  }
                ],
                "response": {
                  "type": "string",
                  "description": "string (enhanced description)"
                },
                "errors": ["string"]
              }
            ]
          }

          Endpoints to enhance:
          ${JSON.stringify(batch, null, 2)}`
        }
      ];

      try {
        const completion = await this.openai.chat.completions.create({
          model: this.config.model,
          messages,
          temperature: this.config.temperature
        });

        const response = completion.choices[0]?.message?.content || '{"endpoints": []}';
        const { endpoints: enhancedEndpoints } = JSON.parse(response);
        
        results.push(...enhancedEndpoints);
        console.log(`Enhanced batch ${Math.floor(i / this.config.batchSize) + 1} (${results.length} endpoints so far)`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error enhancing batch ${Math.floor(i / this.config.batchSize) + 1}:`, error);
        // If enhancement fails, use original endpoints
        results.push(...batch);
      }
    }
    
    return results;
  }

  async parseContent(content: string): Promise<ApiEndpoint[]> {
    try {
      // Try parsing as JSON first
      let doc: OpenAPIDoc;
      try {
        doc = JSON.parse(content);
      } catch {
        // If JSON parsing fails, try YAML
        doc = yaml.load(content) as OpenAPIDoc;
      }

      const endpoints = this.parseOpenAPIDoc(doc);
      console.log(`\nFound ${endpoints.length} endpoints to process`);
      
      // Enhance endpoints with AI
      return this.enhanceEndpointsWithAI(endpoints);
    } catch (error) {
      throw new ParserError('Failed to parse OpenAPI content', error as Error);
    }
  }

  async parseUrl(url: string): Promise<ApiEndpoint[]> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
      }
      const content = await response.text();
      return this.parseContent(content);
    } catch (error) {
      throw new ParserError(`Failed to parse OpenAPI documentation from URL: ${url}`, error as Error);
    }
  }
} 