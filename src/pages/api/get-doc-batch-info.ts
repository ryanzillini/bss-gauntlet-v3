import { NextApiRequest, NextApiResponse } from 'next';
import { DocumentationProcessor } from '../../services/DocumentationProcessor';

// Simple in-memory cache to avoid repeated processing of the same URLs
const resultsCache = new Map<string, { timestamp: number, data: any }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[get-doc-batch-info] Request received:', {
      method: req.method,
      url: req.body.url
    });

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Check cache first
    const cachedResult = resultsCache.get(url);
    const now = Date.now();
    
    if (cachedResult && (now - cachedResult.timestamp) < CACHE_TTL) {
      console.log('[get-doc-batch-info] Returning cached result for URL:', url);
      // Set cache-control headers
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.status(200).json({
        ...cachedResult.data,
        fromCache: true
      });
    }

    // Process the request if not cached
    const processor = new DocumentationProcessor(process.env.OPENAI_API_KEY || '');
    
    console.log('[get-doc-batch-info] Analyzing documentation to get batch estimates');
    const batchInfo = await processor.getDocumentationBatches(url);
    console.log('[get-doc-batch-info] Batch analysis complete:', batchInfo);

    // Prepare response
    const response = {
      batchInfo,
      estimatedProcessingTimeMinutes: Math.ceil(batchInfo.estimatedProcessingTime / 60),
      documentType: batchInfo.documentType
    };

    // Cache the result
    resultsCache.set(url, {
      timestamp: now,
      data: response
    });

    // Cleanup old cache entries
    const urlsToDelete: string[] = [];
    resultsCache.forEach((entry, cacheUrl) => {
      if (now - entry.timestamp > CACHE_TTL) {
        urlsToDelete.push(cacheUrl);
      }
    });
    
    // Delete expired cache entries
    urlsToDelete.forEach(expiredUrl => {
      resultsCache.delete(expiredUrl);
    });

    // Set cache-control headers
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).json(response);
  } catch (error) {
    console.error('[get-doc-batch-info] Error analyzing documentation:', error);
    res.status(500).json({ 
      error: 'Failed to analyze documentation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 