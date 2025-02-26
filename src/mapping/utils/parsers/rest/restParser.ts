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
  content: string;
  method?: string;
  path?: string;
  section?: string;
}

interface Pattern {
  selector: string;
  pattern: RegExp | null;
  process: ($el: any) => void;
}

export class RestParser implements ApiDocParser {
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

  private preprocessHtml(html: string): EndpointDoc[] {
    const $ = cheerio.load(html);
    const endpoints: EndpointDoc[] = [];

    // Remove script and style elements
    $('script, style').remove();

    // Common patterns for finding API endpoints in HTML documentation
    const patterns: Pattern[] = [
      // Pattern 1: Look for common HTTP method keywords
      {
        selector: 'h1, h2, h3, h4, h5, h6, dt',
        pattern: /(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+([\/\w\-_{}]+)/i,
        process: ($el) => {
          const text = $el.text().trim();
          const match = text.match(patterns[0].pattern!);
          if (match) {
            const [_, method, path] = match;
            const content = this.extractEndpointContent($, $el);
            endpoints.push({
              method: method.toUpperCase(),
              path,
              content
            });
          }
        }
      },
      // Pattern 2: Look for URL paths that look like API endpoints
      {
        selector: 'code, pre, .endpoint, .api-endpoint',
        pattern: /^[\/\w\-_{}]+$/,
        process: ($el) => {
          const text = $el.text().trim();
          if (text.startsWith('/') && patterns[1].pattern!.test(text)) {
            const method = this.inferHttpMethod($, $el);
            const content = this.extractEndpointContent($, $el);
            endpoints.push({
              method,
              path: text,
              content
            });
          }
        }
      },
      // Pattern 3: Look for sections that might contain API documentation
      {
        selector: '.endpoint-section, .api-section, section',
        pattern: null,
        process: ($el) => {
          const content = $el.text().trim();
          if (content.length > 0) {
            endpoints.push({
              content,
              section: $el.find('h1, h2, h3, h4, h5, h6').first().text().trim()
            });
          }
        }
      }
    ];

    // Apply each pattern
    patterns.forEach(({ selector, process }) => {
      $(selector).each((_, el) => process($(el)));
    });

    return endpoints;
  }

  private inferHttpMethod($: ReturnType<typeof cheerio.load>, $el: any): string {
    // Try to find HTTP method in surrounding text
    const surroundingText = $el.parent().text().toLowerCase();
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
    for (const method of methods) {
      if (surroundingText.includes(method)) {
        return method.toUpperCase();
      }
    }
    return 'GET'; // Default to GET if no method found
  }

  private extractEndpointContent($: ReturnType<typeof cheerio.load>, $el: any): string {
    let content = '';

    // Get the section title
    const title = $el.text().trim();
    content += `Endpoint: ${title}\n\n`;

    // Find the closest section container
    const $section = $el.closest('section') || $el.parent();

    // Extract description
    const $description = $section.find('.description, .docs-content, p').first();
    if ($description.length) {
      content += `Description:\n${$description.text().trim()}\n\n`;
    }

    // Extract parameters
    const $params = $section.find('.parameters, .params, table');
    if ($params.length) {
      content += 'Parameters:\n';
      $params.find('tr').each((index: number, row: any) => {
        if (index > 0) { // Skip header row
          const $cols = $(row).find('td');
          const name = $cols.eq(0).text().trim();
          const type = $cols.eq(1).text().trim();
          const desc = $cols.eq(2).text().trim();
          content += `- ${name} (${type}): ${desc}\n`;
        }
      });
      content += '\n';
    }

    // Extract response information
    const $response = $section.find('.response, .returns, .response-example');
    if ($response.length) {
      content += 'Response:\n';
      content += $response.text().trim() + '\n\n';
    }

    // Extract examples if available
    const $examples = $section.find('.example, .examples, pre');
    if ($examples.length) {
      content += 'Examples:\n';
      $examples.each((_: number, example: any) => {
        content += $(example).text().trim() + '\n';
      });
      content += '\n';
    }

    return content;
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
          content: 'You are a specialized REST API documentation parser. Your task is to extract and structure API endpoint information from documentation text. Always return valid JSON in the specified format.'
        },
        {
          role: 'user',
          content: `Extract REST API endpoint information from the following documentation and return it in this JSON format:
          {
            "endpoints": [
              {
                "name": "string (A descriptive name for the endpoint)",
                "type": "string (HTTP method: GET, POST, etc.)",
                "path": "string (The endpoint path)",
                "parameters": [
                  {
                    "name": "string (parameter name)",
                    "type": "string (parameter type)",
                    "required": boolean,
                    "description": "string (parameter description)",
                    "in": "string (query, path, body, or header)"
                  }
                ],
                "response": {
                  "type": "string (response type)",
                  "description": "string (response description)"
                },
                "description": "string (Brief description of what the endpoint does)",
                "errors": ["string (Possible error responses)"]
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
      console.log(`\nFound ${endpoints.length} potential endpoints to process`);
      return await this.parseEndpointBatch(endpoints);
    } catch (error) {
      throw new ParserError('Failed to parse REST API content', error as Error);
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
      throw new ParserError(`Failed to parse REST API documentation from URL: ${url}`, error as Error);
    }
  }
}