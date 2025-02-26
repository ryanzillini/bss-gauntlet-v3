import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../utils/supabase-client';

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
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpointId, docId } = req.query;
    const updatedMapping = req.body;

    if (!endpointId || !docId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'endpointId and docId are required'
      });
    }

    const decodedEndpointId = decodeURIComponent(endpointId as string);
    
    // Extract numeric ID from the endpoint string
    const numericId = extractEndpointId(decodedEndpointId);
    console.log('[update-mapping] Using numeric ID:', numericId, 'for endpoint:', decodedEndpointId);

    // First, check if a mapping exists
    const { data: existingMappings, error: fetchError } = await supabase
      .from('bss_endpoint_mappings')
      .select('*')
      .eq('endpoint_id', numericId)
      .eq('doc_id', docId);

    if (fetchError) {
      console.error('[update-mapping] Error fetching existing mapping:', fetchError);
      return res.status(500).json({ 
        error: 'Database error while fetching mapping',
        details: fetchError.message
      });
    }

    let result;
    if (existingMappings && existingMappings.length > 0) {
      // Update existing mapping
      const { data, error } = await supabase
        .from('bss_endpoint_mappings')
        .update({
          source_endpoint: updatedMapping.source_endpoint,
          field_mappings: updatedMapping.field_mappings,
          confidence_score: updatedMapping.confidence_score,
          reasoning: updatedMapping.reasoning,
          status: updatedMapping.status || 'draft'
        })
        .eq('endpoint_id', numericId)
        .eq('doc_id', docId)
        .select();

      if (error) {
        console.error('[update-mapping] Error updating mapping:', error);
        return res.status(500).json({ 
          error: 'Failed to update mapping',
          details: error.message
        });
      }

      result = data[0];
    } else {
      // Create new mapping if it doesn't exist
      const { data, error } = await supabase
        .from('bss_endpoint_mappings')
        .insert([{
          endpoint_id: numericId,
          doc_id: docId,
          source_endpoint: updatedMapping.source_endpoint,
          field_mappings: updatedMapping.field_mappings,
          confidence_score: updatedMapping.confidence_score,
          reasoning: updatedMapping.reasoning,
          status: updatedMapping.status || 'draft'
        }])
        .select();

      if (error) {
        console.error('[update-mapping] Error creating mapping:', error);
        return res.status(500).json({ 
          error: 'Failed to create mapping',
          details: error.message
        });
      }

      result = data[0];
    }

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[update-mapping] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
} 