import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../utils/supabase-client';

interface TMFEndpoint {
  id: number;
  specification: {
    fields: Array<{
      name: string;
      required: boolean;
    }>;
  };
}

interface FieldMapping {
  source: string;
  target: string;
  transform?: string;
}

interface EndpointMapping {
  endpoint_id: number;
  doc_id: string;
  field_mappings: FieldMapping[];
  source_endpoint: {
    path: string;
    method: string;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpointId, docId } = req.query;

    if (!endpointId || !docId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get the TMF endpoint details with all fields
    const { data: endpoint, error: endpointError } = await supabase
      .from('bss_endpoints')
      .select('id, specification')
      .eq('id', endpointId)
      .single();

    if (endpointError) throw endpointError;

    // Get the mapping details from bss_endpoint_mappings
    const { data: mapping, error: mappingError } = await supabase
      .from('bss_endpoint_mappings')
      .select('endpoint_id, doc_id, field_mappings, source_endpoint')
      .eq('endpoint_id', endpointId)
      .eq('doc_id', docId)
      .single();

    if (mappingError && mappingError.code !== 'PGRST116') throw mappingError;

    // Get all fields from the TMF endpoint specification
    const tmfFields = (endpoint as TMFEndpoint).specification.fields;
    const totalFields = tmfFields.length;

    // Get all mapped fields from the mapping
    const existingMappings = (mapping as EndpointMapping)?.field_mappings || [];
    const mappedFields = existingMappings.length;

    // Create a set of mapped field names for efficient lookup
    const mappedFieldNames = new Set(existingMappings.map(m => m.target));

    // Find required fields that aren't mapped
    const unmappedRequiredFields = tmfFields
      .filter(field => field.required && !mappedFieldNames.has(field.name))
      .map(field => field.name);

    return res.status(200).json({
      success: true,
      data: {
        totalFields,
        mappedFields,
        unmappedRequiredFields,
        mappingPercentage: Math.round((mappedFields / totalFields) * 100),
        mappings: existingMappings,
        sourceEndpoint: mapping?.source_endpoint || null
      }
    });
  } catch (error) {
    console.error('[get-mapping-status] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to get mapping status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 