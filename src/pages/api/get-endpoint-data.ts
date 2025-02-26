import { NextApiRequest, NextApiResponse } from 'next';
import { tmfService } from '../../services/TMFService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpointId, docId } = req.query;
    
    if (!endpointId || typeof endpointId !== 'string') {
      return res.status(400).json({ error: 'Endpoint ID is required' });
    }
    
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({ error: 'Document ID is required' });
    }
    
    // Search for the endpoint using the TMF service
    const result = await tmfService.searchEndpoints({
      docId,
      query: endpointId // Use the ID as the query to find the exact endpoint
    });
    
    // Find the endpoint with the matching ID
    const endpoint = result.endpoints.find(ep => ep.id === endpointId);
    
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    
    return res.status(200).json({ endpoint });
  } catch (error) {
    console.error('Error getting endpoint data:', error);
    return res.status(500).json({ error: 'Failed to get endpoint data' });
  }
} 