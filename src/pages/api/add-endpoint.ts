import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../utils/supabase-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { path, method, description, docId, operationId, graphqlType } = req.body;

    console.log('[add-endpoint] Received request:', {
      path,
      method,
      docId,
      operationId,
      graphqlType
    });

    if (!path || !method || !docId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prepare the endpoint data based on the bss_endpoints schema
    const endpointData: any = {
      name: path.includes('/graphql') && operationId 
        ? `${graphqlType || 'GraphQL'}: ${operationId}` 
        : path,
      api_name: 'API', // Default API name
      path,
      method,
      specification: {
        name: path.includes('/graphql') && operationId 
          ? `${graphqlType || 'GraphQL'}: ${operationId}` 
          : path,
        description: description || '',
        fields: [],
        doc_id: docId,
        category: path.includes('/graphql') ? 'GraphQL' : 'REST'
      }
    };

    // Add GraphQL-specific data if available
    if (path.includes('/graphql')) {
      endpointData.specification.graphql_data = {
        operationId: operationId || '',
        type: graphqlType || (path.includes('query=') ? 'query' : 'mutation')
      };
    }

    console.log('[add-endpoint] Adding endpoint with data:', JSON.stringify(endpointData, null, 2));

    // Create a new endpoint in the database using the correct table name
    const { data, error } = await supabase
      .from('bss_endpoints')  // Changed from bss_tmf_endpoints to bss_endpoints
      .insert(endpointData)
      .select()
      .single();

    if (error) {
      console.error('[add-endpoint] Database error:', JSON.stringify(error, null, 2));
      return res.status(500).json({ 
        error: 'Database error when adding endpoint',
        details: error.message || 'Unknown database error'
      });
    }

    if (!data) {
      console.error('[add-endpoint] No data returned from insert operation');
      return res.status(500).json({ 
        error: 'Failed to add endpoint - no data returned',
      });
    }

    console.log('[add-endpoint] Successfully added endpoint:', {
      id: data.id,
      path: data.path,
      method: data.method
    });

    // Also add a mapping entry to link the documentation to the endpoint
    try {
      const mappingPayload = {
        endpoint_id: data.id,
        doc_id: docId,
        source_endpoint: {
          path,
          method,
          description: description || ''
        },
        field_mappings: [],
        confidence_score: 100,
        reasoning: 'Manually added endpoint',
        status: 'draft'
      };

      const { data: mappingResult, error: mappingError } = await supabase
        .from('bss_endpoint_mappings')
        .insert(mappingPayload);

      if (mappingError) {
        console.warn('[add-endpoint] Warning: Could not create mapping:', mappingError);
      }
    } catch (mappingError) {
      console.warn('[add-endpoint] Error creating mapping:', mappingError);
      // Continue even if mapping creation fails
    }

    return res.status(200).json({ 
      success: true,
      message: 'Endpoint added successfully',
      data
    });
  } catch (error) {
    console.error('[add-endpoint] Error:', error instanceof Error ? error.stack : error);
    return res.status(500).json({ 
      error: 'Failed to add endpoint',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 