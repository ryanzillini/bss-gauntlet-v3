import { NextApiRequest, NextApiResponse } from 'next';
import { saveEndpointData } from '../../services/contextService';
import { TMFEndpoint } from '../../services/TMFService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpointId, endpointData } = req.body;
    
    if (!endpointId || typeof endpointId !== 'string') {
      return res.status(400).json({ error: 'Endpoint ID is required' });
    }
    
    if (!endpointData) {
      return res.status(400).json({ error: 'Endpoint data is required' });
    }
    
    // Save the endpoint data
    await saveEndpointData(endpointId, endpointData as TMFEndpoint);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving endpoint data:', error);
    return res.status(500).json({ error: 'Failed to save endpoint data' });
  }
} 