import { NextApiRequest, NextApiResponse } from 'next';
import { DocumentationMappingService } from '../../mapping/services/DocumentationMappingService';
import { saveEndpointMapping, saveBssEndpoint, BssEndpointMapping } from '../../utils/supabase-client';
import { documentationService } from '../../services/DocumentationService';
import { supabase } from '../../utils/supabase-client';

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
    console.log('[map-endpoint] Starting request processing');
    
    const { endpointId, path, method, specification, docId, preprocessedDoc } = req.body;

    if (!endpointId || !path || !method || !specification || !docId || !preprocessedDoc) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Please provide endpointId, path, method, specification, docId, and preprocessedDoc'
      });
    }

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

    // Use the preprocessed documentation for mapping
    const apiMappings = await documentationService.analyzeDocumentationWithPreprocessed({
      path,
      method,
      specification
    }, preprocessedDoc);

    if (!apiMappings || !Array.isArray(apiMappings) || apiMappings.length === 0) {
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
    const savedMappings = await Promise.all(apiMappings.map(async (mapping, index) => {
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
        field_mappings: mapping.steps[0].outputFields.map(field => ({
          source: field.source.trim(),  // Ensure field names are trimmed
          target: field.target.trim(),
          transform: field.transform || 'direct'
        })),
        confidence_score: mapping.confidenceScore || 0,
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
        return saved;
      } catch (error) {
        console.error('[map-endpoint] Error saving mapping:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
        throw new Error(`Failed to save mapping ${index + 1}: ${errorMessage}`);
      }
    }));

    console.log('[map-endpoint] Successfully processed all mappings:', {
      count: savedMappings.length,
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
        tmfEndpoint: {
          path,
          method,
          specification
        }
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