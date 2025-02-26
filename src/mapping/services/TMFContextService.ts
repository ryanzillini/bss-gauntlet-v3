import { TMFEndpoint } from './TMFService';
import { EndpointContext, MappingContext, ContextAnalysisResult } from '../types/TMFTypes';

export class TMFContextService {
  private async analyzeEndpointSemantics(endpoint: TMFEndpoint): Promise<ContextAnalysisResult> {
    try {
      const response = await fetch('/api/analyze-endpoint-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: endpoint.path,
          method: endpoint.method,
          name: endpoint.name,
          description: endpoint.specification.description,
          fields: endpoint.specification.fields,
          category: endpoint.specification.category
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || 'Failed to analyze endpoint context'
        };
      }

      const context = await response.json();
      return {
        success: true,
        context
      };
    } catch (error) {
      console.error('Error analyzing endpoint semantics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async findDocumentationMatches(
    context: EndpointContext,
    docId: string
  ): Promise<MappingContext> {
    try {
      const response = await fetch('/api/find-documentation-matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context,
          docId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to find documentation matches');
      }

      return await response.json();
    } catch (error) {
      console.error('Error finding documentation matches:', error);
      throw error;
    }
  }

  public async generateMappingContext(
    endpoint: TMFEndpoint,
    docId: string
  ): Promise<MappingContext> {
    const analysisResult = await this.analyzeEndpointSemantics(endpoint);
    
    if (!analysisResult.success || !analysisResult.context) {
      throw new Error(analysisResult.error || 'Failed to analyze endpoint context');
    }

    return await this.findDocumentationMatches(analysisResult.context, docId);
  }
}

export const tmfContextService = new TMFContextService(); 