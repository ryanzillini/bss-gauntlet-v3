import { NextApiRequest, NextApiResponse } from 'next';
import { DocumentationProcessor } from '../../services/DocumentationProcessor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[process-documentation] Request received:', {
      method: req.method,
      url: req.body.url
    });

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const processor = new DocumentationProcessor(process.env.OPENAI_API_KEY || '');
    
    // Get batch information first
    console.log('[process-documentation] Analyzing documentation to get batch estimates');
    const batchInfo = await processor.getDocumentationBatches(url);
    console.log('[process-documentation] Batch analysis complete:', batchInfo);

    // If skipProcessing is true, only return batch information
    if (req.body.skipProcessing === true) {
      return res.status(200).json({
        batchInfo,
        documentType: batchInfo.documentType
      });
    }
    
    // Track progress
    let currentProgress = {
      processedEndpoints: 0,
      totalEndpoints: batchInfo.estimatedTotalEndpoints,
      estimatedTimeRemaining: batchInfo.estimatedProcessingTime
    };

    const result = await processor.processDocumentation(url, (progress) => {
      console.log('[process-documentation] Progress update:', progress);
      currentProgress = {
        processedEndpoints: progress.processedEndpoints,
        totalEndpoints: progress.totalEndpoints,
        estimatedTimeRemaining: progress.estimatedTimeRemaining
      };
    });

    // Include progress and batch info in the result
    const response = {
      ...result,
      progress: currentProgress,
      batchInfo
    };

    console.log('[process-documentation] Documentation processed successfully');
    res.status(200).json(response);
  } catch (error) {
    console.error('[process-documentation] Error processing documentation:', error);
    res.status(500).json({ 
      error: 'Failed to process documentation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 