import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../utils/supabase-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get total count of TMF endpoints
    const { count: totalEndpoints, error } = await supabase
      .from('bss_endpoints')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    // Get last updated timestamp
    const { data: lastUpdated, error: timeError } = await supabase
      .from('bss_endpoints')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (timeError) throw timeError;

    // Get unique APIs
    const { data: apis, error: apisError } = await supabase
      .from('bss_endpoints')
      .select('api_name')
      .order('api_name');

    if (apisError) throw apisError;

    // Get unique api names
    const uniqueApis = Array.from(new Set(apis.map(api => api.api_name)));

    return res.status(200).json({
      lastUpdated: lastUpdated?.created_at || null,
      totalEndpoints: totalEndpoints || 0,
      apis: uniqueApis
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to get TMF status' });
  }
} 