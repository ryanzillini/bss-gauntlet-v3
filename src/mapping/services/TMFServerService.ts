import { TMFEndpoint, TMFFile, TMFService } from './TMFService';

export class TMFServerService implements TMFService {
  async listTMFFiles(): Promise<{ id: string; name: string }[]> {
    try {
      const response = await fetch('/api/tmf-service?action=listFiles');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to list TMF files');
      }
      return await response.json();
    } catch (error) {
      console.error('Error listing TMF files:', error);
      throw error;
    }
  }

  async loadTMFFile(fileId: string): Promise<TMFFile> {
    try {
      const response = await fetch(`/api/tmf-service?action=loadFile&fileId=${fileId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load TMF file');
      }
      return await response.json();
    } catch (error) {
      console.error('Error loading TMF file:', error);
      throw error;
    }
  }

  async searchEndpoints(fileId: string, query: string = '', method: string = '', page: number = 1, limit: number = 10) {
    try {
      const tmfFile = await this.loadTMFFile(fileId);
      let filteredEndpoints = tmfFile.endpoints;

      // Apply search filters
      if (query) {
        const searchTerms = query.toLowerCase().split(' ');
        filteredEndpoints = filteredEndpoints.filter(endpoint => {
          const searchText = `${endpoint.path} ${endpoint.name} ${endpoint.specification.description}`.toLowerCase();
          return searchTerms.every(term => searchText.includes(term));
        });
      }

      if (method) {
        filteredEndpoints = filteredEndpoints.filter(endpoint => endpoint.method === method.toUpperCase());
      }

      // Calculate pagination
      const totalEndpoints = filteredEndpoints.length;
      const totalPages = Math.ceil(totalEndpoints / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      return {
        results: filteredEndpoints.slice(startIndex, endIndex),
        metadata: {
          total: totalEndpoints,
          page,
          limit,
          totalPages,
          filters: {
            methods: [...new Set(tmfFile.endpoints.map(e => e.method))],
            apis: [fileId]
          }
        }
      };
    } catch (error) {
      console.error('Error searching endpoints:', error);
      throw error;
    }
  }

  async getFieldDetails(fieldName: string, fieldType: string): Promise<Array<{ name: string; type: string; required: boolean; description: string }>> {
    try {
      const response = await fetch(`/api/tmf-service?action=getFieldDetails&fieldName=${encodeURIComponent(fieldName)}&fieldType=${encodeURIComponent(fieldType)}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get field details');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting field details:', error);
      throw error;
    }
  }
}

export const tmfServerService = new TMFServerService(); 