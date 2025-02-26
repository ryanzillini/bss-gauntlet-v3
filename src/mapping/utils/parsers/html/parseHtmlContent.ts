import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import { ApiEndpoint } from '../types';

interface EndpointDoc {
  content: string;
  section?: string;
  method?: string;
  path?: string;
}

function preprocessHtml(html: string): EndpointDoc[] {
  const $ = cheerio.load(html);
  const endpoints: EndpointDoc[] = [];
  console.log('[preprocessHtml] Starting HTML preprocessing');

  // Remove script and style elements
  $('script, style').remove();

  // Common patterns for finding API endpoints in HTML documentation
  const patterns = [
    // Pattern 1: Look for common HTTP method keywords
    {
      selector: 'h1, h2, h3, h4, h5, h6, dt, .endpoint-title, .api-title, div, p, span, td, th, li, code, pre',
      process: ($el: cheerio.Cheerio) => {
        const text = $el.text()?.trim() || '';
        const methodMatch = text.match(/(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+([\/\w\-_{}\.]+)/i);
        if (methodMatch) {
          const [_, method, path] = methodMatch;
          const content = extractEndpointContent($, $el);
          const section = $el.closest('section, div, article').find('h1, h2, h3').first().text()?.trim() || '';
          console.log(`[preprocessHtml] Found endpoint via Pattern 1: ${method} ${path}`);
          endpoints.push({
            method: method.toUpperCase(),
            path,
            content,
            section: section || undefined
          });
        }
      }
    },
    // Pattern 2: Look for URL paths that look like API endpoints
    {
      selector: 'code, pre, .endpoint, .api-endpoint, .path, td, th, a, span, div, p',
      process: ($el: cheerio.Cheerio) => {
        const text = $el.text()?.trim() || '';
        if (text.match(/^\/[\w\-_{}\/\.]+$/)) {
          const method = inferHttpMethod($, $el);
          const content = extractEndpointContent($, $el);
          const section = $el.closest('section, div, article').find('h1, h2, h3').first().text()?.trim() || '';
          console.log(`[preprocessHtml] Found endpoint via Pattern 2: ${method} ${text}`);
          endpoints.push({
            method,
            path: text,
            content,
            section: section || undefined
          });
        }
      }
    },
    // Pattern 3: Look for sections that might contain API documentation
    {
      selector: '.endpoint-section, .api-section, section, .method, .api-item, .endpoint-item, tr, .resource',
      process: ($el: cheerio.Cheerio) => {
        const text = $el.text()?.trim() || '';
        if (text.length > 0) {
          const methodMatch = text.match(/(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)/i);
          const pathMatch = text.match(/([\/\w\-_{}\.]+)/);
          const section = $el.closest('section, div, article').find('h1, h2, h3').first().text()?.trim() || '';
          if (methodMatch && pathMatch) {
            console.log(`[preprocessHtml] Found endpoint via Pattern 3: ${methodMatch[1]} ${pathMatch[1]}`);
            endpoints.push({
              method: methodMatch[1].toUpperCase(),
              path: pathMatch[1],
              content: text,
              section: section || undefined
            });
          } else {
            endpoints.push({
              content: text,
              section: section || undefined
            });
          }
        }
      }
    },
    // Pattern 4: Look for tables containing API documentation
    {
      selector: 'table',
      process: ($el: cheerio.Cheerio) => {
        $el.find('tr').each((_, row) => {
          const $cells = $(row).find('td, th');
          if ($cells.length >= 2) {
            const firstCell = $cells.eq(0).text().trim();
            const secondCell = $cells.eq(1).text().trim();
            
            // Check if first cell contains HTTP method
            const methodMatch = firstCell.match(/(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)/i);
            if (methodMatch) {
              const pathMatch = secondCell.match(/([\/\w\-_{}\.]+)/) || firstCell.match(/([\/\w\-_{}\.]+)/);
              if (pathMatch) {
                const content = extractEndpointContent($, $(row));
                console.log(`[preprocessHtml] Found endpoint via Pattern 4 (table): ${methodMatch[1]} ${pathMatch[1]}`);
                endpoints.push({
                  method: methodMatch[1].toUpperCase(),
                  path: pathMatch[1],
                  content,
                  section: $el.closest('section, div, article').find('h1, h2, h3').first().text()?.trim() || ''
                });
              }
            }
          }
        });
      }
    }
  ];

  // Apply each pattern
  patterns.forEach(({ selector, process }) => {
    $(selector).each((_, el) => process($(el)));
  });

  // Deduplicate endpoints by path+method
  const uniqueEndpoints: EndpointDoc[] = [];
  const seen = new Set<string>();
  
  endpoints.forEach(endpoint => {
    const key = `${endpoint.method || ''}-${endpoint.path || ''}`;
    if (endpoint.method && endpoint.path && !seen.has(key)) {
      seen.add(key);
      uniqueEndpoints.push(endpoint);
    } else if (!endpoint.method || !endpoint.path) {
      // Keep contextual content without method/path
      uniqueEndpoints.push(endpoint);
    }
  });
  
  console.log(`[preprocessHtml] Found ${endpoints.length} raw endpoints, ${uniqueEndpoints.length} after deduplication`);
  return uniqueEndpoints;
}

function inferHttpMethod($: cheerio.Root, $el: cheerio.Cheerio): string {
  // Try to find HTTP method in surrounding text
  const surroundingText = $el.parent().text().toLowerCase();
  const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
  
  // First check the element's own text
  const elementText = $el.text().toLowerCase();
  for (const method of methods) {
    if (elementText.includes(method)) {
      return method.toUpperCase();
    }
  }
  
  // Then check parent and siblings
  for (const method of methods) {
    if (surroundingText.includes(method)) {
      return method.toUpperCase();
    }
  }
  
  // Check previous siblings for method hints
  let $prev = $el.prev();
  for (let i = 0; i < 3 && $prev.length > 0; i++) {
    const prevText = $prev.text().toLowerCase();
    for (const method of methods) {
      if (prevText.includes(method)) {
        return method.toUpperCase();
      }
    }
    $prev = $prev.prev();
  }
  
  return 'GET'; // Default to GET if no method found
}

function extractEndpointContent($: cheerio.Root, $el: cheerio.Cheerio): string {
  let content = '';

  // Get the section title
  const title = $el.text()?.trim() || '';
  content += `Endpoint: ${title}\n\n`;

  // Find the closest section container
  const $section = $el.closest('section') || $el.parent();

  // Extract description
  const $description = $section.find('.description, .docs-content, p').first();
  if ($description.length) {
    content += `Description:\n${$description.text()?.trim() || ''}\n\n`;
  }

  // Extract parameters
  const $params = $section.find('.parameters, .params, table');
  if ($params.length) {
    content += 'Parameters:\n';
    $params.find('tr').each((index: number, row: any) => {
      if (index > 0) { // Skip header row
        const $cols = $(row).find('td');
        const name = $cols.eq(0).text()?.trim() || '';
        const type = $cols.eq(1).text()?.trim() || '';
        const desc = $cols.eq(2).text()?.trim() || '';
        content += `- ${name} (${type}): ${desc}\n`;
      }
    });
    content += '\n';
  }

  // Extract response information
  const $response = $section.find('.response, .returns, .response-example');
  if ($response.length) {
    content += 'Response:\n';
    content += ($response.text()?.trim() || '') + '\n\n';
  }

  // Extract examples if available
  const $examples = $section.find('.example, .examples, pre');
  if ($examples.length) {
    content += 'Examples:\n';
    $examples.each((_: number, example: any) => {
      content += ($(example).text()?.trim() || '') + '\n';
    });
    content += '\n';
  }

  return content;
}

async function parseEndpointBatch(
  openai: OpenAI,
  endpoints: EndpointDoc[],
  batchSize: number = 5
): Promise<ApiEndpoint[]> {
  const results: ApiEndpoint[] = [];
  console.log(`[parseHtmlContent] Processing ${endpoints.length} endpoints in batches of ${batchSize}`);
  
  for (let i = 0; i < endpoints.length; i += batchSize) {
    const batch = endpoints.slice(i, i + batchSize);
    console.log(`[parseHtmlContent] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(endpoints.length/batchSize)}`);
    
    const batchContent = batch.map((e, index) => {
      let content = `--- Endpoint ${index + 1} ---\n`;
      if (e.method && e.path) {
        content += `Method: ${e.method}\nPath: ${e.path}\n`;
      }
      if (e.section) {
        content += `Section: ${e.section}\n`;
      }
      content += `\nContent:\n${e.content}\n`;
      return content;
    }).join('\n\n');
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are a specialized API documentation parser. Your task is to extract structured information about API endpoints from documentation text.
Extract ALL possible details including parameters, request bodies, response formats, and examples.
Always include method, path, description, parameters (with their types and whether they're required), and response information.
For parameters, determine if they are path parameters, query parameters, body parameters, or header parameters.
For API endpoints with multiple status codes, capture information about each potential response.
Be thorough and don't miss any details from the documentation.`
          },
          {
            role: "user",
            content: `Please analyze the following API documentation and extract all endpoint information. There are ${batch.length} potential endpoints in this batch.
Return the results as a JSON object with an 'endpoints' array containing objects with the following fields:
- name: A descriptive name for the endpoint
- method: HTTP method (GET, POST, PUT, DELETE, etc.)
- path: The URL path
- description: A detailed description of what the endpoint does
- parameters: Array of parameter objects with name, type, required, description, and in (path/query/body/header) properties
- responses: Object mapping status codes to response descriptions and schemas
- tags: Array of tags or categories for the endpoint
- deprecated: Boolean indicating if endpoint is deprecated

Example of expected output format:
{
  "endpoints": [
    {
      "name": "Get User Profile",
      "path": "/users/{id}",
      "method": "GET",
      "description": "Retrieves a user's profile information",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "required": true,
          "description": "User's unique identifier",
          "in": "path"
        }
      ],
      "responses": {
        "200": {
          "description": "Successfully retrieved user profile",
          "schema": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "name": { "type": "string" }
            }
          }
        }
      }
    }
  ]
}

Here's the documentation to analyze:

${batchContent}`
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        console.warn('[parseHtmlContent] Empty response from OpenAI');
        continue;
      }

      try {
        const parsed = JSON.parse(content);
        if (parsed.endpoints && Array.isArray(parsed.endpoints)) {
          console.log(`[parseHtmlContent] Successfully parsed ${parsed.endpoints.length} endpoints from batch`);
          // Filter out any endpoints without both method and path
          const validEndpoints = parsed.endpoints.filter((ep: any) => ep.method && ep.path);
          if (validEndpoints.length !== parsed.endpoints.length) {
            console.warn(`[parseHtmlContent] Filtered out ${parsed.endpoints.length - validEndpoints.length} incomplete endpoints`);
          }
          results.push(...validEndpoints);
        } else {
          console.warn('[parseHtmlContent] Unexpected response format from OpenAI:', parsed);
        }
      } catch (parseError) {
        console.error('[parseHtmlContent] Failed to parse OpenAI response:', parseError);
        console.log('[parseHtmlContent] Raw response:', content);
      }
    } catch (error) {
      console.error('[parseHtmlContent] Error processing batch:', error);
      // Continue with next batch even if this one fails
    }
  }

  return results;
}

export async function parseHtmlContent(content: string, apiKey: string): Promise<ApiEndpoint[]> {
  try {
    console.log('[parseHtmlContent] Starting HTML content parsing');
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey
    });

    // Preprocess the HTML content into individual endpoint docs
    const endpoints = preprocessHtml(content);
    console.log(`[parseHtmlContent] Found ${endpoints.length} potential endpoints to process`);
    
    if (endpoints.length === 0) {
      console.warn('[parseHtmlContent] No endpoints found in HTML content, attempting fallback parsing');
      // Fallback parsing: extract any text content that might contain API endpoint information
      const $ = cheerio.load(content);
      $('script, style').remove();
      
      const bodyText = $('body').text();
      console.log('[parseHtmlContent] Using fallback with direct OpenAI processing of body content');
      
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that extracts API endpoint information from documentation text."
            },
            {
              role: "user",
              content: `Please analyze the following HTML page content and extract any API endpoint information. Return the results as a JSON object with an 'endpoints' array containing objects with 'method', 'path', 'description', 'parameters', and 'responses' fields. Be thorough and extract ANY endpoints that might be present, even if they are not well-formatted. Use the HTML structure, text patterns, and context clues.\n\n${bodyText.substring(0, 12000)}`
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        });
        
        const responseContent = completion.choices[0].message.content;
        if (responseContent) {
          try {
            const parsed = JSON.parse(responseContent);
            if (parsed.endpoints && parsed.endpoints.length > 0) {
              console.log(`[parseHtmlContent] Fallback found ${parsed.endpoints.length} endpoints`);
              return parsed.endpoints;
            }
          } catch (parseError) {
            console.error('[parseHtmlContent] Error parsing fallback result:', parseError);
          }
        }
      } catch (fallbackError) {
        console.error('[parseHtmlContent] Fallback parsing failed:', fallbackError);
      }
    }
    
    // Process endpoints in batches
    const results = await parseEndpointBatch(openai, endpoints);
    console.log(`[parseHtmlContent] Successfully processed ${results.length} endpoints`);
    
    return results;
  } catch (error) {
    console.error('[parseHtmlContent] Error parsing HTML content:', error);
    throw new Error('Failed to parse HTML content');
  }
} 