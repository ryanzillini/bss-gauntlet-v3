import { NextApiRequest, NextApiResponse } from 'next';
import { tmfServerService } from '../../mapping/services/TMFServerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query = '', method = '', page = '1', limit = '10', fileId = 'TMF666_Account' } = req.query;

    console.log('Searching endpoints with params:', { fileId, query, method, page, limit });

    const results = await tmfServerService.searchEndpoints(
      fileId as string,
      query as string,
      method as string,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    res.status(200).json(results);
  } catch (error) {
    console.error('Error details:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    res.status(500).json({ error: 'Failed to search TMF endpoints', details: error instanceof Error ? error.message : String(error) });
  }
} 