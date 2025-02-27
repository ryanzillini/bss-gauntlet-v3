import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../utils/supabase-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { docId } = req.query;

  if (!docId) {
    return res.status(400).json({ error: 'Missing required parameter: docId' });
  }

  try {
    console.log('[get-mapping-config] Fetching mapping configuration:', { docId });

    const { data, error } = await supabase
      .from('bss_mappings')
      .select('config')
      .eq('show', true)
      .eq('id', docId)
      .single();

    if (error) {
      console.error('[get-mapping-config] Database error:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // Handle "no rows found" error differently
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'No mapping configuration found' });
      }
      
      throw error;
    }

    if (!data?.config) {
      return res.status(404).json({ error: 'No configuration found for this mapping' });
    }

    console.log('[get-mapping-config] Successfully fetched configuration');

    return res.status(200).json({ 
      success: true,
      config: data.config 
    });
  } catch (error) {
    console.error('[get-mapping-config] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch mapping configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 