import { NextApiRequest, NextApiResponse } from 'next';
import https from 'https';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Use node-fetch with custom agent to handle SSL/TLS issues
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/json,*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      // @ts-ignore
      agent: new https.Agent({
        rejectUnauthorized: false // Only for development - remove in production
      })
    });

    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json') 
      ? await response.json()
      : await response.text();

    return res.status(200).json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data
    });
  } catch (error) {
    console.error('[proxy-documentation] Error fetching documentation:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch documentation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 