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
  searchEndpoints(fileId: string, query?: string, method?: string, page?: number, limit?: number): Promise<{
    results: TMFEndpoint[];
    metadata: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      filters: {
        methods: string[];
        apis: string[];
      };
    };
  }>;
  getFieldDetails(fieldName: string, fieldType: string): Promise<Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>>;
}

// Temporary implementation that returns mock data
class TMFServerService implements TMFService {
  async listTMFFiles(): Promise<{ id: string; name: string }[]> {
    return [
      { id: 'TMF666_Account', name: 'TMF666 Account Management' },
      { id: 'TMF620_ProductCatalog', name: 'TMF620 Product Catalog' }
    ];
  }

  async loadTMFFile(fileId: string): Promise<TMFFile> {
    return {
      id: fileId,
      name: 'Mock TMF File',
      description: 'Mock TMF File Description',
      endpoints: []
    };
  }

  async searchEndpoints(
    fileId: string,
    query?: string,
    method?: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    results: TMFEndpoint[];
    metadata: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      filters: {
        methods: string[];
        apis: string[];
      };
    };
  }> {
    return {
      results: [],
      metadata: {
        total: 0,
        page,
        limit,
        totalPages: 0,
        filters: {
          methods: ['GET', 'POST', 'PUT', 'DELETE'],
          apis: ['TMF666_Account', 'TMF620_ProductCatalog']
        }
      }
    };
  }

  async getFieldDetails(fieldName: string, fieldType: string): Promise<Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>> {
    return [];
  }
}

export const tmfServerService = new TMFServerService();
export const tmfService: TMFService = tmfServerService; 