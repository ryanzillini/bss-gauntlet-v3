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

// Helper function to extract path from endpoint ID
function extractPathFromEndpointId(endpointId: string): string {
  const pathMatch = endpointId.match(/^(.+)-(get|post|put|delete|patch)$/i);
  
  if (pathMatch) {
    return pathMatch[1]; // Return the path portion
  }
  
  // If no clear pattern, just return the ID
  return endpointId;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpointId, docId } = req.query;

  if (!endpointId || !docId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const decodedEndpointId = decodeURIComponent(endpointId as string);
    
    console.log('[get-endpoint-mapping] Fetching mapping:', {
      endpointId: decodedEndpointId,
      docId
    });

    // Extract numeric ID from the endpoint string (e.g., "/partyAccount-post" -> numeric ID)
    const numericId = extractEndpointId(decodedEndpointId);
    console.log('[get-endpoint-mapping] Using numeric ID:', numericId);

    const { data, error } = await supabase
      .from('bss_endpoint_mappings')
      .select('*')
      .eq('endpoint_id', numericId)
      .eq('doc_id', docId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('[get-endpoint-mapping] Database error:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // Handle "no rows found" error differently
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'No mapping found' });
      }
      
      throw error;
    }

    console.log('[get-endpoint-mapping] Successfully fetched mapping:', {
      id: data.id,
      tmf_path: extractPathFromEndpointId(decodedEndpointId),
      endpoint_path: data.source_endpoint?.path,
      doc_id: data.doc_id,
      field_mappings_count: data.field_mappings?.length
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('[get-endpoint-mapping] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch endpoint mapping',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 