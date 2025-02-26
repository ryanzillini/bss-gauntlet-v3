import { NextApiRequest, NextApiResponse } from 'next';
import { DocumentationMappingService } from '../services/DocumentationMappingService';
import { saveEndpointMapping, BssEndpointMapping } from '../../utils/supabase-client';
import { EndpointMappingRequest, ApiMapping, OutputField, TMFEndpoint } from '../types';

// Type guard function to check if error is an Error object
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Helper function to get a detailed error message
function getDetailedErrorMessage(error: unknown): { message: string; details?: string; code?: string } {
  if (isError(error)) {
    // Handle specific error types
    if (error.message.includes('OPENAI_API_KEY')) {
      return {
        message: 'OpenAI API configuration error',
        details: 'The OpenAI API key is missing or invalid. Please check your environment variables.',
        code: 'OPENAI_CONFIG_ERROR'
      };
    }
    if (error.message.includes('supabase')) {
      return {
        message: 'Database operation failed',
        details: 'There was an error accessing the database. Please check your database configuration.',
        code: 'DATABASE_ERROR'
      };
    }
    return {
      message: error.message,
      details: error.stack,
      code: 'UNKNOWN_ERROR'
    };
  }
  return {
    message: 'An unexpected error occurred',
    details: String(error),
    code: 'UNEXPECTED_ERROR'
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[map-endpoint] Starting request processing');
    
    const { endpointId, path, method, specification, docId } = req.body as EndpointMappingRequest;

    // Log request details
    console.log('[map-endpoint] Request payload:', {
      endpointId,
      path,
      method,
      docId,
      hasSpecification: Boolean(specification)
    });

    if (!endpointId || !path || !method || !specification || !docId) {
      const missingFields = [
        !endpointId && 'endpointId',
        !path && 'path',
        !method && 'method',
        !specification && 'specification',
        !docId && 'docId'
      ].filter(Boolean);

      console.error('[map-endpoint] Missing required fields:', {
        missingFields,
        payload: {
          hasEndpointId: Boolean(endpointId),
          hasPath: Boolean(path),
          hasMethod: Boolean(method),
          hasSpecification: Boolean(specification),
          hasDocId: Boolean(docId)
        }
      });
      
      return res.status(400).json({
        error: 'Missing required fields',
        details: `The following fields are required but missing: ${missingFields.join(', ')}`
      });
    }

    // Log OpenAI key status
    console.log('[map-endpoint] OpenAI configuration:', {
      hasKey: Boolean(process.env.OPENAI_API_KEY),
      keyLength: process.env.OPENAI_API_KEY?.length
    });

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Parse the specification string to an object
    let parsedSpecification;
    try {
      parsedSpecification = JSON.parse(specification);
    } catch (e) {
      // If parsing fails, create a default structure
      parsedSpecification = {
        fields: []
      };
      console.warn('[map-endpoint] Failed to parse specification string, using default empty structure');
    }

    // Get mapping suggestions from the documentation service
    console.log('[map-endpoint] Initializing DocumentationMappingService');
    const documentationService = new DocumentationMappingService(process.env.OPENAI_API_KEY);

    console.log('[map-endpoint] Starting documentation analysis');
    const apiMappings: ApiMapping[] = await documentationService.analyzeDocumentation({
      path,
      method,
      specification: parsedSpecification
    }, docId);

    console.log('[map-endpoint] Got API mappings:', {
      count: apiMappings.length,
      mappings: apiMappings.map((m: ApiMapping) => ({
        confidenceScore: m.confidenceScore,
        stepCount: m.steps.length
      }))
    });

    // Convert ApiMapping[] to MappingSuggestion[] and save each one
    console.log('[map-endpoint] Starting to save mappings');
    const savedMappings = await Promise.all(apiMappings.map(async (mapping: ApiMapping) => {
      const mappingData: Omit<BssEndpointMapping, 'id' | 'created_at' | 'updated_at'> = {
        endpoint_id: Number(endpointId),
        doc_id: docId,
        source_endpoint: {
          path: mapping.steps[0].endpoint.path,
          method: mapping.steps[0].endpoint.method,
          description: mapping.steps[0].endpoint.description || '',
          parameters: mapping.steps[0].endpoint.parameters || [],
          responses: mapping.steps[0].endpoint.responses || {},
          matchReason: mapping.steps[0].endpoint.matchReason || '',
          confidenceScore: mapping.steps[0].endpoint.confidenceScore || 0
        },
        field_mappings: mapping.steps[0].outputFields.map((field: OutputField) => ({
          source: field.source,
          target: field.target,
          transform: field.transform
        })),
        confidence_score: Number(mapping.confidenceScore),
        reasoning: mapping.reasoning,
        status: 'draft' as const
      };

      try {
        const saved = await saveEndpointMapping(mappingData);
        console.log('[map-endpoint] Successfully saved mapping:', {
          id: saved.id,
          endpoint_id: saved.endpoint_id,
          doc_id: saved.doc_id
        });
        return saved;
      } catch (error: any) {
        console.error('[map-endpoint] Error saving mapping:', error);
        throw error;
      }
    }));

    console.log('[map-endpoint] Successfully processed all mappings');
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
    console.error('[map-endpoint] Error processing request:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    const errorDetails = getDetailedErrorMessage(error);
    
    return res.status(500).json({
      error: errorDetails.message,
      details: errorDetails.details,
      code: errorDetails.code,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || undefined
    });
  }
} 