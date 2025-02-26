import { NextApiRequest, NextApiResponse } from 'next';
import { documentationService } from '../../services/DocumentationService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { docId } = req.query;
    console.log('[get-document-endpoints] Request received for docId:', docId);

    if (!docId || typeof docId !== 'string') {
      console.error('[get-document-endpoints] Missing or invalid docId parameter:', docId);
      return res.status(400).json({ 
        error: 'Missing or invalid docId parameter'
      });
    }

    // Get the documentation with endpoints
    console.log('[get-document-endpoints] Fetching documentation for docId:', docId);
    const documentation = await documentationService.getDocumentationById(docId);
    console.log('[get-document-endpoints] Documentation fetched, checking for endpoints');
    
    // Extract just the endpoints
    const endpoints = documentation.endpoints || [];
    console.log('[get-document-endpoints] Found endpoints:', endpoints.length);
    
    if (endpoints.length === 0) {
      console.log('[get-document-endpoints] No endpoints found in documentation. Documentation structure:', JSON.stringify(documentation, null, 2).substring(0, 500) + '...');
    } else {
      console.log('[get-document-endpoints] First endpoint sample:', JSON.stringify(endpoints[0], null, 2));
    }

    return res.status(200).json({
      success: true,
      endpoints: endpoints.map((endpoint: any) => {
        const mappedEndpoint = {
          id: endpoint.id || endpoint.path,
          path: endpoint.path,
          method: endpoint.method,
          description: endpoint.description || ''
        };
        return mappedEndpoint;
      })
    });

  } catch (error) {
    console.error('[get-document-endpoints] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch document endpoints'
    });
  }
} 