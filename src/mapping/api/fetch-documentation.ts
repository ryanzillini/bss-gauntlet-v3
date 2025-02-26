import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import { parseHtmlContent } from '../utils/parsers/html/parseHtmlContent';

// Helper function to get base URL for requests
function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
}

// Helper function to get origin header
function getOriginHeader(): string {
  return getBaseUrl();
}

// Helper function to check if a response indicates a CORS error
function isCorsError(error: Error): boolean {
  return error.message.toLowerCase().includes('cors') || 
         error.message.toLowerCase().includes('blocked by access control');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[fetch-documentation] Starting request processing');
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('[fetch-documentation] Fetching documentation from:', url);

    // First try direct fetch
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Vercel Serverless Function',
          'Origin': getOriginHeader()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const content = await response.text();

      console.log('[fetch-documentation] Successfully fetched content:', {
        contentType,
        contentLength: content.length
      });

      // Process content based on type
      if (contentType.includes('application/json')) {
        return res.status(200).json({ content: JSON.parse(content) });
      } else if (contentType.includes('text/html')) {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OpenAI API key is required for parsing HTML content');
        }
        const parsedContent = await parseHtmlContent(content, process.env.OPENAI_API_KEY);
        return res.status(200).json({ content: parsedContent });
      } else {
        return res.status(200).json({ content });
      }

    } catch (error) {
      console.error('[fetch-documentation] Direct fetch failed:', error);

      // If CORS error, try proxy fetch
      if (error instanceof Error && isCorsError(error)) {
        console.log('[fetch-documentation] CORS error detected, attempting proxy fetch');
        
        const proxyResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Vercel Serverless Function'
          }
        });

        if (!proxyResponse.ok) {
          throw new Error(`Proxy fetch failed! status: ${proxyResponse.status}`);
        }

        const contentType = proxyResponse.headers.get('content-type') || '';
        const content = await proxyResponse.text();

        console.log('[fetch-documentation] Successfully fetched content via proxy:', {
          contentType,
          contentLength: content.length
        });

        if (contentType.includes('application/json')) {
          return res.status(200).json({ content: JSON.parse(content) });
        } else if (contentType.includes('text/html')) {
          if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is required for parsing HTML content');
          }
          const parsedContent = await parseHtmlContent(content, process.env.OPENAI_API_KEY);
          return res.status(200).json({ content: parsedContent });
        } else {
          return res.status(200).json({ content });
        }
      }

      // If not a CORS error or proxy fetch failed, throw the original error
      throw error;
    }

  } catch (error) {
    console.error('[fetch-documentation] Error processing request:', error);
    return res.status(500).json({
      error: 'Failed to fetch documentation',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
} 