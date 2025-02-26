import { NextApiRequest, NextApiResponse } from 'next';
import { documentationService } from '../../services/DocumentationService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { docId } = req.query;

    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({ 
        error: 'Missing or invalid docId parameter'
      });
    }

    const documentation = await documentationService.getDocumentationById(docId);

    return res.status(200).json({
      success: true,
      data: documentation
    });

  } catch (error) {
    console.error('[get-documentation] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch documentation'
    });
  }
} 