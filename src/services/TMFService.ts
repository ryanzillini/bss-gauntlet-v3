import { supabase } from '../utils/supabase-client';

export interface TMFEndpoint {
  id: string;
  name: string;
  path: string;
  method: string;
  specification: {
    name: string;
    description: string;
    fields: Array<{
      name: string;
      type: string;
      required: boolean;
      description: string;
      schema?: {
        $ref?: string;
      };
    }>;
    category?: string;
  };
}

export interface TMFFile {
  id: string;
  name: string;
  description: string;
  endpoints: TMFEndpoint[];
}

export interface TMFService {
  listTMFFiles(): Promise<{ id: string; name: string }[]>;
  loadTMFFile(fileId: string): Promise<TMFFile>;
  searchEndpoints(params: {
    query?: string;
    docId?: string;
    tmfApi?: string;
    method?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    endpoints: TMFEndpoint[];
    total: number;
    page: number;
    limit: number;
    filters: {
      methods: string[];
      apis: string[];
    };
  }>;
  getFieldDetails(fieldName: string, fieldType: string): Promise<Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    schema?: {
      $ref?: string;
    };
  }>>;
  updateMapping(docId: string, endpointId: string, mapping: {
    api: string;
    operation: string;
    confidence: number;
  }): Promise<TMFEndpoint>;
  getMappingStats(docId: string): Promise<{
    total: number;
    mapped: number;
    unmapped: number;
    tmfApis: string[];
  }>;
  listTMFApis(): Promise<string[]>;
}

class TMFServerService implements TMFService {
  async listTMFFiles(): Promise<{ id: string; name: string }[]> {
    try {
      const response = await fetch('/api/tmf-service?action=listFiles');
      if (!response.ok) {
        throw new Error('Failed to fetch TMF files');
      }
      return await response.json();
    } catch (error) {
      console.error('[TMFService] Error listing TMF files:', error);
      throw error;
    }
  }

  async loadTMFFile(fileId: string): Promise<TMFFile> {
    try {
      const response = await fetch(`/api/tmf-service?action=loadFile&fileId=${fileId}`);
      if (!response.ok) {
        throw new Error('Failed to load TMF file');
      }
      return await response.json();
    } catch (error) {
      console.error('[TMFService] Error loading TMF file:', error);
      throw error;
    }
  }

  async searchEndpoints(params: {
    query?: string;
    docId?: string;
    tmfApi?: string;
    method?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    endpoints: TMFEndpoint[];
    total: number;
    page: number;
    limit: number;
    filters: {
      methods: string[];
      apis: string[];
    };
  }> {
    try {
      const {
        query = '',
        docId,
        tmfApi,
        method,
        page = 1,
        limit = 10
      } = params;

      console.log('[TMFService] Search params:', { query, docId, tmfApi, method, page, limit });

      // Load the TMF file if specified
      let endpoints: TMFEndpoint[] = [];
      if (tmfApi) {
        try {
          const tmfFile = await this.loadTMFFile(tmfApi);
          endpoints = tmfFile.endpoints;
          console.log(`[TMFService] Loaded ${endpoints.length} endpoints from ${tmfApi}`);
        } catch (error) {
          console.error(`[TMFService] Error loading TMF file ${tmfApi}:`, error);
          return {
            endpoints: [],
            total: 0,
            page,
            limit,
            filters: {
              methods: [],
              apis: []
            }
          };
        }
      } else {
        // Load all TMF files
        const tmfFiles = await this.listTMFFiles();
        for (const file of tmfFiles) {
          try {
            const tmfFile = await this.loadTMFFile(file.id);
            endpoints = [...endpoints, ...tmfFile.endpoints];
          } catch (error) {
            console.error(`[TMFService] Error loading TMF file ${file.id}:`, error);
          }
        }
        console.log(`[TMFService] Loaded ${endpoints.length} total endpoints from all TMF files`);
      }

      // Apply filters
      if (query) {
        const searchTerms = query.toLowerCase().split(' ');
        endpoints = endpoints.filter(endpoint => {
          const searchText = `${endpoint.path} ${endpoint.method} ${endpoint.specification?.description || ''}`.toLowerCase();
          return searchTerms.every((term: string) => searchText.includes(term));
        });
        console.log('[TMFService] After query filter:', endpoints.length);
      }

      if (method) {
        endpoints = endpoints.filter(endpoint => endpoint.method === method);
        console.log('[TMFService] After method filter:', endpoints.length);
      }

      // Calculate pagination
      const total = endpoints.length;
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedEndpoints = endpoints.slice(start, end);

      console.log('[TMFService] Final results:', {
        total,
        returned: paginatedEndpoints.length,
        page,
        limit
      });

      return {
        endpoints: paginatedEndpoints,
        total: total,
        page: page,
        limit: limit,
        filters: {
          methods: Array.from(new Set(endpoints.map(e => e.method))),
          apis: await this.listTMFApis()
        }
      };
    } catch (error) {
      console.error('[TMFService] Error searching endpoints:', error);
      throw error;
    }
  }

  async getFieldDetails(fieldName: string, fieldType: string): Promise<Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    schema?: {
      $ref?: string;
    };
  }>> {
    try {
      const response = await fetch(`/api/tmf-service?action=getFieldDetails&fieldName=${encodeURIComponent(fieldName)}&fieldType=${encodeURIComponent(fieldType)}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get field details');
      }
      const fields = await response.json();
      console.log(`[TMFService] Got field details for ${fieldName} (${fieldType}):`, fields);
      return fields;
    } catch (error) {
      console.error('[TMFService] Error getting field details:', error);
      return [];
    }
  }

  async updateMapping(docId: string, endpointId: string, mapping: {
    api: string;
    operation: string;
    confidence: number;
  }): Promise<TMFEndpoint> {
    try {
      // Get current doc
      const { data: doc, error: docError } = await supabase
        .from('bss_mappings')
        .select('*')
        .eq('id', docId)
        .single();

      if (docError) throw docError;
      if (!doc?.config?.endpoints) {
        throw new Error('No endpoints found in documentation');
      }

      // Update the specific endpoint's mapping
      const endpoints = doc.config.endpoints as TMFEndpoint[];
      const endpointIndex = endpoints.findIndex(e => e.id === endpointId);
      
      if (endpointIndex === -1) {
        throw new Error('Endpoint not found');
      }

      endpoints[endpointIndex] = {
        ...endpoints[endpointIndex],
        specification: {
          ...endpoints[endpointIndex].specification,
          name: mapping.api
        }
      };

      // Save updated endpoints back to doc
      const { error: updateError } = await supabase
        .from('bss_mappings')
        .update({
          config: {
            ...doc.config,
            endpoints
          }
        })
        .eq('id', docId);

      if (updateError) throw updateError;

      return endpoints[endpointIndex];
    } catch (error) {
      console.error('[TMFService] Error updating mapping:', error);
      throw error;
    }
  }

  async getMappingStats(docId: string): Promise<{
    total: number;
    mapped: number;
    unmapped: number;
    tmfApis: string[];
  }> {
    try {
      const { data: doc, error: docError } = await supabase
        .from('bss_mappings')
        .select('*')
        .eq('id', docId)
        .single();

      if (docError) throw docError;
      if (!doc?.config?.endpoints) {
        return {
          total: 0,
          mapped: 0,
          unmapped: 0,
          tmfApis: []
        };
      }

      const endpoints = doc.config.endpoints as TMFEndpoint[];
      const mapped = endpoints.filter(e => !!e.specification.name).length;
      const tmfApis = Array.from(new Set(
        endpoints
          .filter(e => e.specification.name)
          .map(e => e.specification.name)
      ));

      return {
        total: endpoints.length,
        mapped,
        unmapped: endpoints.length - mapped,
        tmfApis
      };
    } catch (error) {
      console.error('[TMFService] Error getting mapping stats:', error);
      throw error;
    }
  }

  async listTMFApis(): Promise<string[]> {
    try {
      const files = await this.listTMFFiles();
      return files.map(file => file.name);
    } catch (error) {
      console.error('[TMFService] Error listing TMF APIs:', error);
      return [];
    }
  }
}

const tmfServerService = new TMFServerService();
export const tmfService: TMFService = tmfServerService; 