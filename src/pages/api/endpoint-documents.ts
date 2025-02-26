import { NextApiRequest, NextApiResponse } from 'next';
import { getEndpointDocuments } from '../../services/contextService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { endpointId } = req.query;
  
  if (!endpointId || typeof endpointId !== 'string') {
    return res.status(400).json({ error: 'Endpoint ID is required' });
  }

  // GET: Retrieve documents for an endpoint
  if (req.method === 'GET') {
    try {
      const documents = await getEndpointDocuments(endpointId);
      
      return res.status(200).json({ documents });
    } catch (error) {
      console.error('Error getting endpoint documents:', error);
      return res.status(500).json({ error: 'Failed to get endpoint documents' });
    }
  }
  
  // Other methods not allowed
  else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 