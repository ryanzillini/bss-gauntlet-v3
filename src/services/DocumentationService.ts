import OpenAI from 'openai';
import { supabase } from '../utils/supabase-client';

interface TMFField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  subFields?: TMFField[];
  schema?: any;
}

interface TMFEndpoint {
  path: string;
  method: string;
  specification: {
    fields: TMFField[];
  };
}

interface ApiMapping {
  confidenceScore: number;
  reasoning: string;
  steps: Array<{
    endpoint: {
      path: string;
      method: string;
      description?: string;
      parameters?: any[];
      responses?: Record<string, any>;
      matchReason?: string;
      confidenceScore?: number;
    };
    outputFields: Array<{
      source: string;
      target: string;
      transform?: string;
    }>;
  }>;
}

interface FlattenedEndpoint {
  path: string;
  method: string;
  description: string;
  fields?: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  score?: number;
}

class DocumentationService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async getDocumentationById(docId: string): Promise<any> {
    try {
      console.log('[DocumentationService] Fetching documentation for docId:', docId);
      const { data, error } = await supabase
        .from('bss_mappings')
        .select('config, endpoints')  // Select both config and endpoints
        .eq('id', docId)
        .eq('type', 'documentation')
        .single();

      if (error) {
        console.error('[DocumentationService] Error fetching documentation:', error);
        throw new Error('Failed to fetch documentation');
      }

      if (!data) {
        console.error('[DocumentationService] Documentation not found for docId:', docId);
        throw new Error('Documentation not found');
      }

      console.log('[DocumentationService] Raw data received:', JSON.stringify({
        hasConfig: !!data.config,
        configType: data.config ? typeof data.config : 'undefined',
        hasEndpoints: !!data.endpoints,
        endpointsType: data.endpoints ? typeof data.endpoints : 'undefined',
        endpointsIsArray: data.endpoints ? Array.isArray(data.endpoints) : false,
        endpointsLength: data.endpoints && Array.isArray(data.endpoints) ? data.endpoints.length : 0,
        configHasEndpoints: data.config?.endpoints ? true : false,
        configEndpointsIsArray: data.config?.endpoints ? Array.isArray(data.config.endpoints) : false,
        configEndpointsLength: data.config?.endpoints && Array.isArray(data.config.endpoints) ? data.config.endpoints.length : 0
      }, null, 2));

      // Ensure endpoints is an array
      let endpoints = [];
      
      // First check if this is a GraphQL document
      if (data.config && (data.config.type === 'graphql' || data.config.format === 'GraphQL')) {
        console.log('[DocumentationService] Detected GraphQL document, parsing with specialized parser');
        endpoints = this.parseGraphQLConfig(data.config);
        
        if (endpoints.length > 0) {
          console.log('[DocumentationService] Successfully extracted GraphQL endpoints:', endpoints.length);
        } else {
          console.log('[DocumentationService] No GraphQL endpoints found, will try other methods');
        }
      }
      
      // If we didn't get endpoints from GraphQL parsing, try other methods
      if (endpoints.length === 0) {
        if (data.endpoints && Array.isArray(data.endpoints)) {
          console.log('[DocumentationService] Using endpoints from data.endpoints');
          endpoints = data.endpoints;
        } else if (data.config?.endpoints && Array.isArray(data.config.endpoints)) {
          console.log('[DocumentationService] Using endpoints from data.config.endpoints');
          endpoints = data.config.endpoints;
        } else if (data.config?.endpoints && typeof data.config.endpoints === 'object') {
          // Handle case where endpoints is an object with keys as paths or methods
          console.log('[DocumentationService] Endpoints in config is an object, attempting to convert to array');
          try {
            // Try to extract endpoints from the object structure
            const extractedEndpoints = [];
            
            // Log the structure to help debug
            console.log('[DocumentationService] Endpoints object structure:', 
              JSON.stringify(Object.keys(data.config.endpoints).slice(0, 5), null, 2));
            
            // Different possible structures:
            // 1. { "/path1": { method: "GET", ... }, "/path2": { ... } }
            // 2. { "GET": { "/path1": { ... } }, "POST": { ... } }
            // 3. { "endpoints": [ ... ] } - nested array
            
            // Check for nested endpoints array
            if (data.config.endpoints.endpoints && Array.isArray(data.config.endpoints.endpoints)) {
              console.log('[DocumentationService] Found nested endpoints array');
              extractedEndpoints.push(...data.config.endpoints.endpoints);
            } else {
              // Try to determine the structure by checking the first key
              const keys = Object.keys(data.config.endpoints);
              if (keys.length > 0) {
                const firstKey = keys[0];
                const firstValue = data.config.endpoints[firstKey];
                
                if (firstKey.startsWith('/')) {
                  // Structure is likely { "/path": { method: "GET", ... } }
                  console.log('[DocumentationService] Structure appears to be path-keyed');
                  for (const path of keys) {
                    const endpointData = data.config.endpoints[path];
                    if (endpointData && typeof endpointData === 'object') {
                      // Extract method from the object
                      const method = endpointData.method || 'GET'; // Default to GET if not specified
                      extractedEndpoints.push({
                        path,
                        method,
                        description: endpointData.description || '',
                        fields: endpointData.fields || []
                      });
                    }
                  }
                } else if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(firstKey.toUpperCase())) {
                  // Structure is likely { "GET": { "/path": { ... } } }
                  console.log('[DocumentationService] Structure appears to be method-keyed');
                  for (const method of keys) {
                    const pathsObj = data.config.endpoints[method];
                    if (pathsObj && typeof pathsObj === 'object') {
                      for (const path of Object.keys(pathsObj)) {
                        const endpointData = pathsObj[path];
                        extractedEndpoints.push({
                          path,
                          method,
                          description: endpointData?.description || '',
                          fields: endpointData?.fields || []
                        });
                      }
                    }
                  }
                } else if (typeof firstValue === 'object' && firstValue !== null) {
                  // Try a more generic approach for unknown structures
                  console.log('[DocumentationService] Unknown structure, attempting generic extraction');
                  // Recursively search for objects with path and method properties
                  const findEndpoints = (obj: any, currentPath: string[] = []) => {
                    if (!obj || typeof obj !== 'object') return;
                    
                    // Check if this object looks like an endpoint
                    if (obj.path && obj.method) {
                      extractedEndpoints.push({
                        path: obj.path,
                        method: obj.method,
                        description: obj.description || '',
                        fields: obj.fields || []
                      });
                      return;
                    }
                    
                    // Otherwise, recursively search its properties
                    for (const key of Object.keys(obj)) {
                      findEndpoints(obj[key], [...currentPath, key]);
                    }
                  };
                  
                  findEndpoints(data.config.endpoints);
                }
              }
            }
            
            console.log('[DocumentationService] Extracted endpoints count:', extractedEndpoints.length);
            if (extractedEndpoints.length > 0) {
              endpoints = extractedEndpoints;
            } else {
              // Last resort: try to parse the entire config as a potential source of endpoints
              console.log('[DocumentationService] Attempting to find endpoints in the entire config object');
              const findEndpointsInConfig = (obj: any): any[] => {
                if (!obj || typeof obj !== 'object') return [];
                
                // If we find an array property named 'endpoints', use it
                for (const key of Object.keys(obj)) {
                  if (key.toLowerCase().includes('endpoint') && Array.isArray(obj[key])) {
                    console.log(`[DocumentationService] Found endpoints array in config.${key}`);
                    return obj[key];
                  }
                }
                
                // Recursively search nested objects
                for (const key of Object.keys(obj)) {
                  if (typeof obj[key] === 'object' && obj[key] !== null) {
                    const found: any[] = findEndpointsInConfig(obj[key]);
                    if (found.length > 0) return found;
                  }
                }
                
                return [];
              };
              
              const foundEndpoints = findEndpointsInConfig(data.config);
              if (foundEndpoints.length > 0) {
                endpoints = foundEndpoints;
              }
            }
          } catch (error) {
            console.error('[DocumentationService] Error extracting endpoints from object:', error);
          }
        } else {
          console.log('[DocumentationService] No valid endpoints found in data, trying to parse OpenAPI/Swagger format');
          
          // Try to parse as OpenAPI/Swagger format
          try {
            const extractedEndpoints = this.parseOpenAPIConfig(data.config);
            if (extractedEndpoints.length > 0) {
              console.log('[DocumentationService] Successfully extracted endpoints from OpenAPI format:', extractedEndpoints.length);
              endpoints = extractedEndpoints;
            } else {
              console.log('[DocumentationService] No endpoints found in OpenAPI format');
            }
          } catch (error) {
            console.error('[DocumentationService] Error parsing OpenAPI format:', error);
          }
        }
      }

      interface RawEndpoint {
        path?: string;
        method?: string;
        description?: string;
        fields?: any[];
        operationId?: string;
        graphqlType?: string;
      }

      // Validate and format each endpoint
      const validEndpoints = endpoints
        .filter((endpoint: unknown) => {
          const isValid = endpoint && typeof endpoint === 'object';
          if (!isValid) {
            console.log('[DocumentationService] Filtering out invalid endpoint:', endpoint);
          }
          return isValid;
        })
        .map((endpoint: RawEndpoint) => {
          const formattedEndpoint = {
            path: endpoint.path || '',
            method: endpoint.method || '',
            description: endpoint.description || '',
            fields: Array.isArray(endpoint.fields) ? endpoint.fields : [],
            operationId: endpoint.operationId || '',
            graphqlType: endpoint.graphqlType || ''
          };
          return formattedEndpoint;
        })
        .filter((endpoint: { path: string; method: string }) => {
          const isValid = endpoint.path && endpoint.method;
          if (!isValid) {
            console.log('[DocumentationService] Filtering out endpoint without path or method:', endpoint);
          }
          return isValid;
        });

      console.log('[DocumentationService] Processed endpoints:', {
        total: endpoints.length,
        valid: validEndpoints.length
      });

      if (validEndpoints.length === 0) {
        console.log('[DocumentationService] No valid endpoints found after processing');
        // Log a sample of the raw config to help debug
        console.log('[DocumentationService] Raw config sample:', 
          JSON.stringify(data.config).substring(0, 1000) + '...');
      } else {
        console.log('[DocumentationService] First valid endpoint:', JSON.stringify(validEndpoints[0], null, 2));
      }

      // Return the config object which contains the documentation content
      return {
        ...data.config,
        endpoints: validEndpoints
      };
    } catch (error) {
      console.error('[DocumentationService] Error in getDocumentationById:', error);
      throw error;
    }
  }

  /**
   * Parse OpenAPI/Swagger format to extract endpoints
   */
  private parseOpenAPIConfig(config: any): any[] {
    if (!config) return [];
    
    console.log('[DocumentationService] Attempting to parse as OpenAPI/Swagger format');
    
    const endpoints: any[] = [];
    
    try {
      // Check if this is an OpenAPI/Swagger document
      const isOpenAPI = config.swagger || config.openapi || config.paths;
      
      if (!isOpenAPI) {
        console.log('[DocumentationService] Not an OpenAPI/Swagger document');
        return this.parseGraphQLConfig(config);
      }
      
      console.log('[DocumentationService] Detected OpenAPI/Swagger format');
      
      // Extract version
      const version = config.swagger || config.openapi || 'unknown';
      console.log('[DocumentationService] OpenAPI version:', version);
      
      // Extract paths (endpoints)
      const paths = config.paths || {};
      console.log('[DocumentationService] Found paths:', Object.keys(paths).length);
      
      // Process each path
      for (const path of Object.keys(paths)) {
        const pathItem = paths[path];
        
        // Process each method (GET, POST, etc.)
        for (const method of Object.keys(pathItem)) {
          // Skip non-HTTP method properties
          if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
            continue;
          }
          
          const operation = pathItem[method];
          
          // Extract fields from parameters and request body
          const fields: any[] = [];
          
          // Add path parameters
          if (Array.isArray(pathItem.parameters)) {
            pathItem.parameters.forEach((param: any) => {
              if (param && param.name) {
                fields.push({
                  name: param.name,
                  type: param.type || param.schema?.type || 'string',
                  required: !!param.required,
                  description: param.description || '',
                  in: param.in || 'path'
                });
              }
            });
          }
          
          // Add operation parameters
          if (Array.isArray(operation.parameters)) {
            operation.parameters.forEach((param: any) => {
              if (param && param.name) {
                fields.push({
                  name: param.name,
                  type: param.type || param.schema?.type || 'string',
                  required: !!param.required,
                  description: param.description || '',
                  in: param.in || 'query'
                });
              }
            });
          }
          
          // Add request body fields (OpenAPI 3.0+)
          if (operation.requestBody && operation.requestBody.content) {
            const content = operation.requestBody.content;
            const contentType = Object.keys(content)[0]; // Use first content type
            
            if (contentType && content[contentType].schema) {
              const schema = content[contentType].schema;
              
              // Extract properties from schema
              if (schema.properties) {
                for (const propName of Object.keys(schema.properties)) {
                  const prop = schema.properties[propName];
                  fields.push({
                    name: propName,
                    type: prop.type || 'object',
                    required: Array.isArray(schema.required) && schema.required.includes(propName),
                    description: prop.description || '',
                    in: 'body'
                  });
                }
              }
            }
          }
          
          // Add request body fields (Swagger 2.0)
          if (operation.consumes && operation.parameters) {
            const bodyParam = operation.parameters.find((p: any) => p.in === 'body' && p.schema);
            
            if (bodyParam && bodyParam.schema) {
              const schema = bodyParam.schema;
              
              // Extract properties from schema
              if (schema.properties) {
                for (const propName of Object.keys(schema.properties)) {
                  const prop = schema.properties[propName];
                  fields.push({
                    name: propName,
                    type: prop.type || 'object',
                    required: Array.isArray(schema.required) && schema.required.includes(propName),
                    description: prop.description || '',
                    in: 'body'
                  });
                }
              }
            }
          }
          
          // Create endpoint object
          endpoints.push({
            path,
            method: method.toUpperCase(),
            description: operation.summary || operation.description || '',
            fields,
            operationId: operation.operationId || `${method.toUpperCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`
          });
        }
      }
      
      console.log('[DocumentationService] Extracted', endpoints.length, 'endpoints from OpenAPI format');
      return endpoints;
      
    } catch (error) {
      console.error('[DocumentationService] Error parsing OpenAPI format:', error);
      return [];
    }
  }

  /**
   * Parse GraphQL schema to extract endpoints
   */
  private parseGraphQLConfig(config: any): any[] {
    if (!config) return [];
    
    console.log('[DocumentationService] Attempting to parse as GraphQL format');
    
    const endpoints: any[] = [];
    
    try {
      // Check if this is a GraphQL document
      const isGraphQL = config.type === 'graphql' || config.format === 'GraphQL' || config.schema;
      
      if (!isGraphQL) {
        console.log('[DocumentationService] Not a GraphQL document');
        return this.parseGenericConfig(config);
      }
      
      console.log('[DocumentationService] Detected GraphQL format');
      console.log('[DocumentationService] GraphQL document type:', config.type, 'format:', config.format);
      
      // Check if we have a direct endpoints array in the format we've seen
      if (Array.isArray(config.endpoints) && config.endpoints.length > 0) {
        console.log('[DocumentationService] Found direct endpoints array in GraphQL format:', config.endpoints.length);
        
        // Process each endpoint in the array
        for (const endpoint of config.endpoints) {
          if (endpoint && endpoint.name) {
            // Extract fields from parameters
            const fields: any[] = [];
            
            if (Array.isArray(endpoint.parameters)) {
              endpoint.parameters.forEach((param: any) => {
                if (param && param.name) {
                  fields.push({
                    name: param.name,
                    type: param.type || 'String',
                    required: !!param.required,
                    description: param.description || ''
                  });
                }
              });
            }
            
            // Determine the GraphQL type (query or mutation)
            const graphqlType = endpoint.type || 'query';
            
            // Create endpoint object
            endpoints.push({
              path: `/graphql?operation=${endpoint.name}`,
              method: graphqlType === 'query' ? 'GET' : 'POST',
              description: endpoint.description || `GraphQL ${graphqlType}: ${endpoint.name}`,
              fields,
              operationId: endpoint.name,
              graphqlType: graphqlType
            });
          }
        }
        
        // If we have endpoints, log a sample
        if (endpoints.length > 0) {
          console.log('[DocumentationService] Sample GraphQL endpoint:', JSON.stringify(endpoints[0], null, 2));
          console.log('[DocumentationService] Extracted', endpoints.length, 'endpoints from GraphQL endpoints array');
          return endpoints;
        }
      }
      
      // For GraphQL, we need to extract queries and mutations
      const schema = config.schema || config;
      
      // Try to find queries
      const queries = schema.queries || schema.query || schema.queryType || {};
      console.log('[DocumentationService] Found queries:', typeof queries === 'object' ? Object.keys(queries).length : 'none');
      
      // Process queries
      if (typeof queries === 'object') {
        for (const queryName of Object.keys(queries)) {
          const query = queries[queryName];
          
          // Extract fields
          const fields: any[] = [];
          
          // Add arguments as fields
          if (query.args && typeof query.args === 'object') {
            for (const argName of Object.keys(query.args)) {
              const arg = query.args[argName];
              fields.push({
                name: argName,
                type: arg.type || 'String',
                required: !!arg.required,
                description: arg.description || ''
              });
            }
          }
          
          // Create endpoint object for query
          endpoints.push({
            path: `/graphql?query=${queryName}`,
            method: 'POST',
            description: query.description || `GraphQL query: ${queryName}`,
            fields,
            operationId: queryName,
            graphqlType: 'query'
          });
        }
      }
      
      // Try to find mutations
      const mutations = schema.mutations || schema.mutation || schema.mutationType || {};
      console.log('[DocumentationService] Found mutations:', typeof mutations === 'object' ? Object.keys(mutations).length : 'none');
      
      // Process mutations
      if (typeof mutations === 'object') {
        for (const mutationName of Object.keys(mutations)) {
          const mutation = mutations[mutationName];
          
          // Extract fields
          const fields: any[] = [];
          
          // Add arguments as fields
          if (mutation.args && typeof mutation.args === 'object') {
            for (const argName of Object.keys(mutation.args)) {
              const arg = mutation.args[argName];
              fields.push({
                name: argName,
                type: arg.type || 'String',
                required: !!arg.required,
                description: arg.description || ''
              });
            }
          }
          
          // Create endpoint object for mutation
          endpoints.push({
            path: `/graphql?mutation=${mutationName}`,
            method: 'POST',
            description: mutation.description || `GraphQL mutation: ${mutationName}`,
            fields,
            operationId: mutationName,
            graphqlType: 'mutation'
          });
        }
      }
      
      // If we found no endpoints but have a raw schema string, try to extract operation names
      if (endpoints.length === 0 && typeof schema.schemaString === 'string') {
        console.log('[DocumentationService] Attempting to parse raw GraphQL schema string');
        
        // Very basic extraction of operation names from schema string
        const queryMatches = schema.schemaString.match(/type\s+Query\s*{([^}]*)}/i);
        const mutationMatches = schema.schemaString.match(/type\s+Mutation\s*{([^}]*)}/i);
        
        if (queryMatches && queryMatches[1]) {
          const queryBlock = queryMatches[1];
          const queryFields = queryBlock.match(/(\w+)(\([^)]*\))?:/g) || [];
          
          for (const field of queryFields) {
            const name = field.split('(')[0].trim().replace(':', '');
            endpoints.push({
              path: `/graphql?query=${name}`,
              method: 'POST',
              description: `GraphQL query: ${name}`,
              fields: [],
              operationId: name,
              graphqlType: 'query'
            });
          }
        }
        
        if (mutationMatches && mutationMatches[1]) {
          const mutationBlock = mutationMatches[1];
          const mutationFields = mutationBlock.match(/(\w+)(\([^)]*\))?:/g) || [];
          
          for (const field of mutationFields) {
            const name = field.split('(')[0].trim().replace(':', '');
            endpoints.push({
              path: `/graphql?mutation=${name}`,
              method: 'POST',
              description: `GraphQL mutation: ${name}`,
              fields: [],
              operationId: name,
              graphqlType: 'mutation'
            });
          }
        }
      }
      
      console.log('[DocumentationService] Extracted', endpoints.length, 'endpoints from GraphQL format');
      return endpoints;
      
    } catch (error) {
      console.error('[DocumentationService] Error parsing GraphQL format:', error);
      return [];
    }
  }

  /**
   * Parse generic API documentation format
   */
  private parseGenericConfig(config: any): any[] {
    if (!config) return [];
    
    console.log('[DocumentationService] Attempting to parse as generic API format');
    
    const endpoints: any[] = [];
    
    try {
      // Look for common patterns in API documentation
      
      // 1. Check for a resources or apis array
      const resources = config.resources || config.apis || config.services || [];
      
      if (Array.isArray(resources) && resources.length > 0) {
        console.log('[DocumentationService] Found resources array:', resources.length);
        
        for (const resource of resources) {
          if (resource.endpoints && Array.isArray(resource.endpoints)) {
            endpoints.push(...resource.endpoints);
          } else if (resource.methods && Array.isArray(resource.methods)) {
            for (const method of resource.methods) {
              if (method.path || method.url) {
                endpoints.push({
                  path: method.path || method.url,
                  method: method.method || method.type || 'GET',
                  description: method.description || method.summary || '',
                  fields: method.parameters || method.fields || []
                });
              }
            }
          } else if (resource.path || resource.url) {
            endpoints.push({
              path: resource.path || resource.url,
              method: resource.method || resource.type || 'GET',
              description: resource.description || resource.summary || '',
              fields: resource.parameters || resource.fields || []
            });
          }
        }
      }
      
      // 2. Check for a direct endpoints array
      if (config.endpoints && Array.isArray(config.endpoints)) {
        console.log('[DocumentationService] Found direct endpoints array:', config.endpoints.length);
        endpoints.push(...config.endpoints);
      }
      
      // 3. Check for a routes or paths object
      const routes = config.routes || config.paths || {};
      
      if (typeof routes === 'object' && Object.keys(routes).length > 0) {
        console.log('[DocumentationService] Found routes/paths object:', Object.keys(routes).length);
        
        for (const path of Object.keys(routes)) {
          const route = routes[path];
          
          if (typeof route === 'object') {
            // Check if the route has HTTP methods as keys
            const methods = ['get', 'post', 'put', 'delete', 'patch'].filter(m => route[m]);
            
            if (methods.length > 0) {
              // OpenAPI-like structure
              for (const method of methods) {
                const operation = route[method];
                endpoints.push({
                  path,
                  method: method.toUpperCase(),
                  description: operation.description || operation.summary || '',
                  fields: operation.parameters || operation.fields || []
                });
              }
            } else if (route.method) {
              // Simple route object
              endpoints.push({
                path,
                method: route.method,
                description: route.description || route.summary || '',
                fields: route.parameters || route.fields || []
              });
            }
          }
        }
      }
      
      // 4. Last resort: recursively search for objects that look like endpoints
      if (endpoints.length === 0) {
        console.log('[DocumentationService] No endpoints found, trying recursive search');
        
        const findEndpointsRecursive = (obj: any, path: string[] = []): void => {
          if (!obj || typeof obj !== 'object') return;
          
          // Check if this object looks like an endpoint
          if ((obj.path || obj.url) && obj.method) {
            endpoints.push({
              path: obj.path || obj.url,
              method: obj.method,
              description: obj.description || obj.summary || '',
              fields: obj.parameters || obj.fields || []
            });
            return;
          }
          
          // If this is an array, check each item
          if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
              findEndpointsRecursive(obj[i], [...path, i.toString()]);
            }
            return;
          }
          
          // Otherwise, recursively search its properties
          for (const key of Object.keys(obj)) {
            findEndpointsRecursive(obj[key], [...path, key]);
          }
        };
        
        findEndpointsRecursive(config);
      }
      
      console.log('[DocumentationService] Extracted', endpoints.length, 'endpoints from generic format');
      return endpoints;
      
    } catch (error) {
      console.error('[DocumentationService] Error parsing generic format:', error);
      return [];
    }
  }

  private sanitizeForJSON(str: string | undefined | null): string {
    if (str == null) return '';
    return str
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/\\(?!["\\/bfnrt])/g, '\\\\') // Escape backslashes
      .replace(/"/g, '\\"') // Escape quotes
      .replace(/\n/g, '\\n') // Handle newlines
      .replace(/\r/g, '\\r') // Handle carriage returns
      .replace(/\t/g, '\\t'); // Handle tabs
  }

  private sanitizeField(field: TMFField | undefined | null): TMFField {
    if (!field) {
      return {
        name: '',
        type: '',
        required: false,
        description: '',
      };
    }
    return {
      name: this.sanitizeForJSON(field.name),
      type: this.sanitizeForJSON(field.type),
      required: field.required || false,
      description: this.sanitizeForJSON(field.description),
      subFields: field.subFields?.map(sf => this.sanitizeField(sf)),
      schema: field.schema
    };
  }

  private flattenField(field: TMFField | undefined | null, parentPath: string = ''): Array<{ name: string; type: string; description: string }> {
    if (!field) return [];
    
    const fieldPath = parentPath ? `${parentPath}.${field.name}` : field.name;
    const result = [{
      name: this.sanitizeForJSON(fieldPath),
      type: this.sanitizeForJSON(field.type),
      description: this.sanitizeForJSON(field.description)
    }];

    if (field.subFields) {
      field.subFields.forEach(subField => {
        result.push(...this.flattenField(subField, fieldPath));
      });
    }

    return result;
  }

  private flattenEndpoints(preprocessedDoc: any): FlattenedEndpoint[] {
    const endpoints = preprocessedDoc?.endpoints || [];
    
    // Log the raw endpoints for debugging
    console.log('[DocumentationService] Raw endpoints:', 
      endpoints.map((e: any) => ({
        path: e.path,
        method: e.method,
        fields: e.fields?.length
      }))
    );

    // Filter out any endpoints that don't have required fields
    const validEndpoints = endpoints.filter((endpoint: any) => {
      const isValid = endpoint && 
        typeof endpoint.path === 'string' && 
        endpoint.path.trim() !== '' &&
        typeof endpoint.method === 'string' && 
        endpoint.method.trim() !== '';
      
      if (!isValid) {
        console.log('[DocumentationService] Filtered out invalid endpoint:', endpoint);
      }
      
      return isValid;
    });

    console.log('[DocumentationService] Valid endpoints count:', validEndpoints.length);

    // Map to FlattenedEndpoint format with proper sanitization
    return validEndpoints.map((endpoint: any) => ({
      path: this.sanitizeForJSON(endpoint.path).trim(),
      method: this.sanitizeForJSON(endpoint.method).trim().toUpperCase(),
      description: this.sanitizeForJSON(endpoint.description || ''),
      fields: Array.isArray(endpoint.fields) 
        ? endpoint.fields.flatMap((f: any) => this.flattenField(f))
        : []
    }));
  }

  private async findRelevantEndpoints(
    tmfEndpoint: TMFEndpoint,
    preprocessedDoc: any
  ): Promise<any[]> {
    let flattenedEndpoints: FlattenedEndpoint[] = [];
    
    try {
      // Validate input data
      if (!tmfEndpoint || !preprocessedDoc) {
        throw new Error('Invalid input: TMF endpoint or preprocessed documentation is missing');
      }

      if (!preprocessedDoc.endpoints || !Array.isArray(preprocessedDoc.endpoints)) {
        throw new Error('Invalid preprocessed documentation: endpoints array is missing');
      }

      // First, flatten and sanitize the endpoints to reduce token size
      flattenedEndpoints = this.flattenEndpoints(preprocessedDoc);
      
      console.log('[DocumentationService] Processing endpoints:', {
        tmfEndpoint: {
          path: tmfEndpoint.path,
          method: tmfEndpoint.method,
          fieldCount: tmfEndpoint.specification.fields.length,
          fields: tmfEndpoint.specification.fields.map(f => f.name)
        },
        availableEndpoints: flattenedEndpoints.length,
        sampleEndpoint: flattenedEndpoints[0],
        allEndpoints: flattenedEndpoints.map(e => ({
          path: e.path,
          method: e.method,
          fieldCount: e.fields?.length || 0
        }))
      });

      if (flattenedEndpoints.length === 0) {
        throw new Error('No endpoints available to analyze');
      }

      // Create a more structured and explicit prompt
      const scoringPrompt = `Score these API endpoints for compatibility with a TMF endpoint.

TMF Endpoint Details:
- Path: ${this.sanitizeForJSON(tmfEndpoint.path)}
- Method: ${this.sanitizeForJSON(tmfEndpoint.method)}
- Required Fields: ${tmfEndpoint.specification.fields.filter(f => f.required).map(f => f.name).join(', ')}
- Optional Fields: ${tmfEndpoint.specification.fields.filter(f => !f.required).map(f => f.name).join(', ')}

Available Endpoints to Score (${flattenedEndpoints.length}):
${flattenedEndpoints.map((e, i) => 
  `${i + 1}. ${e.path} [${e.method}]
     Fields: ${(e.fields || []).slice(0, 5).map(f => f.name).join(', ')}${(e.fields?.length || 0) > 5 ? '...' : ''}`
).join('\n')}

Task:
1. Score each endpoint's compatibility (0-100):
   - Path structure similarity (25%)
   - HTTP method match (25%)
   - Field name compatibility (50%)
2. Return a JSON array of scored endpoints
3. Include ALL endpoints with their scores
4. Format: [{"path": string, "method": string, "score": number}]

Example Response:
[
  {"path": "/api/v1/accounts", "method": "POST", "score": 85},
  {"path": "/api/v2/users", "method": "GET", "score": 60}
]

Respond with ONLY the JSON array:`;

      console.log('[DocumentationService] Sending scoring prompt:', {
        promptLength: scoringPrompt.length,
        endpointCount: flattenedEndpoints.length
      });

      const scoringResponse = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a precise API endpoint scoring system. You MUST respond with a valid JSON array containing scored endpoints. Each endpoint MUST have path, method, and score properties. Never include explanatory text."
          },
          {
            role: "user",
            content: scoringPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const content = scoringResponse.choices[0].message?.content?.trim() || '';
      console.log('[DocumentationService] Raw OpenAI response:', content);

      if (!content) {
        console.log('[DocumentationService] Empty OpenAI response, falling back to basic scoring');
        return this.fallbackScoring(tmfEndpoint, flattenedEndpoints, preprocessedDoc);
      }

      let scoredEndpoints;
      try {
        // Try direct JSON parse first
        try {
          scoredEndpoints = JSON.parse(content);
        } catch (e) {
          // If direct parse fails, try to extract JSON array using regex
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (!jsonMatch) {
            console.log('[DocumentationService] No JSON array found in response, falling back to basic scoring');
            return this.fallbackScoring(tmfEndpoint, flattenedEndpoints, preprocessedDoc);
          }
          scoredEndpoints = JSON.parse(jsonMatch[0]);
        }

        // Validate response structure
        if (!Array.isArray(scoredEndpoints)) {
          console.log('[DocumentationService] Response is not an array, falling back to basic scoring');
          return this.fallbackScoring(tmfEndpoint, flattenedEndpoints, preprocessedDoc);
        }

        // Validate and clean each endpoint
        scoredEndpoints = scoredEndpoints.filter(endpoint => {
          const isValid = endpoint && 
            typeof endpoint === 'object' &&
            typeof endpoint.path === 'string' &&
            typeof endpoint.method === 'string' &&
            typeof endpoint.score === 'number' &&
            endpoint.score >= 0 &&  // Allow 0 scores
            endpoint.score <= 100;
          
          if (!isValid) {
            console.warn('[DocumentationService] Filtered out invalid endpoint:', endpoint);
          }
          return isValid;
        });

        console.log('[DocumentationService] Parsed endpoints:', {
          total: scoredEndpoints.length,
          sample: scoredEndpoints[0],
          scores: scoredEndpoints.map(e => ({ path: e.path, score: e.score }))
        });

        // If no valid endpoints found or all scores are 0, try fallback scoring
        if (scoredEndpoints.length === 0 || scoredEndpoints.every(e => e.score === 0)) {
          console.log('[DocumentationService] No valid scored endpoints found, using fallback scoring');
          return this.fallbackScoring(tmfEndpoint, flattenedEndpoints, preprocessedDoc);
        }

      } catch (error) {
        console.error('[DocumentationService] Scoring error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          response: content
        });
        return this.fallbackScoring(tmfEndpoint, flattenedEndpoints, preprocessedDoc);
      }

      // Sort by score and take top 3
      const topEndpoints = scoredEndpoints
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      console.log('[DocumentationService] Selected top endpoints:', 
        topEndpoints.map(e => ({ path: e.path, score: e.score }))
      );

      // Get full endpoint details
      const detailedEndpoints = topEndpoints.map(scored => {
        const fullEndpoint = preprocessedDoc.endpoints.find(
          (e: any) => e.path === scored.path && e.method === scored.method
        );
        return fullEndpoint ? { ...fullEndpoint, score: scored.score } : null;
      }).filter(Boolean);

      if (detailedEndpoints.length === 0) {
        console.log('[DocumentationService] No detailed endpoints found, using fallback scoring');
        return this.fallbackScoring(tmfEndpoint, flattenedEndpoints, preprocessedDoc);
      }

      return detailedEndpoints;

    } catch (error) {
      console.error('[DocumentationService] Error in findRelevantEndpoints:', error);
      return this.fallbackScoring(tmfEndpoint, flattenedEndpoints, preprocessedDoc);
    }
  }

  private fallbackScoring(
    tmfEndpoint: TMFEndpoint,
    flattenedEndpoints: FlattenedEndpoint[],
    preprocessedDoc: any
  ): any[] {
    console.log('[DocumentationService] Starting fallback scoring');
    
    // Add validation check for empty or invalid endpoints
    if (!flattenedEndpoints || flattenedEndpoints.length === 0) {
      console.log('[DocumentationService] No valid endpoints for fallback scoring');
      return [];
    }

    const scoredEndpoints = flattenedEndpoints.map(endpoint => {
      let score = 0;

      // Path similarity (max 40 points)
      const tmfPathParts = tmfEndpoint.path.toLowerCase().split('/').filter(Boolean);
      const endpointPathParts = endpoint.path.toLowerCase().split('/').filter(Boolean);
      const commonPathParts = tmfPathParts.filter(part => endpointPathParts.includes(part));
      score += (commonPathParts.length / Math.max(tmfPathParts.length, endpointPathParts.length)) * 40;

      // Method match (30 points)
      if (endpoint.method.toUpperCase() === tmfEndpoint.method.toUpperCase()) {
        score += 30;
      }

      // Field similarity (max 30 points)
      const tmfFieldNames = tmfEndpoint.specification.fields.map(f => f.name.toLowerCase());
      const endpointFieldNames = (endpoint.fields || []).map(f => f.name.toLowerCase());
      const commonFields = tmfFieldNames.filter(field => endpointFieldNames.includes(field));
      score += (commonFields.length / tmfFieldNames.length) * 30;

      return {
        ...endpoint,
        score: Math.round(score)
      };
    });

    console.log('[DocumentationService] Fallback scoring results:', 
      scoredEndpoints.map(e => ({ path: e.path, method: e.method, score: e.score }))
    );

    // Get top 3 scored endpoints with a minimum score threshold
    const topEndpoints = scoredEndpoints
      .filter(e => e.score >= 30) // Only include endpoints with at least 30% match
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // If no endpoints meet the minimum score threshold, return empty array
    if (topEndpoints.length === 0) {
      console.log('[DocumentationService] No endpoints met minimum score threshold');
      return [];
    }

    // Ensure we have valid endpoints with required fields
    const validEndpoints = topEndpoints.filter(e => e.path && e.method);

    if (validEndpoints.length === 0) {
      console.log('[DocumentationService] No valid endpoints after scoring');
      return [];
    }

    return validEndpoints;
  }

  async analyzeDocumentationWithPreprocessed(
    tmfEndpoint: TMFEndpoint,
    preprocessedDoc: any
  ): Promise<ApiMapping[]> {
    try {
      console.log('[DocumentationService] Starting analysis with preprocessed documentation');

      // First phase: Get most relevant endpoints
      const relevantEndpoints = await this.findRelevantEndpoints(tmfEndpoint, preprocessedDoc);
      console.log('[DocumentationService] Found relevant endpoints:', relevantEndpoints.length);

      // Second phase: Detailed mapping analysis
      const mappingPrompt = `Analyze these TMF and API endpoints to suggest field mappings. Respond with ONLY a JSON object.

TMF Endpoint:
${JSON.stringify({
  path: this.sanitizeForJSON(tmfEndpoint?.path),
  method: this.sanitizeForJSON(tmfEndpoint?.method),
  fields: (tmfEndpoint?.specification?.fields || []).map(field => ({
    ...this.sanitizeField(field),
    subFields: field?.subFields?.map(sf => this.sanitizeField(sf)) || []
  }))
}, null, 2)}

API Endpoints:
${JSON.stringify(relevantEndpoints.map(endpoint => ({
  ...endpoint,
  path: this.sanitizeForJSON(endpoint?.path),
  method: this.sanitizeForJSON(endpoint?.method),
  description: this.sanitizeForJSON(endpoint?.description),
  fields: endpoint?.fields?.map((field: any) => ({
    ...this.sanitizeField(field),
    subFields: field?.subFields?.map((sf: any) => this.sanitizeField(sf)) || []
  })) || []
})), null, 2)}

Required Response Format:
{
  "confidenceScore": number (0-100),
  "reasoning": string,
  "steps": [{
    "endpoint": {
      "path": string,
      "method": string,
      "description": string,
      "matchReason": string,
      "confidenceScore": number
    },
    "outputFields": [{
      "source": string,
      "target": string,
      "transform": string
    }]
  }]
}

Focus on:
1. Field name and type compatibility
2. Required field coverage
3. Nested field structures
4. Semantic similarity`;

      console.log('[DocumentationService] Sending mapping prompt:', {
        promptLength: mappingPrompt.length,
        endpointCount: relevantEndpoints.length
      });

      const mappingResponse = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a precise API mapping assistant. You MUST respond with a valid JSON object following the exact format specified. Never include explanatory text or markdown."
          },
          {
            role: "user",
            content: mappingPrompt
          }
        ],
        temperature: 0.1,  // Lower temperature for more consistent JSON
        max_tokens: 4000
      });

      const content = mappingResponse.choices[0].message?.content?.trim() || '';
      console.log('[DocumentationService] Raw OpenAI response:', content);

      if (!content) {
        return this.generateFallbackMapping(tmfEndpoint, relevantEndpoints);
      }

      let mappings;
      try {
        // Try direct JSON parse first
        try {
          mappings = JSON.parse(content);
        } catch (e) {
          // If direct parse fails, try to extract JSON object using regex
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            console.log('[DocumentationService] No JSON object found in response, using fallback');
            return this.generateFallbackMapping(tmfEndpoint, relevantEndpoints);
          }
          mappings = JSON.parse(jsonMatch[0]);
        }

        // Validate response structure
        if (!this.isValidMappingResponse(mappings)) {
          console.log('[DocumentationService] Invalid mapping response structure, using fallback');
          return this.generateFallbackMapping(tmfEndpoint, relevantEndpoints);
        }

        console.log('[DocumentationService] Analysis complete:', {
          confidenceScore: mappings.confidenceScore,
          stepCount: mappings.steps.length,
          fieldMappings: mappings.steps.reduce((acc: number, step: { outputFields: any[] }) => 
            acc + step.outputFields.length, 0)
        });

        return [mappings];

      } catch (error) {
        console.error('[DocumentationService] Failed to parse mapping response:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          response: content
        });
        return this.generateFallbackMapping(tmfEndpoint, relevantEndpoints);
      }
    } catch (error) {
      console.error('[DocumentationService] Error analyzing documentation:', error);
      throw error;
    }
  }

  private isValidMappingResponse(response: any): boolean {
    // First check basic structure
    if (!response || typeof response !== 'object') {
      console.log('[DocumentationService] Invalid response: not an object');
      return false;
    }

    // Check confidence score
    if (typeof response.confidenceScore !== 'number' || 
        response.confidenceScore < 0 || 
        response.confidenceScore > 100) {
      console.log('[DocumentationService] Invalid response: invalid confidence score');
      return false;
    }

    // Check reasoning
    if (typeof response.reasoning !== 'string' || !response.reasoning) {
      console.log('[DocumentationService] Invalid response: missing or invalid reasoning');
      return false;
    }

    // Check steps array
    if (!Array.isArray(response.steps) || response.steps.length === 0) {
      console.log('[DocumentationService] Invalid response: missing or empty steps array');
      return false;
    }

    // Validate each step
    return response.steps.every((step: any, index: number) => {
      // Check endpoint
      if (!step.endpoint || 
          typeof step.endpoint.path !== 'string' || 
          typeof step.endpoint.method !== 'string') {
        console.log(`[DocumentationService] Invalid step ${index}: invalid endpoint`);
        return false;
      }

      // Check output fields
      if (!Array.isArray(step.outputFields) || step.outputFields.length === 0) {
        console.log(`[DocumentationService] Invalid step ${index}: missing or empty outputFields`);
        return false;
      }

      // Check each field mapping
      return step.outputFields.every((field: any, fieldIndex: number) => {
        const isValid = typeof field.source === 'string' && 
                       typeof field.target === 'string' &&
                       field.source.trim() !== '' &&
                       field.target.trim() !== '';
        
        if (!isValid) {
          console.log(`[DocumentationService] Invalid field mapping in step ${index}, field ${fieldIndex}`);
        }
        
        return isValid;
      });
    });
  }

  private generateFallbackMapping(tmfEndpoint: TMFEndpoint, relevantEndpoints: any[]): ApiMapping[] {
    console.log('[DocumentationService] Generating fallback mapping');

    if (relevantEndpoints.length === 0) {
      console.log('[DocumentationService] No relevant endpoints available for fallback mapping');
      // Return a minimal valid mapping structure
      return [{
        confidenceScore: 0,
        reasoning: 'No relevant endpoints found',
        steps: [{
          endpoint: {
            path: tmfEndpoint.path,  // Use TMF endpoint path as fallback
            method: tmfEndpoint.method,  // Use TMF endpoint method as fallback
            description: 'No matching endpoint found',
            matchReason: 'No relevant endpoints available',
            confidenceScore: 0
          },
          outputFields: [{
            source: 'placeholder_field',
            target: tmfEndpoint.specification.fields[0]?.name || 'unknown_field',
            transform: 'manual_required'
          }]
        }]
      }];
    }

    // Take the highest scored endpoint
    const bestEndpoint = relevantEndpoints[0];
    console.log('[DocumentationService] Using best endpoint for fallback:', {
      path: bestEndpoint.path,
      method: bestEndpoint.method,
      fieldCount: bestEndpoint.fields?.length
    });

    // Validate best endpoint has required fields
    if (!bestEndpoint.path || !bestEndpoint.method) {
      console.error('[DocumentationService] Invalid best endpoint:', bestEndpoint);
      throw new Error('Best endpoint is missing required fields (path or method)');
    }
    
    // Generate simple field mappings based on name similarity
    const fieldMappings = tmfEndpoint.specification.fields
      .map(tmfField => {
        // Try exact match first
        let matchingField = bestEndpoint.fields?.find((f: any) => 
          f.name.toLowerCase() === tmfField.name.toLowerCase()
        );

        // If no exact match, try partial matches
        if (!matchingField) {
          matchingField = bestEndpoint.fields?.find((f: any) => 
            f.name.toLowerCase().includes(tmfField.name.toLowerCase()) ||
            tmfField.name.toLowerCase().includes(f.name.toLowerCase())
          );
        }

        if (matchingField) {
          return {
            source: matchingField.name.trim(),  // Ensure trimmed values
            target: tmfField.name.trim(),
            transform: matchingField.type === tmfField.type ? 'direct' : 'type_conversion'
          };
        }
        
        // If no match found for a required field, create a placeholder mapping
        if (tmfField.required) {
          return {
            source: `placeholder_${tmfField.name.trim()}`,
            target: tmfField.name.trim(),
            transform: 'manual_required'
          };
        }
        
        return undefined;
      })
      .filter((mapping): mapping is { source: string; target: string; transform: string } => 
        mapping !== undefined
      );

    // Ensure we have at least one field mapping
    if (fieldMappings.length === 0) {
      console.log('[DocumentationService] No field mappings found, creating placeholder mapping');
      fieldMappings.push({
        source: 'placeholder_field',
        target: tmfEndpoint.specification.fields[0]?.name?.trim() || 'unknown_field',
        transform: 'manual_required'
      });
    }

    const mapping: ApiMapping = {
      confidenceScore: Math.min(bestEndpoint.score || 30, 100),
      reasoning: `Fallback mapping based on field name similarity. Found ${fieldMappings.length} potential field matches.`,
      steps: [{
        endpoint: {
          path: bestEndpoint.path.trim(),  // Ensure trimmed values
          method: bestEndpoint.method.trim().toUpperCase(),  // Normalize method
          description: bestEndpoint.description?.trim() || '',
          matchReason: 'Best matching endpoint based on path and method similarity',
          confidenceScore: bestEndpoint.score || 30,
          parameters: bestEndpoint.parameters || [],
          responses: bestEndpoint.responses || {}
        },
        outputFields: fieldMappings
      }]
    };

    console.log('[DocumentationService] Generated fallback mapping:', {
      confidenceScore: mapping.confidenceScore,
      fieldCount: fieldMappings.length,
      sampleFields: fieldMappings.slice(0, 3).map(f => ({ source: f.source, target: f.target })),
      endpoint: {
        path: mapping.steps[0].endpoint.path,
        method: mapping.steps[0].endpoint.method
      }
    });

    return [mapping];
  }
}

export const documentationService = new DocumentationService(); 