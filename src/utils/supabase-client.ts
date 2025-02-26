import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const isServer = typeof window === 'undefined';
const supabaseKey = isServer 
  ? process.env.SUPABASE_SERVICE_ROLE_KEY!
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log('[supabase-client] Initializing Supabase client:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseKey,
  isServer,
  url: supabaseUrl ? `${supabaseUrl.substring(0, 8)}...` : undefined
});

if (!supabaseUrl || !supabaseKey) {
  console.error('[supabase-client] Missing Supabase configuration:', {
    url: !supabaseUrl ? 'Missing NEXT_PUBLIC_SUPABASE_URL' : 'Present',
    key: !supabaseKey ? `Missing ${isServer ? 'SUPABASE_SERVICE_ROLE_KEY' : 'NEXT_PUBLIC_SUPABASE_ANON_KEY'}` : 'Present'
  });
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }
});

// Verify the client was created successfully
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('[supabase-client] Failed to initialize Supabase client:', error);
  } else {
    console.log('[supabase-client] Supabase client initialized successfully');
  }
}).catch(error => {
  console.error('[supabase-client] Error checking Supabase session:', error);
});

// Type definitions for our database tables
export interface BssMapping {
  id: string;
  name: string;
  description?: string;
  status: string;
  type: string;
  config: any;
  api_docs?: string;
  api_url?: string;
  api_key?: string;
  endpoints?: any;
  created_at: string;
  updated_at: string;
  success_rate?: string;
  api_calls?: string;
}

export interface BssEndpoint {
  id: string;
  path: string;
  method: string;
  version: string;
  description?: string;
  parameters?: Record<string, any>;
  responses?: Record<string, any>;
  required_fields?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface BssEndpointMapping {
  id: string;
  endpoint_id: number;
  doc_id: string;
  source_endpoint: {
    path: string;
    method: string;
    description?: string;
    parameters?: any[];
    responses?: Record<string, any>;
    matchReason?: string;
    confidenceScore?: number;
  };
  field_mappings: Array<{
    source: string;
    target: string;
    transform?: string;
  }>;
  confidence_score: number;
  reasoning?: string;
  status?: 'draft' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
  approved_at?: string;
  approved_by?: string;
  metadata?: Record<string, any>;
}

// Database operations
export const saveMappingToDb = async (mapping: Omit<BssMapping, 'id' | 'created_at' | 'updated_at'>) => {
  console.log('[supabase-client] Attempting to save mapping:', {
    name: mapping.name,
    type: mapping.type,
    status: mapping.status
  });

  try {
    const { data, error } = await supabase
      .from('bss_mappings')
      .insert([mapping])
      .select()
      .single();

    if (error) {
      console.error('[supabase-client] Database error:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        mapping: {
          name: mapping.name,
          type: mapping.type,
          status: mapping.status
        }
      });
      throw error;
    }

    console.log('[supabase-client] Successfully saved mapping:', {
      id: data.id,
      name: data.name,
      created_at: data.created_at
    });
    return data;
  } catch (error) {
    console.error('[supabase-client] Unexpected error in saveMappingToDb:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

export const updateMappingInDb = async (id: string, updates: Partial<BssMapping>) => {
  console.log('[supabase-client] Attempting to update mapping:', {
    id,
    updates: {
      status: updates.status,
      type: updates.type
    }
  });

  try {
    const { data, error } = await supabase
      .from('bss_mappings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[supabase-client] Database error:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    console.log('[supabase-client] Successfully updated mapping:', {
      id: data.id,
      name: data.name,
      updated_at: data.updated_at
    });
    return data;
  } catch (error) {
    console.error('[supabase-client] Unexpected error in updateMappingInDb:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

export const getMappingFromDb = async (id: string) => {
  console.log('[supabase-client] Attempting to get mapping:', { id });

  try {
    const { data, error } = await supabase
      .from('bss_mappings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[supabase-client] Database error:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    console.log('[supabase-client] Successfully retrieved mapping:', {
      id: data.id,
      name: data.name
    });
    return data;
  } catch (error) {
    console.error('[supabase-client] Unexpected error in getMappingFromDb:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

export const getAllMappingsFromDb = async () => {
  console.log('[supabase-client] Attempting to get all mappings');

  try {
    const { data, error } = await supabase
      .from('bss_mappings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[supabase-client] Database error:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    console.log('[supabase-client] Successfully retrieved mappings:', {
      count: data?.length
    });
    return data || [];
  } catch (error) {
    console.error('[supabase-client] Unexpected error in getAllMappingsFromDb:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

export const deleteMappingFromDb = async (id: string) => {
  console.log('[supabase-client] Attempting to delete mapping:', { id });

  try {
    const { error } = await supabase
      .from('bss_mappings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[supabase-client] Database error during deletion:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    console.log('[supabase-client] Successfully deleted mapping:', { id });
    return true;
  } catch (error) {
    console.error('[supabase-client] Unexpected error in deleteMappingFromDb:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

export async function saveBssEndpoint(endpoint: Omit<BssEndpoint, 'id' | 'created_at' | 'updated_at'>) {
  try {
    const { data, error } = await supabase
      .from('bss_endpoints')
      .insert([{
        ...endpoint,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving BSS endpoint:', error);
    throw error;
  }
}

export async function getBssEndpoints() {
  try {
    const { data, error } = await supabase
      .from('bss_endpoints')
      .select('*')
      .order('path', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting BSS endpoints:', error);
    throw error;
  }
}

export async function getBssEndpointByPath(path: string) {
  try {
    const { data, error } = await supabase
      .from('bss_endpoints')
      .select('*')
      .eq('path', path)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting BSS endpoint:', error);
    throw error;
  }
}

export async function updateBssEndpoint(id: string, updates: Partial<BssEndpoint>) {
  try {
    const { data, error } = await supabase
      .from('bss_endpoints')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating BSS endpoint:', error);
    throw error;
  }
}

export const saveEndpointMapping = async (mapping: Omit<BssEndpointMapping, 'id' | 'created_at' | 'updated_at'>) => {
  console.log('[supabase-client] Attempting to save endpoint mapping:', {
    endpoint_id: mapping.endpoint_id,
    doc_id: mapping.doc_id,
    confidence_score: mapping.confidence_score,
    field_mappings_count: mapping.field_mappings?.length
  });

  // Validate required fields
  if (!mapping.endpoint_id || !mapping.doc_id) {
    throw new Error('Missing required fields: endpoint_id and doc_id are required');
  }

  // Validate field mappings
  if (!Array.isArray(mapping.field_mappings) || mapping.field_mappings.length === 0) {
    throw new Error('Invalid field_mappings: must be a non-empty array');
  }

  // Validate source endpoint
  if (!mapping.source_endpoint?.path || !mapping.source_endpoint?.method) {
    throw new Error('Invalid source_endpoint: path and method are required');
  }

  try {
    const { data, error } = await supabase
      .from('bss_endpoint_mappings')
      .insert([{
        ...mapping,
        // Ensure all required fields have default values
        status: mapping.status || 'draft',
        confidence_score: mapping.confidence_score || 0,
        reasoning: mapping.reasoning || '',
        field_mappings: mapping.field_mappings.map(fm => ({
          source: fm.source,
          target: fm.target,
          transform: fm.transform || 'direct'
        })),
        source_endpoint: {
          ...mapping.source_endpoint,
          parameters: mapping.source_endpoint.parameters || [],
          responses: mapping.source_endpoint.responses || {},
          description: mapping.source_endpoint.description || '',
          matchReason: mapping.source_endpoint.matchReason || '',
          confidenceScore: mapping.source_endpoint.confidenceScore || 0
        }
      }])
      .select()
      .single();

    if (error) {
      console.error('[supabase-client] Database error:', {
        code: error.code,
        message: error.message,
        details: error.details
      });
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from database after insert');
    }

    console.log('[supabase-client] Successfully saved endpoint mapping:', {
      id: data.id,
      endpoint_id: data.endpoint_id,
      confidence_score: data.confidence_score,
      field_mappings_count: data.field_mappings?.length
    });
    
    return data;
  } catch (error) {
    console.error('[supabase-client] Error saving endpoint mapping:', error);
    if (error instanceof Error) {
      throw new Error(`Database operation failed: ${error.message}`);
    } else {
      throw new Error('Unknown database error occurred');
    }
  }
};

export const getEndpointMappings = async (endpointId: string) => {
  console.log('[supabase-client] Fetching mappings for endpoint:', endpointId);

  try {
    const { data, error } = await supabase
      .from('bss_endpoint_mappings')
      .select('*')
      .eq('endpoint_id', endpointId)
      .order('confidence_score', { ascending: false });

    if (error) {
      console.error('[supabase-client] Database error:', error);
      throw error;
    }

    console.log('[supabase-client] Successfully fetched endpoint mappings:', {
      count: data.length
    });
    return data;
  } catch (error) {
    console.error('[supabase-client] Error fetching endpoint mappings:', error);
    throw error;
  }
};

export const updateEndpointMapping = async (id: string, updates: Partial<BssEndpointMapping>) => {
  console.log('[supabase-client] Updating endpoint mapping:', {
    id,
    updates: {
      field_mappings: updates.field_mappings?.length,
      source_endpoint: updates.source_endpoint?.path,
      confidence_score: updates.confidence_score,
      reasoning: updates.reasoning?.substring(0, 50),
      status: updates.status
    }
  });

  try {
    const { data, error } = await supabase
      .from('bss_endpoint_mappings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[supabase-client] Database error updating mapping:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    console.log('[supabase-client] Successfully updated endpoint mapping:', {
      id: data.id,
      field_mappings_count: data.field_mappings?.length,
      source_endpoint: data.source_endpoint?.path,
      status: data.status,
      updated_at: data.updated_at
    });
    return data;
  } catch (error) {
    console.error('[supabase-client] Error updating endpoint mapping:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

export const approveEndpointMapping = async (id: string, userId: string) => {
  console.log('[supabase-client] Approving endpoint mapping:', {
    id,
    userId
  });

  try {
    const { data, error } = await supabase
      .from('bss_endpoint_mappings')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: userId
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[supabase-client] Database error:', error);
      throw error;
    }

    console.log('[supabase-client] Successfully approved endpoint mapping:', {
      id: data.id
    });
    return data;
  } catch (error) {
    console.error('[supabase-client] Error approving endpoint mapping:', error);
    throw error;
  }
}; 