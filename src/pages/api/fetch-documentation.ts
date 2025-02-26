import { NextApiRequest, NextApiResponse } from 'next';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

interface EndpointInfo {
  path: string;
  method: string;
  description: string;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  responses?: Array<{
    code: string;
    description: string;
    schema?: any;
  }>;
  matchReason?: string;
  confidenceScore?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[fetch-documentation] Request received:', {
    method: req.method,
    headers: req.headers,
    body: {
      url: req.body?.url,
      checkOnly: req.body?.checkOnly
    }
  });

  if (req.method !== 'POST') {
    console.log('[fetch-documentation] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, checkOnly } = req.body;

  if (!url) {
    console.log('[fetch-documentation] Missing URL in request body');
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log('[fetch-documentation] Starting documentation fetch process');
    console.log('[fetch-documentation] URL:', url);
    console.log('[fetch-documentation] Check only mode:', checkOnly);

    // Validate URL format
    try {
      new URL(url);
    } catch (urlError) {
      console.error('[fetch-documentation] Invalid URL format:', urlError);
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log('[fetch-documentation] Fetching documentation...');
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/json,*/*',
        'User-Agent': 'BSS Documentation Fetcher',
        'Origin': process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || 'http://localhost:3000'
      }
    });

    if (!response.ok) {
      const error = `Failed to fetch documentation: ${response.status} ${response.statusText}`;
      console.error('[fetch-documentation] ' + error);
      return res.status(response.status).json({ error });
    }

    // If checkOnly is true, just return success
    if (checkOnly) {
      console.log('[fetch-documentation] Check only mode - returning successful response');
      return res.status(200).json({ 
        success: true, 
        contentType: response.headers.get('content-type') 
      });
    }

    const contentType = response.headers.get('content-type');
    const content = await response.text();

    console.log('[fetch-documentation] Successfully fetched content:', {
      contentType,
      contentLength: content.length,
      status: response.status
    });

    // Set appropriate headers
    res.setHeader('Content-Type', contentType || 'text/plain');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Send the response
    res.status(200).send(content);
  } catch (error) {
    console.error('[fetch-documentation] Error fetching documentation:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ 
      error: 'Failed to fetch documentation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 