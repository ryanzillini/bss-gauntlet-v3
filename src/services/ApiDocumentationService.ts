import { DocumentationMappingService } from '../mapping/services/DocumentationMappingService';
import { saveMappingToDb, updateMappingInDb, getMappingFromDb } from '../utils/supabase-client';
import { DocumentationProcessor, ProcessingProgress } from './DocumentationProcessor';

interface ApiDocumentationResult {
  id: string;
  name: string;
  created_at: string;
  status: string;
}

interface DocumentationMetadata {
  title: string;
  description: string;
  type: string;
}

export class ApiDocumentationService {
  private mappingService: DocumentationMappingService;
  private docProcessor: DocumentationProcessor;
  private apiKey: string | undefined;

  // Cache for batch information to prevent redundant processing
  private static batchInfoCache = new Map<string, {
    timestamp: number;
    data: any;
  }>();
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(openaiApiKey?: string) {
    this.apiKey = openaiApiKey;
    this.mappingService = new DocumentationMappingService(openaiApiKey || '');
    this.docProcessor = new DocumentationProcessor(openaiApiKey || '');
  }

  isOpenAIConfigured(): boolean {
    return !!this.apiKey;
  }

  private async evaluateDocumentation(url: string): Promise<DocumentationMetadata> {
    console.log('[ApiDocumentationService] Evaluating documentation content from:', url);
    
    try {
      // Use the proxy endpoint to fetch content
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

      if (!response.ok) {
        throw new Error(`Failed to fetch documentation: ${response.status}`);
      }

      const content = await response.text();
      
      // Use server-side OpenAI endpoint for evaluation
      const evaluationResponse = await fetch(typeof window === 'undefined'
        ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/evaluate-documentation`
        : '/api/evaluate-documentation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.substring(0, 2000),
          url
        })
      });

      if (!evaluationResponse.ok) {
        throw new Error('Failed to evaluate documentation with AI');
      }

      const metadata = await evaluationResponse.json();
      console.log('[ApiDocumentationService] AI Evaluation complete:', metadata);
      
      return {
        title: metadata.title,
        description: metadata.description,
        type: 'documentation'
      };
    } catch (error) {
      console.error('[ApiDocumentationService] Error evaluating documentation:', error);
      return {
        title: new URL(url).hostname,
        description: 'API Documentation',
        type: 'documentation'
      };
    }
  }

  async saveApiDocumentation(
    apiDocUrl: string, 
    apiKey?: string,
    endpointBaseUrl?: string
  ): Promise<ApiDocumentationResult> {
    try {
      console.log('[ApiDocumentationService] Starting documentation save process for:', apiDocUrl);

      // First evaluate the documentation with AI
      const metadata = await this.evaluateDocumentation(apiDocUrl);
      console.log('[ApiDocumentationService] Documentation metadata:', metadata);

      // First analyze the documentation to get batch information
      console.log('[ApiDocumentationService] Analyzing documentation to get batch estimates');
      const batchInfo = await this.docProcessor.getDocumentationBatches(apiDocUrl);
      console.log('[ApiDocumentationService] Documentation batch analysis complete:', batchInfo);

      // Create the initial record in processing state
      const now = new Date();
      const estimatedCompletionTime = new Date(now.getTime() + batchInfo.estimatedProcessingTime * 1000);
      
      const initialMapping = {
        name: metadata.title,
        description: metadata.description,
        status: 'processing',
        type: metadata.type,
        config: {
          processingStarted: now.toISOString(),
          estimatedCompletionTime: estimatedCompletionTime.toISOString(),
          batchInfo: {
            estimatedTotalEndpoints: batchInfo.estimatedTotalEndpoints,
            estimatedTotalBatches: batchInfo.estimatedTotalBatches,
            estimatedProcessingTime: batchInfo.estimatedProcessingTime,
            documentType: batchInfo.documentType
          },
          processingProgress: {
            processedEndpoints: 0,
            totalEndpoints: batchInfo.estimatedTotalEndpoints,
            estimatedTimeRemaining: batchInfo.estimatedProcessingTime,
            type: batchInfo.documentType,
            lastUpdate: now.toISOString()
          }
        },
        api_docs: apiDocUrl,
        api_key: apiKey,
        api_url: endpointBaseUrl
      };

      console.log('[ApiDocumentationService] Saving initial mapping to database');
      const savedMapping = await saveMappingToDb(initialMapping);
      console.log('[ApiDocumentationService] Initial mapping saved:', savedMapping.id);

      // Start processing in the background
      console.log('[ApiDocumentationService] Starting background processing');
      this.processDocumentation(savedMapping.id)
        .then(() => {
          console.log('[ApiDocumentationService] Background processing completed successfully');
        })
        .catch(error => {
          console.error('[ApiDocumentationService] Background processing failed:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
          updateMappingInDb(savedMapping.id, { 
            status: 'error',
            config: { 
              error: error instanceof Error ? error.message : 'Unknown error',
              processingEnded: new Date().toISOString()
            }
          }).catch(e => console.error('[ApiDocumentationService] Failed to update error status:', e));
        });

      return {
        id: savedMapping.id,
        name: savedMapping.name,
        created_at: savedMapping.created_at,
        status: savedMapping.status
      };
    } catch (error) {
      console.error('[ApiDocumentationService] Error saving documentation:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async processDocumentation(id: string): Promise<void> {
    console.log('[ApiDocumentationService] Starting documentation processing for ID:', id);
    let progressInterval: NodeJS.Timeout | undefined;
    
    try {
      // Get the mapping
      const mapping = await getMappingFromDb(id);
      if (!mapping) {
        throw new Error('Mapping not found');
      }

      // Start progress updates before processing
      progressInterval = setInterval(async () => {
        try {
          const currentMapping = await getMappingFromDb(id);
          if (!currentMapping || currentMapping.status !== 'processing') {
            clearInterval(progressInterval);
            progressInterval = undefined;
            return;
          }

          const now = new Date();
          const startTime = new Date(currentMapping.config?.processingStarted || now).getTime();
          const elapsedTime = (now.getTime() - startTime) / 1000;
          
          // Calculate remaining time based on progress or fallback to initial estimate
          let estimatedTimeRemaining = Math.max(300 - elapsedTime, 0);
          const progress = currentMapping.config?.processingProgress;
          
          if (progress && progress.totalEndpoints > 0 && progress.processedEndpoints > 0) {
            // If we have real progress data, calculate a more accurate estimate
            const percentComplete = progress.processedEndpoints / progress.totalEndpoints;
            if (percentComplete > 0 && percentComplete < 1) {
              // Estimate remaining time based on elapsed time and percent complete
              const estimatedTotalTime = elapsedTime / percentComplete;
              estimatedTimeRemaining = Math.max(estimatedTotalTime - elapsedTime, 0);
              
              // Add a small buffer for unexpected delays
              estimatedTimeRemaining = estimatedTimeRemaining * 1.1;
              
              console.log('[ApiDocumentationService] Updated time estimate:', {
                percentComplete: `${(percentComplete * 100).toFixed(1)}%`,
                elapsedTime: `${elapsedTime.toFixed(1)}s`,
                estimatedTotalTime: `${estimatedTotalTime.toFixed(1)}s`,
                estimatedRemaining: `${estimatedTimeRemaining.toFixed(1)}s`,
                estimatedMinutesRemaining: `${Math.ceil(estimatedTimeRemaining / 60)} minutes`
              });
            }
          }
          
          // Update estimated completion time
          const estimatedCompletionTime = new Date(now.getTime() + estimatedTimeRemaining * 1000);
          
          await updateMappingInDb(id, {
            config: {
              ...currentMapping.config,
              estimatedCompletionTime: estimatedCompletionTime.toISOString(),
              processingProgress: {
                ...currentMapping.config?.processingProgress,
                estimatedTimeRemaining,
                lastUpdate: now.toISOString()
              }
            }
          });
        } catch (error) {
          console.error('[ApiDocumentationService] Error in progress update:', error);
          // Clear interval on error to prevent continuous failing calls
          clearInterval(progressInterval);
          progressInterval = undefined;
        }
      }, 2000);

      // Process documentation through server endpoint
      const response = await fetch('/api/process-documentation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: mapping.api_docs
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to process documentation');
      }

      const result = await response.json();
      
      // Clear the progress interval
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = undefined;
      }

      // Update mapping with final results
      await updateMappingInDb(id, {
        status: 'active',
        config: {
          processed: true,
          processedAt: new Date().toISOString(),
          type: result.type,
          format: result.metadata.format,
          version: result.metadata.version,
          endpoints: result.endpoints,
          processingProgress: {
            processedEndpoints: result.endpoints.length,
            totalEndpoints: result.endpoints.length,
            estimatedTimeRemaining: 0,
            type: result.type,
            lastUpdate: new Date().toISOString()
          }
        }
      });

      console.log('[ApiDocumentationService] Documentation processing completed successfully');
    } catch (error) {
      console.error('[ApiDocumentationService] Error processing documentation:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error'
      });

      // Clear the progress interval
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = undefined;
      }

      // Update mapping with error
      await updateMappingInDb(id, {
        status: 'error',
        config: {
          processed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          processedAt: new Date().toISOString()
        }
      });
    }
  }

  async getDocumentationBatchInfo(apiDocUrl: string): Promise<{
    estimatedTotalEndpoints: number;
    estimatedTotalBatches: number;
    documentType: string;
    estimatedProcessingTime: number;
    estimatedProcessingTimeMinutes: number;
  }> {
    console.log('[ApiDocumentationService] Getting batch information for URL:', apiDocUrl);
    
    try {
      // Check cache first
      const cachedInfo = ApiDocumentationService.batchInfoCache.get(apiDocUrl);
      const now = Date.now();
      
      if (cachedInfo && (now - cachedInfo.timestamp < ApiDocumentationService.CACHE_TTL)) {
        console.log('[ApiDocumentationService] Using cached batch information');
        return cachedInfo.data;
      }
      
      // If not in cache, get fresh data
      const batchInfo = await this.docProcessor.getDocumentationBatches(apiDocUrl);
      
      const result = {
        ...batchInfo,
        estimatedProcessingTimeMinutes: Math.ceil(batchInfo.estimatedProcessingTime / 60)
      };
      
      // Cache the result
      ApiDocumentationService.batchInfoCache.set(apiDocUrl, {
        timestamp: now,
        data: result
      });
      
      // Cleanup old cache entries
      const urlsToDelete: string[] = [];
      ApiDocumentationService.batchInfoCache.forEach((entry, url) => {
        if (now - entry.timestamp > ApiDocumentationService.CACHE_TTL) {
          urlsToDelete.push(url);
        }
      });
      
      urlsToDelete.forEach(url => {
        ApiDocumentationService.batchInfoCache.delete(url);
      });
      
      return result;
    } catch (error) {
      console.error('[ApiDocumentationService] Error getting batch information:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
} 