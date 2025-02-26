import { NextApiRequest, NextApiResponse } from 'next';
import { 
  getEndpointContext, 
  saveEndpointContext, 
  clearEndpointMessages,
  Message
} from '../../services/contextService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { endpointId } = req.query;
  
  if (!endpointId || typeof endpointId !== 'string') {
    return res.status(400).json({ error: 'Endpoint ID is required' });
  }

  // GET: Retrieve context for an endpoint
  if (req.method === 'GET') {
    try {
      const context = await getEndpointContext(endpointId);
      
      if (!context) {
        return res.status(200).json({ messages: [] });
      }
      
      return res.status(200).json({ messages: context.messages });
    } catch (error) {
      console.error('Error getting endpoint context:', error);
      return res.status(500).json({ error: 'Failed to get endpoint context' });
    }
  }
  
  // POST: Save context for an endpoint
  else if (req.method === 'POST') {
    try {
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
      }
      
      await saveEndpointContext(endpointId, messages as Message[]);
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error saving endpoint context:', error);
      return res.status(500).json({ error: 'Failed to save endpoint context' });
    }
  }
  
  // DELETE: Clear context for an endpoint
  else if (req.method === 'DELETE') {
    try {
      await clearEndpointMessages(endpointId);
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error clearing endpoint context:', error);
      return res.status(500).json({ error: 'Failed to clear endpoint context' });
    }
  }
  
  // Other methods not allowed
  else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 