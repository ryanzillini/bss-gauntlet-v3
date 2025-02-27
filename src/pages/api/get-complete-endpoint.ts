import { NextApiRequest, NextApiResponse } from 'next';
import { documentationService } from '../../services/DocumentationService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { docId, endpointId, method } = req.query;
    console.log('[get-complete-endpoint] Request received for docId:', docId, 'endpointId:', endpointId, 'method:', method);

    if (!docId || typeof docId !== 'string') {
      console.error('[get-complete-endpoint] Missing or invalid docId parameter:', docId);
      return res.status(400).json({ 
        error: 'Missing or invalid docId parameter'
      });
    }

    if (!endpointId || typeof endpointId !== 'string') {
      console.error('[get-complete-endpoint] Missing or invalid endpointId parameter:', endpointId);
      return res.status(400).json({ 
        error: 'Missing or invalid endpointId parameter'
      });
    }

    // First try to get raw documentation with config using DocumentationService
    console.log('[get-complete-endpoint] Fetching documentation using DocumentationService for docId:', docId);
    
    // Get parsed endpoints to find the endpoint ID
    const documentation = await documentationService.getDocumentationById(docId);
    
    if (!documentation || !documentation.endpoints) {
      console.error('[get-complete-endpoint] No endpoints found in parsed documentation');
      return res.status(404).json({ error: 'Endpoints not found in parsed documentation' });
    }
    
    // Find the specific endpoint requested
    let completeEndpoint: any = null;
    
    // Check if method was explicitly specified
    const requestedMethod = typeof method === 'string' ? 
      method.toLowerCase() === 'query' ? 'GET' :
      method.toLowerCase() === 'mutation' ? 'POST' :
      method.toUpperCase() : "undefined";
    
    console.log('[get-complete-endpoint] Searching for endpoint with path:', endpointId, 'and method:', requestedMethod);
    
    // First try to find by path and explicitly requested method
    completeEndpoint = documentation.endpoints.find((endpoint: any) => 
      endpoint.path === endpointId && 
      endpoint.method.toUpperCase() === requestedMethod);
    
    // If not found, try other matching strategies
    if (!completeEndpoint) {
      console.log('[get-complete-endpoint] Endpoint not found by path and method, trying alternative approaches');
      
      // Try to find by ID
      completeEndpoint = documentation.endpoints.find((endpoint: any) => endpoint.id === endpointId);
      
      // If still not found, try parsing endpointId for combined method-path format
      if (!completeEndpoint) {
        const parts = endpointId.split('-');
        if (parts.length > 1) {
          const methodFromId = parts[0];
          const pathFromId = parts.slice(1).join('-');
          completeEndpoint = documentation.endpoints.find((endpoint: any) => 
            endpoint.path === pathFromId && 
            endpoint.method.toUpperCase() === methodFromId.toUpperCase());
        }
      }
      
      // If still not found, just find any endpoint matching the path
      if (!completeEndpoint) {
        console.log('[get-complete-endpoint] Trying to find any endpoint matching path:', endpointId);
        
        // Get all endpoints with matching path to show available methods
        const matchingEndpoints = documentation.endpoints.filter((endpoint: any) => 
          endpoint.path === endpointId);
        
        if (matchingEndpoints.length > 0) {
          console.log('[get-complete-endpoint] Found', matchingEndpoints.length, 
            'endpoints with matching path. Available methods:', 
            matchingEndpoints.map((e: any) => e.method).join(', '));
          
          // Default to GET if available, otherwise take the first one
          completeEndpoint = matchingEndpoints.find((e: any) => 
            e.method.toUpperCase() === 'GET') || matchingEndpoints[0];
          
          console.log('[get-complete-endpoint] Selected endpoint with method:', completeEndpoint.method);
        }
      }
    }
    
    if (!completeEndpoint) {
      console.error('[get-complete-endpoint] Endpoint not found:', endpointId);
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    // Extract endpoint-specific data from config
    let endpointConfig: any = null;
    
    if (documentation.rawConfig) {
      console.log('[get-complete-endpoint] Attempting to extract endpoint-specific data from rawConfig');
      
      const rawConfig = documentation.rawConfig;
      const endpointPath = completeEndpoint.path;
      const endpointMethod = completeEndpoint.method.toLowerCase();
      
      try {
        // For OpenAPI/Swagger format
        if (rawConfig.paths && rawConfig.paths[endpointPath]) {
          const pathData = rawConfig.paths[endpointPath];
          if (pathData[endpointMethod]) {
            console.log('[get-complete-endpoint] Found endpoint in OpenAPI paths');
            
            // Extract only the relevant parts
            endpointConfig = {
              pathData: pathData[endpointMethod],
              // Include only necessary schemas
              schemas: {}
            };
            
            // Extract schemas referenced by this endpoint
            if (rawConfig.components && rawConfig.components.schemas) {
              // Function to extract schema references from an object
              const extractRefs = (obj: any, refs: Set<string>) => {
                if (!obj) return;
                
                if (typeof obj === 'object') {
                  if (obj.$ref && typeof obj.$ref === 'string') {
                    const parts = obj.$ref.split('/');
                    const schemaName = parts[parts.length - 1];
                    refs.add(schemaName);
                  }
                  
                  for (const key in obj) {
                    extractRefs(obj[key], refs);
                  }
                }
              };
              
              // Get all references
              const schemaRefs = new Set<string>();
              extractRefs(pathData[endpointMethod], schemaRefs);
              
              // Add referenced schemas
              schemaRefs.forEach(schemaName => {
                if (rawConfig.components.schemas[schemaName]) {
                  endpointConfig.schemas[schemaName] = rawConfig.components.schemas[schemaName];
                }
              });
            }
          }
        } 
        // For TMF API format
        else if (rawConfig.resources) {
          console.log('[get-complete-endpoint] Checking TMF resources');
          // First try to find a resource definition for this specific endpoint
          if (Array.isArray(rawConfig.resources)) {
            // Find the resource that might contain this endpoint
            const resourceName = endpointPath.split('/')[0]?.split('{')[0];
            if (resourceName) {
              console.log('[get-complete-endpoint] Looking for resource:', resourceName);
              
              // Try different approaches to find the matching resource
              for (const resource of rawConfig.resources) {
                if (resource.name === resourceName || resource.plural === resourceName) {
                  console.log('[get-complete-endpoint] Found TMF resource:', resourceName);
                  
                  // Check if there's a specific endpoint definition for this path and method
                  if (resource.endpoints && Array.isArray(resource.endpoints)) {
                    const specificEndpoint = resource.endpoints.find((e: any) => 
                      e.path === endpointPath && e.method.toLowerCase() === endpointMethod);
                    
                    if (specificEndpoint) {
                      console.log('[get-complete-endpoint] Found specific endpoint in resource definition');
                      endpointConfig = {
                        resource: resource,
                        specificEndpoint: specificEndpoint
                      };
                      break;
                    }
                  }
                  
                  // If no specific endpoint found, just use the resource
                  if (!endpointConfig) {
                    endpointConfig = {
                      resource: resource
                    };
                  }
                  break;
                }
              }
            }
          }
        }
        // For GraphQL
        else if (rawConfig.types && completeEndpoint.graphqlType) {
          const type = rawConfig.types.find((t: any) => 
            t.name === completeEndpoint.graphqlType);
            
          if (type) {
            console.log('[get-complete-endpoint] Found GraphQL type:', completeEndpoint.graphqlType);
            endpointConfig = {
              type: type
            };
          }
        }
        
        if (!endpointConfig) {
          console.log('[get-complete-endpoint] Could not extract specific endpoint config, using basic endpoint data');
          endpointConfig = {
            basicData: {
              path: completeEndpoint.path,
              method: completeEndpoint.method,
              description: completeEndpoint.description
            }
          };
        }
      } catch (error) {
        console.error('[get-complete-endpoint] Error extracting endpoint config:', error);
        endpointConfig = { 
          error: 'Failed to extract endpoint config',
          basicData: completeEndpoint
        };
      }
    }
    
    // Add the extracted config to the endpoint
    const enrichedEndpoint = {
      ...completeEndpoint,
      configData: endpointConfig
    };
    
    console.log('[get-complete-endpoint] Found complete endpoint with filtered config data. Keys:', 
      Object.keys(enrichedEndpoint), 'Method:', enrichedEndpoint.method);

    // Return the endpoint with only the relevant config data
    return res.status(200).json({
      success: true,
      endpoint: enrichedEndpoint
    });

  } catch (error) {
    console.error('[get-complete-endpoint] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch complete endpoint data'
    });
  }
} 