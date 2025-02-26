import { NextApiRequest, NextApiResponse } from 'next';
import { tmfServerService } from '../../mapping/services/TMFServerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const files = await tmfServerService.listTMFFiles();
    res.status(200).json(files);
  } catch (error) {
    console.error('Error listing TMF files:', error);
    res.status(500).json({ error: 'Failed to list TMF files' });
  }
} 