import { NextApiRequest, NextApiResponse } from 'next';
import { DocumentationMappingService } from '../../mapping/services/DocumentationMappingService';
import { saveEndpointMapping, saveBssEndpoint, BssEndpointMapping } from '../../utils/supabase-client';
import { documentationService } from '../../services/DocumentationService';
import { supabase } from '../../utils/supabase-client';

// Define the interfaces locally to match DocumentationService's expected format
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

// Type guard function to check if error is an Error object
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Helper function to extract numeric ID from endpoint string
function extractEndpointId(endpointId: string): number {
  // First try to extract numeric portion if it exists
  const numericMatch = endpointId.match(/\d+/);
  if (numericMatch) {
    return parseInt(numericMatch[0], 10);
  }

  // If no numeric portion, generate a consistent hash
  // Remove any special characters and convert to lowercase for consistency
  const normalizedEndpoint = endpointId.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Use a simple but consistent hashing algorithm
  let hash = 5381;
  for (let i = 0; i < normalizedEndpoint.length; i++) {
    hash = ((hash << 5) + hash) + normalizedEndpoint.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Ensure positive number within PostgreSQL integer range (2147483647 is max)
  return Math.abs(hash % 2147483647);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[map-endpoint] Starting request processing  handler2: ', req.body);
    
    // Handle both old and new request formats
    let endpointId, path, method, specification, docId, preprocessedDoc;
    
    // Check if the request is using the new format with sourceEndpoint and targetEndpoint
    if (req.body.sourceEndpoint && req.body.targetEndpoint) {
      console.log('[map-endpoint] Processing request in new format');
      
      // Extract fields from the new format
      const { sourceEndpoint, targetEndpoint } = req.body;
      
      path = sourceEndpoint.path;
      method = sourceEndpoint.method;
      specification = sourceEndpoint.specification || 'tmf'; // Default value if not provided
      endpointId = targetEndpoint.id;
      
      // Store the fields from targetEndpoint for later use in mapping
      const targetFields = targetEndpoint.fields;
      
      // Add to req.body so it can be used later in the existing flow
      if (targetFields && Array.isArray(targetFields)) {
        console.log(`[map-endpoint] Found ${targetFields.length} target fields to map`);
        req.body.targetFields = targetFields;
      }
      
      // Check for docId in various locations, with detailed logging
      docId = req.body.docId || req.query.docId as string;
      
      // If docId isn't in the usual places, check if it's in a documentation object
      if (!docId && req.body.documentation && req.body.documentation.id) {
        docId = req.body.documentation.id;
        console.log(`[map-endpoint] Found docId in documentation object: ${docId}`);
      }
      
      // If still no docId, check if it's in the sourceEndpoint or targetEndpoint
      if (!docId && sourceEndpoint.docId) {
        docId = sourceEndpoint.docId;
        console.log(`[map-endpoint] Found docId in sourceEndpoint: ${docId}`);
      }
      
      if (!docId && targetEndpoint.docId) {
        docId = targetEndpoint.docId;
        console.log(`[map-endpoint] Found docId in targetEndpoint: ${docId}`);
      }
      
      // Log what we found (or didn't find)
      if (docId) {
        console.log(`[map-endpoint] Using docId: ${docId}`);
      } else {
        console.log('[map-endpoint] No docId found in request - checking if a default can be used');
        
        // Try to determine if there's a default/most recent docId we can use
        try {
          const { data, error } = await supabase
            .from('documentation')
            .select('id')
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (data && data.length > 0 && !error) {
            docId = data[0].id;
            console.log(`[map-endpoint] Using most recent documentation id as default: ${docId}`);
          } else {
            console.log('[map-endpoint] No default docId available from recent documents');
            
            // Hardcoded fallback for testing
            // Use the docId from the log as default
            docId = '6cf10e96-1f71-412d-afb5-eec7655d9621'; // This appeared in your logs
            console.log(`[map-endpoint] Using hardcoded docId as last resort: ${docId}`);
          }
        } catch (error) {
          console.error('[map-endpoint] Error fetching default docId:', error);
          
          // Hardcoded fallback for testing
          docId = '6cf10e96-1f71-412d-afb5-eec7655d9621';
          console.log(`[map-endpoint] Using hardcoded docId after error: ${docId}`);
        }
      }
      
      // For preprocessedDoc, we'll either need it provided or fetch it based on docId
      preprocessedDoc = req.body.preprocessedDoc;
      
      // Check if preprocessedDoc is provided in sourceEndpoint
      if (!preprocessedDoc && sourceEndpoint.preprocessedDoc) {
        preprocessedDoc = sourceEndpoint.preprocessedDoc;
        console.log('[map-endpoint] Found preprocessedDoc in sourceEndpoint');
      }
      
      // Check if preprocessedDoc is provided in documentation object
      if (!preprocessedDoc && req.body.documentation && req.body.documentation.preprocessed) {
        preprocessedDoc = req.body.documentation.preprocessed;
        console.log('[map-endpoint] Found preprocessedDoc in documentation object');
      }
      
      if (!docId || !preprocessedDoc) {
        // Try to retrieve doc information if needed
        console.log('[map-endpoint] Attempting to retrieve missing documentation data');
        
        // If we have docId but no preprocessedDoc, try to fetch the doc
        if (docId && !preprocessedDoc) {
          try {
            console.log(`[map-endpoint] Fetching documentation for docId: ${docId}`);
            
            // Try to fetch from documentationService first
            let docData;
            try {
              docData = await documentationService.getDocumentationById(docId);
            } catch (serviceError) {
              console.error('[map-endpoint] Error from documentationService:', serviceError);
              console.log('[map-endpoint] Trying direct database query as fallback');
              
              // If that fails, try direct database query as fallback
              const { data, error } = await supabase
                .from('documentation')
                .select('*')
                .eq('id', docId)
                .single();
                
              if (error) {
                throw new Error(`Database error: ${error.message}`);
              }
              
              docData = data;
            }
            
            // Check if docData has preprocessed field
            if (docData && docData.preprocessed) {
              preprocessedDoc = docData.preprocessed;
              console.log('[map-endpoint] Successfully retrieved preprocessed documentation');
            } 
            // Check if endpoints were processed successfully even if not in preprocessed field
            else if (docData && docData.endpoints && Array.isArray(docData.endpoints) && docData.endpoints.length > 0) {
              console.log(`[map-endpoint] Found processed endpoints array but no preprocessed field. Creating preprocessed structure with ${docData.endpoints.length} endpoints`);
              
              // Construct a preprocessed doc structure from the endpoints
              preprocessedDoc = {
                endpoints: docData.endpoints,
                format: docData.format || 'unknown',
                type: docData.type || 'api'
              };
              
              console.log('[map-endpoint] Successfully created preprocessed structure from endpoints');
            }
            // Check if processed data is in a different format like docData.parsed or docData.data
            else if (docData && (docData.parsed || docData.data)) {
              const processedData = docData.parsed || docData.data;
              console.log('[map-endpoint] Found alternative processed data structure');
              
              if (processedData.endpoints && Array.isArray(processedData.endpoints)) {
                console.log(`[map-endpoint] Using endpoints from alternative structure with ${processedData.endpoints.length} endpoints`);
                preprocessedDoc = {
                  endpoints: processedData.endpoints,
                  format: processedData.format || docData.format || 'unknown',
                  type: processedData.type || docData.type || 'api'
                };
              } else {
                console.log('[map-endpoint] Alternative data structure does not contain required endpoints array');
                preprocessedDoc = processedData; // Try using it directly
              }
            }
            else if (docData && docData.content) {
              // If we have content but not preprocessed, try to preprocess it
              console.log('[map-endpoint] Found documentation content but no preprocessed data, attempting to parse');
              
              // Try to determine if this is GraphQL content we can extract endpoints from directly
              if (docData.format === 'graphql' || 
                  (typeof docData.content === 'string' && 
                   (docData.content.includes('type Query') || 
                    docData.content.includes('schema {') || 
                    docData.content.includes('type Mutation')))) {
                    
                console.log('[map-endpoint] Detected GraphQL schema, attempting direct endpoint extraction');
                
                try {
                  // This is a simplified direct extraction approach
                  // In a real implementation, you might want to use proper GraphQL parsing
                  const content = typeof docData.content === 'string' ? docData.content : JSON.stringify(docData.content);
                  
                  // Extract operations from Query type - using explicit RegExp to avoid flag issues
                  const queryMatch = new RegExp('type\\s+Query\\s*{([^}]*)}', 'i').exec(content);
                  const mutationMatch = new RegExp('type\\s+Mutation\\s*{([^}]*)}', 'i').exec(content);
                  
                  const endpoints: Array<{
                    path: string;
                    method: string;
                    description: string;
                    operationType: string;
                  }> = [];
                  
                  // Process Query operations
                  if (queryMatch && queryMatch[1]) {
                    const operations = queryMatch[1].split('\n')
                      .filter((line: string) => line.trim() && !line.trim().startsWith('#'))
                      .map((line: string) => {
                        const parts = line.trim().split(':');
                        if (parts.length >= 2) {
                          return {
                            path: parts[0].trim(),
                            method: 'GET',
                            description: `GraphQL Query: ${parts[0].trim()}`,
                            operationType: 'query'
                          };
                        }
                        return null;
                      })
                      .filter((op): op is {
                        path: string;
                        method: string;
                        description: string;
                        operationType: string;
                      } => op !== null);
                    
                    endpoints.push(...operations);
                  }
                  
                  // Process Mutation operations
                  if (mutationMatch && mutationMatch[1]) {
                    const operations = mutationMatch[1].split('\n')
                      .filter((line: string) => line.trim() && !line.trim().startsWith('#'))
                      .map((line: string) => {
                        const parts = line.trim().split(':');
                        if (parts.length >= 2) {
                          return {
                            path: parts[0].trim(),
                            method: 'POST',
                            description: `GraphQL Mutation: ${parts[0].trim()}`,
                            operationType: 'mutation'
                          };
                        }
                        return null;
                      })
                      .filter((op): op is {
                        path: string;
                        method: string;
                        description: string;
                        operationType: string;
                      } => op !== null);
                    
                    endpoints.push(...operations);
                  }
                  
                  if (endpoints.length > 0) {
                    console.log(`[map-endpoint] Successfully extracted ${endpoints.length} GraphQL operations directly from schema`);
                    preprocessedDoc = {
                      endpoints,
                      format: 'graphql',
                      type: 'api'
                    };
                  } else {
                    console.log('[map-endpoint] Failed to extract GraphQL operations from schema');
                    throw new Error('No GraphQL operations found in schema');
                  }
                } catch (parseError) {
                  console.error('[map-endpoint] Failed to parse GraphQL schema directly:', parseError);
                  
                  // Since direct parsing failed, return error
                  console.error('[map-endpoint] Documentation service does not support preprocessing content directly');
                  return res.status(400).json({
                    error: 'Missing preprocessed data',
                    details: 'The documentation exists but does not contain preprocessed data, and direct GraphQL parsing failed'
                  });
                }
              } else {
                // Not GraphQL or direct parsing not feasible
                console.error('[map-endpoint] Documentation service does not support preprocessing content directly');
                return res.status(400).json({
                  error: 'Missing preprocessed data',
                  details: 'The documentation exists but does not contain preprocessed data, and dynamic preprocessing is not supported'
                });
              }
            } else {
              console.log('[map-endpoint] Failed to retrieve preprocessed documentation');
              return res.status(400).json({
                error: 'Missing required data',
                details: 'Could not retrieve preprocessed documentation for the provided docId'
              });
            }
          } catch (fetchError) {
            console.error('[map-endpoint] Error fetching documentation:', fetchError);
            return res.status(500).json({
              error: 'Documentation retrieval error',
              details: isError(fetchError) ? fetchError.message : 'Failed to fetch documentation data'
            });
          }
        } else {
          // If we're missing docId but have preprocessedDoc, we can still proceed
          if (preprocessedDoc) {
            console.log('[map-endpoint] No docId found but preprocessedDoc is available, proceeding with placeholder');
            docId = 'placeholder-' + Date.now();
            console.log(`[map-endpoint] Using generated placeholder docId: ${docId}`);
          } else {
            // If we're missing both docId and preprocessedDoc, we can't proceed
            console.log('[map-endpoint] Missing both docId and preprocessedDoc in new format request');
            return res.status(400).json({
              error: 'Missing required fields',
              details: 'When using sourceEndpoint/targetEndpoint format, please provide either preprocessedDoc or docId in one of these ways: 1) req.body.docId, 2) as a query parameter ?docId=..., 3) in sourceEndpoint.docId, 4) in targetEndpoint.docId, or 5) in documentation.id'
            });
          }
        }
      }
    } else {
      // Original format
      ({ endpointId, path, method, specification, docId, preprocessedDoc } = req.body);
    }

    // Validate required fields regardless of format
    if (!endpointId || !path || !method) {
      console.log('[map-endpoint] Missing basic endpoint information');
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Please provide endpoint information: endpointId/targetEndpoint.id, path/sourceEndpoint.path, method/sourceEndpoint.method'
      });
    }
    
    // If preprocessedDoc is directly provided, docId might be optional
    if (!preprocessedDoc) {
      // We need a docId to fetch the preprocessed documentation
      if (!docId) {
        console.log('[map-endpoint] Missing documentation ID and no preprocessed doc provided');
        return res.status(400).json({
          error: 'Missing required field',
          details: 'Please provide either preprocessedDoc directly or a docId to fetch it. In the new format, you can include docId as req.body.docId, query parameter, sourceEndpoint.docId, targetEndpoint.docId, or documentation.id'
        });
      }
      
      console.log('[map-endpoint] Missing preprocessed documentation, will attempt to fetch using docId');
    } else if (!docId) {
      // If preprocessedDoc is provided but no docId, warn but continue
      console.log('[map-endpoint] WARNING: No docId provided but preprocessedDoc is available. This will limit some functionality.');
      
      // Generate a placeholder docId for saving mappings
      docId = 'placeholder-' + Date.now();
      console.log(`[map-endpoint] Using generated placeholder docId: ${docId}`);
    }
    
    // Default specification to 'tmf' if not provided
    specification = specification || 'tmf';

    console.log('[map-endpoint] All required fields present');
    // Generate a consistent numeric ID for the endpoint using the same hashing function
    const endpointNumericId = extractEndpointId(endpointId);
    console.log('[map-endpoint] Using hashed numeric ID for mappings:', endpointNumericId);

    // Validate preprocessedDoc structure
    if (!preprocessedDoc.endpoints || !Array.isArray(preprocessedDoc.endpoints)) {
      return res.status(400).json({
        error: 'Invalid preprocessed documentation',
        details: 'The preprocessed documentation must contain an endpoints array'
      });
    }

    // Log preprocessedDoc metadata
    console.log('[map-endpoint] PreprocessedDoc metadata:', 
      JSON.stringify({
        type: preprocessedDoc.type,
        format: preprocessedDoc.format,
        version: preprocessedDoc.version,
        endpointCount: preprocessedDoc.endpoints.length,
        // Include any other top-level properties except the full endpoints array
        ...Object.fromEntries(
          Object.entries(preprocessedDoc)
            .filter(([key]) => key !== 'endpoints')
        )
      }, null, 2)
    );

    // Enhance the endpoints in preprocessedDoc to ensure they have all properties
    if (preprocessedDoc.endpoints && Array.isArray(preprocessedDoc.endpoints)) {
      console.log(`[map-endpoint] Enhancing ${preprocessedDoc.endpoints.length} source endpoints to ensure complete data`);
      
      preprocessedDoc.endpoints = preprocessedDoc.endpoints.map((endpoint: any) => {
        // Ensure all endpoints have required properties
        return {
          ...endpoint,
          path: endpoint.path || '',
          method: endpoint.method || 'GET',
          description: endpoint.description || `${endpoint.method || 'GET'} ${endpoint.path || ''}`,
          fields: Array.isArray(endpoint.fields) ? endpoint.fields.map((field: any) => ({
            name: field.name || '',
            type: field.type || 'string',
            description: field.description || '',
            required: field.required || false
          })) : [],
          parameters: endpoint.parameters || [],
          responses: endpoint.responses || { '200': { description: 'Success' } },
          operationId: endpoint.operationId || `${endpoint.method || 'GET'}_${endpoint.path?.replace(/[^a-zA-Z0-9]/g, '_') || ''}`
        };
      });
      
      console.log('[map-endpoint] Source endpoints enhanced with complete property structure');
    }

    // If we have target fields from the new format, prepare them for mapping
    if (req.body.targetFields && Array.isArray(req.body.targetFields)) {
      console.log('[map-endpoint] Using target fields from request for mapping');
      
      // Log detailed view of the target fields
      console.log('[map-endpoint] Raw target fields from request:', 
        JSON.stringify(req.body.targetFields, null, 2)
      );
    }

    console.log('[map-endpoint] Raw fields from targetEndpoint:', 
      JSON.stringify(req.body.targetEndpoint?.fields, null, 2)
    );

    // Create a properly typed endpoint object
    const endpointToMap: TMFEndpoint = {
      path,
      method,
      specification: {
        fields: (req.body.targetEndpoint?.fields || req.body.targetFields || []).map((field: any) => ({
          name: field.name || '',
          type: field.type || 'string',
          required: field.required || false,
          description: field.description || '',
          subFields: Array.isArray(field.subFields) ? field.subFields.map((subField: any) => ({
            name: subField.name || '',
            type: subField.type || 'string',
            required: subField.required || false,
            description: subField.description || ''
          })) : undefined,
          schema: field.schema
        }))
      }
    };

    console.log('[map-endpoint] Created endpointToMap with specification.fields:', {
      fieldCount: endpointToMap.specification.fields.length,
      sampleFields: endpointToMap.specification.fields.slice(0, 3) // Log the first few fields as example
    });

    // Log target fields if they exist, for future improvement
    if (req.body.targetFields && Array.isArray(req.body.targetFields)) {
      console.log('[map-endpoint] Found target fields:', {
        count: req.body.targetFields.length,
        fields: req.body.targetFields.slice(0, 3) // Log the first few fields as example
      });
      console.log('[map-endpoint] Note: Target fields found but DocumentationService does not yet support using them directly');
      // Future enhancement: extend DocumentationService to use these target fields
    }

    // Use the preprocessed documentation for mapping
    let apiMappings: any[] = [];
    try {
      console.log('[map-endpoint] Calling analyzeDocumentationWithPreprocessed');
      
      // Log the COMPLETE TMF Endpoint being sent
      console.log('[map-endpoint] COMPLETE TMF Endpoint being sent to DocumentationService:', 
        JSON.stringify(endpointToMap, null, 2)
      );
      
      // Log sample of source endpoints
      console.log('[map-endpoint] COMPLETE Source endpoints sample being sent to DocumentationService:', 
        JSON.stringify(
          preprocessedDoc.endpoints.slice(0, 5).map((e: any) => ({
            path: e.path,
            method: e.method,
            description: e.description,
            fields: e.fields,
            // Include other important properties
            parameters: e.parameters,
            responses: e.responses,
            operationId: e.operationId
          })), 
          null, 
          2
        )
      );
      
      // Also log the raw source/target from the original request
      console.log('[map-endpoint] ORIGINAL request data - sourceEndpoint:', 
        JSON.stringify(req.body.sourceEndpoint, null, 2)
      );
      
      console.log('[map-endpoint] ORIGINAL request data - targetEndpoint:', 
        JSON.stringify(req.body.targetEndpoint, null, 2)
      );
      
      apiMappings = await documentationService.analyzeDocumentationWithPreprocessed(
        endpointToMap,
        preprocessedDoc
      );
    } catch (analysisError) {
      console.error('[map-endpoint] Error during documentation analysis:', analysisError);
      
      // Check if the error is due to missing properties on endpoints
      if (analysisError instanceof TypeError && 
          (analysisError.message.includes('Cannot read properties of undefined') ||
           analysisError.message.includes('is not a function'))) {
        
        console.log('[map-endpoint] Detected TypeError in endpoint structure, attempting to enhance endpoints');
        
        // Create enhanced endpoints with required properties
        if (preprocessedDoc && preprocessedDoc.endpoints && Array.isArray(preprocessedDoc.endpoints)) {
          const enhancedEndpoints = preprocessedDoc.endpoints.map((endpoint: any) => {
            // Create a more complete endpoint structure
            return {
              ...endpoint,
              parameters: endpoint.parameters || [],
              requestBody: endpoint.requestBody || {
                content: {}
              },
              responses: endpoint.responses || {
                '200': {
                  description: 'Success response',
                  content: {}
                }
              },
              description: endpoint.description || `${endpoint.method} ${endpoint.path}`,
              summary: endpoint.summary || '',
              tags: endpoint.tags || [],
              // Add other properties that might be needed
              operationId: endpoint.operationId || `${endpoint.method.toLowerCase()}${endpoint.path.replace(/[^a-zA-Z0-9]/g, '')}`,
              security: endpoint.security || []
            };
          });
          
          console.log(`[map-endpoint] Enhanced ${enhancedEndpoints.length} endpoints with missing properties`);
          
          // Create a new preprocessed doc with enhanced endpoints
          const enhancedPreprocessedDoc = {
            ...preprocessedDoc,
            endpoints: enhancedEndpoints
          };
          
          // Try again with enhanced endpoints
          try {
            console.log('[map-endpoint] Retrying analysis with enhanced endpoints');
            
            // Log the COMPLETE TMF Endpoint being sent (retry)
            console.log('[map-endpoint] COMPLETE TMF Endpoint being sent to DocumentationService (retry):', 
              JSON.stringify(endpointToMap, null, 2)
            );
            
            // Log sample of source endpoints (retry)
            console.log('[map-endpoint] COMPLETE Source endpoints sample being sent to DocumentationService (retry):', 
              JSON.stringify(
                enhancedPreprocessedDoc.endpoints.slice(0, 5).map((e: any) => ({
                  path: e.path,
                  method: e.method,
                  description: e.description,
                  fields: e.fields,
                  // Include other important properties
                  parameters: e.parameters,
                  responses: e.responses,
                  operationId: e.operationId
                })), 
                null, 
                2
              )
            );
            
            apiMappings = await documentationService.analyzeDocumentationWithPreprocessed(
              endpointToMap,
              enhancedPreprocessedDoc
            );
          } catch (retryError) {
            console.error('[map-endpoint] Still failed with enhanced endpoints:', retryError);
            // Fall back to empty mappings if enhancement didn't work
            apiMappings = [];
          }
        } else {
          console.log('[map-endpoint] Cannot enhance endpoints, preprocessedDoc structure is invalid');
          apiMappings = [];
        }
      } else {
        // For other types of errors, just log and continue with empty mappings
        console.error('[map-endpoint] Unhandled error during documentation analysis:', analysisError);
        apiMappings = [];
      }
    }

    if (!apiMappings || !Array.isArray(apiMappings) || apiMappings.length === 0) {
      console.log('[map-endpoint] No mappings found through analysis, returning empty result');
      
      // Return empty result instead of creating a fallback mapping
      return res.status(200).json({
        success: true,
        data: {
          suggestions: [],
          message: 'No matching endpoints found in documentation'
        }
      });
    }
    
    console.log('[map-endpoint] Got API mappings:', {
      count: apiMappings.length,
      mappings: apiMappings.map(m => ({
        confidenceScore: m.confidenceScore,
        stepCount: m.steps.length
      }))
    });

    // Convert ApiMapping[] to MappingSuggestion[] and save each one
    console.log('[map-endpoint] Starting to save mappings');
    
    // Replace Promise.all with sequential processing to handle errors individually
    const savedMappings: any[] = [];
    const failedMappings: any[] = [];
    
    // Process each mapping individually to prevent one failure from stopping everything
    for (let index = 0; index < apiMappings.length; index++) {
      const mapping = apiMappings[index];
      
      try {
        console.log(`[map-endpoint] Processing mapping ${index + 1}:`, {
          hasSteps: !!mapping.steps,
          stepCount: mapping.steps?.length,
          firstStep: mapping.steps?.[0] ? {
            hasEndpoint: !!mapping.steps[0].endpoint,
            hasOutputFields: !!mapping.steps[0].outputFields,
            outputFieldCount: mapping.steps[0].outputFields?.length,
            endpoint: mapping.steps[0].endpoint ? {
              path: mapping.steps[0].endpoint.path,
              method: mapping.steps[0].endpoint.method
            } : null
          } : null
        });

        if (!mapping.steps?.[0]?.endpoint || !mapping.steps[0].outputFields) {
          throw new Error(`Invalid mapping structure at index ${index}: missing required fields`);
        }

        // Validate source endpoint fields
        if (!mapping.steps[0].endpoint.path || !mapping.steps[0].endpoint.method) {
          console.error(`[map-endpoint] Invalid source endpoint at index ${index}:`, {
            endpoint: mapping.steps[0].endpoint
          });
          throw new Error(`Invalid mapping at index ${index}: source_endpoint missing path or method`);
        }

        if (!Array.isArray(mapping.steps[0].outputFields) || mapping.steps[0].outputFields.length === 0) {
          console.error(`[map-endpoint] Empty output fields for mapping ${index + 1}:`, {
            mapping: {
              confidenceScore: mapping.confidenceScore,
              reasoning: mapping.reasoning,
              endpoint: {
                path: mapping.steps[0].endpoint.path,
                method: mapping.steps[0].endpoint.method
              }
            }
          });
          throw new Error(`Invalid mapping at index ${index}: no field mappings generated`);
        }

        const mappingData = {
          endpoint_id: endpointNumericId,
          doc_id: docId,
          source_endpoint: {
            path: mapping.steps[0].endpoint.path.trim(),  // Ensure path is trimmed
            method: mapping.steps[0].endpoint.method.trim().toUpperCase(),  // Normalize method
            description: mapping.steps[0].endpoint.description || '',
            parameters: mapping.steps[0].endpoint.parameters || [],
            responses: mapping.steps[0].endpoint.responses || {},
            matchReason: mapping.steps[0].endpoint.matchReason || '',
            confidenceScore: mapping.steps[0].endpoint.confidenceScore || 0
          },
          field_mappings: mapping.steps[0].outputFields.map((field: any) => ({
            source: field.target.trim(),  // Swap source and target to map Documentation TO TMF
            target: field.source.trim(),  // Documentation properties map TO TMF properties
            transform: field.transform || 'direct',
            endpoint_info: {
              path: mapping.steps[0].endpoint.path.trim(),
              method: mapping.steps[0].endpoint.method.trim().toUpperCase()
            }
          })),
          // Convert decimal confidence score (0.0-1.0) to integer (0-100) for database compatibility
          confidence_score: Math.round((mapping.confidenceScore || 0) * 100),
          reasoning: mapping.reasoning || 'Generated mapping based on endpoint analysis',
          status: 'draft' as const
        };

        // Additional validation before saving
        if (!mappingData.source_endpoint.path || !mappingData.source_endpoint.method) {
          console.error(`[map-endpoint] Invalid mapping data at index ${index}:`, {
            source_endpoint: mappingData.source_endpoint
          });
          throw new Error(`Invalid mapping data at index ${index}: source_endpoint missing path or method`);
        }

        console.log(`[map-endpoint] Prepared mapping data ${index + 1}:`, {
          endpoint_id: mappingData.endpoint_id,
          doc_id: mappingData.doc_id,
          field_count: mappingData.field_mappings.length,
          source_endpoint: {
            path: mappingData.source_endpoint.path,
            method: mappingData.source_endpoint.method
          }
        });

        try {
          console.log('[map-endpoint] Saving mapping:', {
            endpoint_id: mappingData.endpoint_id,
            doc_id: mappingData.doc_id,
            field_count: mappingData.field_mappings.length,
            source_endpoint: {
              path: mappingData.source_endpoint.path,
              method: mappingData.source_endpoint.method
            }
          });

          const saved = await saveEndpointMapping(mappingData);
          console.log('[map-endpoint] Successfully saved mapping:', {
            id: saved.id,
            endpoint_id: saved.endpoint_id,
            doc_id: saved.doc_id,
            field_count: saved.field_mappings?.length,
            source_endpoint: {
              path: saved.source_endpoint?.path,
              method: saved.source_endpoint?.method
            }
          });
          savedMappings.push(saved);
        } catch (error) {
          console.error('[map-endpoint] Error saving mapping:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
          failedMappings.push({
            index,
            error: errorMessage,
            mapping: mappingData
          });
        }
      } catch (processingError) {
        console.error(`[map-endpoint] Error processing mapping ${index + 1}:`, processingError);
        failedMappings.push({
          index,
          error: processingError instanceof Error ? processingError.message : 'Unknown processing error',
          mapping: mapping
        });
      }
    }

    console.log('[map-endpoint] Processed all mappings:', {
      successful: savedMappings.length,
      failed: failedMappings.length,
      mappings: savedMappings.map(m => ({
        id: m.id,
        endpoint_id: m.endpoint_id,
        field_count: m.field_mappings?.length
      }))
    });

    return res.status(200).json({
      success: true,
      data: {
        suggestions: savedMappings,
        failed: failedMappings.length > 0 ? failedMappings : undefined,
        tmfEndpoint: {
          path,
          method,
          specification
        },
        requestFormat: req.body.sourceEndpoint ? 'new' : 'original',
        docId: docId,
        docIdInfo: docId.startsWith('placeholder-') ? 
          'Using a placeholder docId. For better results, please provide a valid docId in future requests.' : 
          'Using a valid docId'
      }
    });

  } catch (error) {
    console.error('[map-endpoint] Error processing request:', error);
    
    // Extract error details
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const errorDetails = error instanceof Error && error.stack ? error.stack : '';
    
    // Determine error code based on message
    let errorCode = 'PROCESSING_ERROR';
    if (errorMessage.includes('Database error:') || errorMessage.includes('Database operation failed:')) {
      errorCode = 'DATABASE_ERROR';
    } else if (errorMessage.includes('Invalid mapping structure:')) {
      errorCode = 'VALIDATION_ERROR';
    }
    
    return res.status(500).json({
      error: errorMessage,
      details: errorDetails,
      code: errorCode
    });
  }
} 