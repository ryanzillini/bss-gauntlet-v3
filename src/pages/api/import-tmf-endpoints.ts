import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../utils/supabase-client';
import { TMFService } from '../../services/TMFService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const allEndpoints = TMFService.getAllEndpoints();
    const timestamp = new Date().toISOString();
    
    // Insert all endpoints
    for (const endpoint of allEndpoints) {
      const endpointData = {
        name: endpoint.name,
        path: endpoint.path,
        method: endpoint.method,
        api_name: 'tmf',
        created_at: timestamp,
        updated_at: timestamp,
        specification: {
          ...endpoint.specification,
          description: endpoint.description
        }
      };

      // Check if endpoint already exists
      const { data: existingEndpoint } = await supabase
        .from('bss_endpoints')
        .select('id')
        .eq('path', endpoint.path)
        .eq('method', endpoint.method)
        .eq('api_name', 'tmf')
        .single();

      if (existingEndpoint) {
        // Update existing endpoint
        await supabase
          .from('bss_endpoints')
          .update(endpointData)
          .eq('id', existingEndpoint.id);
      } else {
        // Insert new endpoint
        await supabase
          .from('bss_endpoints')
          .insert(endpointData);
      }
    }

    // Get unique API names using reduce
    const uniqueApis = allEndpoints.reduce((apis: string[], endpoint) => {
      const apiName = endpoint.specification.name;
      return apis.includes(apiName) ? apis : [...apis, apiName];
    }, []);

    return res.status(200).json({
      results: {
        total: allEndpoints.length,
        apis: uniqueApis
      }
    });
  } catch (error) {
    console.error('Error importing TMF endpoints:', error);
    return res.status(500).json({ error: 'Failed to import TMF endpoints' });
  }
} 