import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import {
  ApiDocParser,
  ApiEndpoint,
  OpenAIConfig,
  ParserError
} from '../types';

interface EndpointDoc {
  name: string;
  type: 'query' | 'mutation';
  content: string;
}

export class GraphQLParser implements ApiDocParser {
  private openai: OpenAI;
  private config: Required<OpenAIConfig>;

  constructor(config: OpenAIConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'gpt-4',
      temperature: config.temperature || 0.1,
      batchSize: config.batchSize || 5,
      onProgress: config.onProgress || (() => {})
    };
    this.openai = new OpenAI({ apiKey: this.config.apiKey });
  }

  private preprocessHtml(html: string): EndpointDoc[] {
    const $ = cheerio.load(html);
    const endpoints: EndpointDoc[] = [];

    // Remove script and style elements
    $('script, style').remove();
    
    // Process Queries
    $('h5:contains("Queries")').next('ul').find('li').each((_, el) => {
      const queryName = $(el).text().trim();
      let content = `Operation: ${queryName}\nType: query\n\n`;
      
      // Try to find the query documentation section
      $(`h2:contains("${queryName}")`).each((_, section) => {
        const sectionContent = $(section).nextUntil('h2').text();
        if (sectionContent) {
          content += `Description:\n${sectionContent}\n\n`;
        }
        
        // Look for parameters table
        $(section).nextUntil('h2').find('table').each((_, table) => {
          content += 'Parameters:\n';
          $(table).find('tr').each((i, row) => {
            if (i > 0) { // Skip header row
              const cols = $(row).find('td').map((_, col) => $(col).text().trim()).get();
              if (cols.length >= 2) {
                content += `- ${cols[0]} (${cols[1]}): ${cols[2] || ''}\n`;
              }
            }
          });
          content += '\n';
        });
        
        // Look for response type information
        $(section).nextUntil('h2').find('h4:contains("Return type")').each((_, returnType) => {
          content += `Return Type: ${$(returnType).next().text().trim()}\n\n`;
        });
        
        // Look for errors
        $(section).nextUntil('h2').find('h4:contains("Errors")').each((_, errors) => {
          content += 'Possible Errors:\n';
          $(errors).next('ul').find('li').each((_, error) => {
            content += `- ${$(error).text().trim()}\n`;
          });
          content += '\n';
        });
      });

      endpoints.push({
        name: queryName,
        type: 'query',
        content
      });
    });

    // Process Mutations
    $('h5:contains("Mutations")').next('ul').find('li').each((_, el) => {
      const mutationName = $(el).text().trim();
      let content = `Operation: ${mutationName}\nType: mutation\n\n`;
      
      // Try to find the mutation documentation section
      $(`h2:contains("${mutationName}")`).each((_, section) => {
        const sectionContent = $(section).nextUntil('h2').text();
        if (sectionContent) {
          content += `Description:\n${sectionContent}\n\n`;
        }
        
        // Look for parameters table
        $(section).nextUntil('h2').find('table').each((_, table) => {
          content += 'Parameters:\n';
          $(table).find('tr').each((i, row) => {
            if (i > 0) { // Skip header row
              const cols = $(row).find('td').map((_, col) => $(col).text().trim()).get();
              if (cols.length >= 2) {
                content += `- ${cols[0]} (${cols[1]}): ${cols[2] || ''}\n`;
              }
            }
          });
          content += '\n';
        });
        
        // Look for response type information
        $(section).nextUntil('h2').find('h4:contains("Return type")').each((_, returnType) => {
          content += `Return Type: ${$(returnType).next().text().trim()}\n\n`;
        });
        
        // Look for errors
        $(section).nextUntil('h2').find('h4:contains("Errors")').each((_, errors) => {
          content += 'Possible Errors:\n';
          $(errors).next('ul').find('li').each((_, error) => {
            content += `- ${$(error).text().trim()}\n`;
          });
          content += '\n';
        });
      });

      endpoints.push({
        name: mutationName,
        type: 'mutation',
        content
      });
    });

    return endpoints;
  }

  private async parseEndpointBatch(endpoints: EndpointDoc[]): Promise<ApiEndpoint[]> {
    const results: ApiEndpoint[] = [];
    
    for (let i = 0; i < endpoints.length; i += this.config.batchSize) {
      const batch = endpoints.slice(i, i + this.config.batchSize);
      const batchContent = batch.map(e => e.content).join('\n---\n');
      
      // Prepare the system and user messages
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: 'You are a specialized GraphQL API documentation parser. Your task is to extract and structure API operation information from documentation text. Always return valid JSON in the specified format.'
        },
        {
          role: 'user',
          content: `Extract GraphQL API operation information from the following documentation and return it in this JSON format:
          {
            "endpoints": [
              {
                "name": "string (The operation name)",
                "type": "string (query or mutation)",
                "parameters": [
                  {
                    "name": "string (parameter name)",
                    "type": "string (GraphQL type)",
                    "required": boolean,
                    "description": "string (parameter description if available)"
                  }
                ],
                "response": {
                  "type": "string (GraphQL return type)",
                  "description": "string (description of the response)"
                },
                "description": "string (Brief description of what the operation does)",
                "errors": ["string (Possible error types)"]
              }
            ]
          }

          Documentation Content:
          ${batchContent}`
        },
        {
          role: 'system',
          content: 'Remember to respond ONLY with valid JSON, no other text or explanation.'
        }
      ];

      try {
        // Make request to OpenAI
        const completion = await this.openai.chat.completions.create({
          model: this.config.model,
          messages,
          temperature: this.config.temperature
        });

        // Parse the response
        const response = completion.choices[0]?.message?.content || '{"endpoints": []}';
        const { endpoints: parsedEndpoints } = JSON.parse(response);
        
        // Add the parsed endpoints to results
        results.push(...parsedEndpoints);
        
        // Log progress
        console.log(`Processed batch ${Math.floor(i / this.config.batchSize) + 1} (${results.length} endpoints so far)`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing batch ${Math.floor(i / this.config.batchSize) + 1}:`, error);
      }
    }
    
    return results;
  }

  async parseContent(content: string): Promise<ApiEndpoint[]> {
    try {
      const endpoints = this.preprocessHtml(content);
      console.log(`\nFound ${endpoints.length} endpoints to process`);
      return await this.parseEndpointBatch(endpoints);
    } catch (error) {
      throw new ParserError('Failed to parse GraphQL content', error as Error);
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
      throw new ParserError(`Failed to parse GraphQL documentation from URL: ${url}`, error as Error);
    }
  }
} 