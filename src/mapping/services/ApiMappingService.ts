import { ApiEndpoint, TMFEndpoint, MappingSuggestion } from '../types';

export class ApiMappingService {
  constructor() {}

  async generateMappingSuggestions(
    sourceEndpoints: ApiEndpoint[],
    targetEndpoints: TMFEndpoint[]
  ): Promise<MappingSuggestion[]> {
    // Implementation will be added later
    return [];
  }
}

export const apiMappingService = new ApiMappingService(); 