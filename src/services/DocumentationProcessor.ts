import { OpenAPIParser } from '../mapping/utils/parsers/openapi/openapiParser';
import { GraphQLParser } from '../mapping/utils/parsers/graphql/graphqlParser';
import { RestParser } from '../mapping/utils/parsers/rest/restParser';
import { parseHtmlContent } from '../mapping/utils/parsers/html/parseHtmlContent';
import { ApiEndpoint } from '../mapping/utils/parsers/types';
import { OpenAIConfig } from '../mapping/utils/parsers/types';

export type DocumentationType = 'openapi' | 'graphql' | 'rest' | 'html';

interface ProcessedDocumentation {
  type: DocumentationType;
  endpoints: ApiEndpoint[];
  metadata: {
    processedAt: string;
    format: string;
    version?: string;
    processingStats?: {
      totalEndpoints: number;
      processedEndpoints: number;
      estimatedTimeRemaining: number; // in seconds
      startedAt: string;
      batchSize: number;
      averageTimePerBatch: number;
    };
  };
}

export interface ProcessingProgress {
  totalEndpoints: number;
  processedEndpoints: number;
  estimatedTimeRemaining: number;
  type: DocumentationType;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;

export class DocumentationProcessor {
  private static readonly BATCH_SIZE = 10;
  private openaiConfig: OpenAIConfig;

  constructor(apiKey: string) {
    this.openaiConfig = {
      apiKey,
      onProgress: (processed: number, total: number, avgTime: number) => {
        console.log('[DocumentationProcessor] OpenAI progress:', {
          processed,
          total,
          avgTimePerItem: `${avgTime.toFixed(2)}s`,
          estimatedRemaining: `${Math.ceil((total - processed) * avgTime / 60)}m`
        });
      }
    };
  }

  private async detectDocumentationType(content: string, contentType: string): Promise<DocumentationType> {
    console.log('[DocumentationProcessor] Detecting documentation type from content type:', contentType);
    
    // Check content type first
    if (contentType.includes('application/json')) {
      try {
        console.log('[DocumentationProcessor] Parsing JSON content');
        const json = JSON.parse(content);
        // Check for OpenAPI/Swagger
        if (json.swagger || json.openapi) {
          console.log('[DocumentationProcessor] Detected OpenAPI/Swagger format');
          return 'openapi';
        }
        // Check for GraphQL Schema
        if (json.data?.__schema || json.types || json.queryType) {
          console.log('[DocumentationProcessor] Detected GraphQL schema');
          return 'graphql';
        }
      } catch (e) {
        console.log('[DocumentationProcessor] JSON parsing failed, continuing with other checks');
      }
    }

    // Check for HTML content
    if (contentType.includes('text/html')) {
      console.log('[DocumentationProcessor] Analyzing HTML content');
      // Check for GraphQL specific markers in HTML
      if (content.includes('graphql') || content.includes('GraphQL') || 
          content.includes('query {') || content.includes('mutation {')) {
        console.log('[DocumentationProcessor] Detected GraphQL documentation in HTML');
        return 'graphql';
      }
      // Check for REST API markers
      if (content.includes('GET /') || content.includes('POST /') || 
          content.includes('PUT /') || content.includes('DELETE /')) {
        console.log('[DocumentationProcessor] Detected REST API documentation in HTML');
        return 'rest';
      }
      console.log('[DocumentationProcessor] No specific API format detected, treating as generic HTML');
      return 'html';
    }

    console.log('[DocumentationProcessor] No specific format detected, defaulting to REST');
    return 'rest';
  }

  async getDocumentationBatches(url: string): Promise<{
    estimatedTotalEndpoints: number,
    estimatedTotalBatches: number,
    documentType: DocumentationType,
    estimatedProcessingTime: number // in seconds
  }> {
    console.log('[DocumentationProcessor] Analyzing documentation to estimate batches for URL:', url);
    
    try {
      // Fetch documentation through proxy
      const proxyUrl = typeof window === 'undefined' 
        ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-documentation`
        : '/api/fetch-documentation';
        
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });

      if (!response?.ok) {
        throw new Error(`Failed to fetch documentation: ${response?.status} ${response?.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const content = await response.text();
      
      if (!content || content.length === 0) {
        throw new Error('Received empty content from documentation URL');
      }

      const type = await this.detectDocumentationType(content, contentType);
      
      // Estimate number of endpoints based on content type and content
      let estimatedEndpoints = 0;
      
      switch (type) {
        case 'openapi': {
          try {
            const json = JSON.parse(content);
            // Count paths and methods in OpenAPI
            const paths = json.paths || {};
            estimatedEndpoints = Object.keys(paths).reduce((count, path) => {
              const methods = Object.keys(paths[path]).filter(key => 
                ['get', 'post', 'put', 'delete', 'patch'].includes(key.toLowerCase())
              );
              return count + methods.length;
            }, 0);
          } catch (e) {
            // Fallback to content-based estimate
            estimatedEndpoints = Math.ceil(content.length / 5000);
          }
          break;
        }
        case 'graphql': {
          // Count type definitions and fields as a rough estimate
          const typeMatches = content.match(/type\s+\w+/g);
          const fieldMatches = content.match(/\w+\s*:\s*\w+/g);
          const typeCount = typeMatches ? typeMatches.length : 0;
          const fieldCount = fieldMatches ? fieldMatches.length : 0;
          estimatedEndpoints = Math.max(10, Math.floor((typeCount + fieldCount) / 2));
          break;
        }
        case 'html':
        case 'rest': {
          // For HTML/REST docs, estimate based on content size and common patterns
          const endpointPatterns = [
            /GET\s+\/[\w\/-]+/g,
            /POST\s+\/[\w\/-]+/g,
            /PUT\s+\/[\w\/-]+/g,
            /DELETE\s+\/[\w\/-]+/g,
            /PATCH\s+\/[\w\/-]+/g
          ];
          
          let patternCount = 0;
          endpointPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) patternCount += matches.length;
          });
          
          if (patternCount > 0) {
            estimatedEndpoints = patternCount;
          } else {
            // If no patterns found, use content length as fallback
            estimatedEndpoints = Math.ceil(content.length / 10000);
          }
          break;
        }
      }
      
      // Ensure reasonable minimum
      estimatedEndpoints = Math.max(estimatedEndpoints, 5);
      
      // Calculate number of batches
      const estimatedBatches = Math.ceil(estimatedEndpoints / DocumentationProcessor.BATCH_SIZE);
      
      // Estimate processing time (seconds) - assume average 20 seconds per batch
      const estimatedProcessingTime = estimatedBatches * 20;
      
      console.log('[DocumentationProcessor] Documentation batch analysis complete:', {
        documentType: type,
        estimatedEndpoints,
        estimatedBatches,
        estimatedProcessingTime: `${Math.ceil(estimatedProcessingTime / 60)} minutes`
      });
      
      return {
        estimatedTotalEndpoints: estimatedEndpoints,
        estimatedTotalBatches: estimatedBatches,
        documentType: type,
        estimatedProcessingTime
      };
    } catch (error) {
      console.error('[DocumentationProcessor] Error analyzing documentation batches:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async processDocumentation(
    url: string, 
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessedDocumentation> {
    const startTime = Date.now();
    console.log('[DocumentationProcessor] Starting documentation processing for URL:', url);
    
    try {
      // Always fetch through proxy to avoid CORS issues
      console.log('[DocumentationProcessor] Fetching documentation through proxy');
      const proxyUrl = typeof window === 'undefined' 
        ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-documentation`
        : '/api/fetch-documentation';
        
      console.log('[DocumentationProcessor] Using proxy URL:', proxyUrl);
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });

      if (!response?.ok) {
        const error = `Failed to fetch documentation: ${response?.status} ${response?.statusText}. Please ensure the URL is accessible and try again.`;
        console.error('[DocumentationProcessor] ' + error);
        throw new Error(error);
      }

      const contentType = response.headers.get('content-type') || '';
      console.log('[DocumentationProcessor] Received content type:', contentType);
      
      const content = await response.text();
      console.log('[DocumentationProcessor] Content length:', content.length);
      
      // Validate content
      if (!content || content.length === 0) {
        throw new Error('Received empty content from documentation URL');
      }

      // Log first 500 characters to verify content
      console.log('[DocumentationProcessor] Content preview:', content.substring(0, 500));

      const type = await this.detectDocumentationType(content, contentType);
      console.log('[DocumentationProcessor] Detected documentation type:', type);

      let endpoints: ApiEndpoint[] = [];
      let format = '';
      let version = '';
      let processingStats = {
        totalEndpoints: 0,
        processedEndpoints: 0,
        estimatedTimeRemaining: 0,
        startedAt: new Date().toISOString(),
        batchSize: DocumentationProcessor.BATCH_SIZE,
        averageTimePerBatch: 0
      };

      // Initialize progress with a reasonable estimate
      const initialProgress: ProcessingProgress = {
        totalEndpoints: 100, // Initial estimate
        processedEndpoints: 0,
        estimatedTimeRemaining: 300, // 5 minutes initial estimate
        type
      };
      
      if (onProgress) {
        console.log('[DocumentationProcessor] Sending initial progress update');
        onProgress(initialProgress);
      }

      const updateProgress = (processed: number, total: number, avgTime: number) => {
        const remaining = Math.ceil((total - processed) / DocumentationProcessor.BATCH_SIZE) * avgTime;
        const elapsedTime = (Date.now() - startTime) / 1000;
        
        processingStats = {
          ...processingStats,
          totalEndpoints: total,
          processedEndpoints: processed,
          estimatedTimeRemaining: remaining,
          averageTimePerBatch: avgTime
        };
        
        console.log('[DocumentationProcessor] Processing progress:', {
          processed,
          total,
          percentComplete: ((processed / total) * 100).toFixed(1) + '%',
          elapsedTime: elapsedTime.toFixed(1) + 's',
          estimatedRemaining: (remaining / 60).toFixed(1) + 'm',
          avgTimePerBatch: avgTime.toFixed(1) + 's'
        });
        
        if (onProgress) {
          onProgress({
            totalEndpoints: total,
            processedEndpoints: processed,
            estimatedTimeRemaining: remaining,
            type
          });
        }
      };

      // Process based on type
      console.log('[DocumentationProcessor] Starting content processing for type:', type);
      switch (type) {
        case 'openapi': {
          console.log('[DocumentationProcessor] Processing OpenAPI documentation');
          const parser = new OpenAPIParser(this.openaiConfig);
          console.log('[DocumentationProcessor] Parser created, starting content parsing...');
          endpoints = await parser.parseContent(content);
          console.log('[DocumentationProcessor] OpenAPI parsing complete, found endpoints:', endpoints.length);
          const json = JSON.parse(content);
          format = 'OpenAPI';
          version = json.swagger || json.openapi || '';
          break;
        }
        case 'graphql': {
          console.log('[DocumentationProcessor] Processing GraphQL documentation');
          const parser = new GraphQLParser(this.openaiConfig);
          console.log('[DocumentationProcessor] Parser created, starting content parsing...');
          endpoints = await parser.parseContent(content);
          console.log('[DocumentationProcessor] GraphQL parsing complete, found endpoints:', endpoints.length);
          format = 'GraphQL';
          break;
        }
        case 'rest': {
          console.log('[DocumentationProcessor] Processing REST documentation');
          const parser = new RestParser(this.openaiConfig);
          console.log('[DocumentationProcessor] Parser created, starting content parsing...');
          endpoints = await parser.parseContent(content);
          console.log('[DocumentationProcessor] REST parsing complete, found endpoints:', endpoints.length);
          format = 'REST';
          break;
        }
        case 'html': {
          console.log('[DocumentationProcessor] Processing HTML documentation');
          console.log('[DocumentationProcessor] Starting HTML content parsing...');
          endpoints = await parseHtmlContent(content, this.openaiConfig.apiKey);
          console.log('[DocumentationProcessor] HTML parsing complete, found endpoints:', endpoints.length);
          format = 'HTML';
          break;
        }
      }

      const processingTime = (Date.now() - startTime) / 1000;
      console.log('[DocumentationProcessor] Processing completed:', {
        type,
        format,
        endpointsFound: endpoints.length,
        totalTime: `${processingTime.toFixed(1)}s`,
        averageTimePerEndpoint: `${(processingTime / endpoints.length).toFixed(1)}s`
      });

      // Send final progress update
      if (onProgress) {
        onProgress({
          totalEndpoints: endpoints.length,
          processedEndpoints: endpoints.length,
          estimatedTimeRemaining: 0,
          type
        });
      }

      return {
        type,
        endpoints,
        metadata: {
          processedAt: new Date().toISOString(),
          format,
          version,
          processingStats
        }
      };
    } catch (error) {
      console.error('[DocumentationProcessor] Error processing documentation:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
} 