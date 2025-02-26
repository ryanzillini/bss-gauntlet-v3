import { NextApiRequest, NextApiResponse } from 'next';
import { removeEndpointDocument } from '../../services/contextService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpointId, documentId } = req.query;
    
    if (!endpointId || typeof endpointId !== 'string') {
      return res.status(400).json({ error: 'Endpoint ID is required' });
    }
    
    if (!documentId || typeof documentId !== 'string') {
      return res.status(400).json({ error: 'Document ID is required' });
    }
    
    // Remove the document from the endpoint context
    await removeEndpointDocument(endpointId, documentId);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error removing document:', error);
    return res.status(500).json({ error: 'Failed to remove document' });
  }
} 