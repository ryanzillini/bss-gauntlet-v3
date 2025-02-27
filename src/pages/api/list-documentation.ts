import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../utils/supabase-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[list-documentation] Fetching documentation list');
    
    // Fetch documentation list from the bss_mappings table
    const { data, error } = await supabase
      .from('bss_mappings')
      .select('id, name')
      .eq('show', true)
      .eq('type', 'documentation')  // Only select documentation type mappings
      .order('name');

    if (error) {
      console.error('[list-documentation] Database error:', error);
      throw error;
    }

    console.log('[list-documentation] Successfully fetched documentation list, count:', data?.length || 0);
    
    if (data && data.length > 0) {
      console.log('[list-documentation] First document:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('[list-documentation] No documents found');
    }

    return res.status(200).json({ 
      success: true,
      documents: data
    });
  } catch (error) {
    console.error('[list-documentation] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch documentation list',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 