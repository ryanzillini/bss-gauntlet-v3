import { NextApiRequest, NextApiResponse } from 'next';
import { documentationService } from '../../services/DocumentationService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[get-graphql-fields] Request received:', req.query);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { docId, operationId } = req.query;

  if (!docId || !operationId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required parameters: docId and operationId are required' 
    });
  }

  try {
    console.log(`[get-graphql-fields] Fetching fields for GraphQL operation: ${operationId} in document: ${docId}`);
    
    // Get the documentation
    const documentation = await documentationService.getDocumentationById(docId as string);
    
    if (!documentation) {
      return res.status(404).json({ 
        success: false, 
        error: `Documentation not found for ID: ${docId}` 
      });
    }
    
    // Find the endpoint with the matching operationId
    const endpoints = documentation.endpoints || [];
    console.log(`[get-graphql-fields] Searching through ${endpoints.length} endpoints for operationId: ${operationId}`);
    
    const matchingEndpoint = endpoints.find((endpoint: any) => 
      endpoint.operationId === operationId || 
      (endpoint.path && endpoint.path.includes(`=${operationId}`))
    );
    
    if (!matchingEndpoint) {
      return res.status(404).json({ 
        success: false, 
        error: `GraphQL operation not found: ${operationId}` 
      });
    }
    
    console.log(`[get-graphql-fields] Found matching endpoint:`, {
      path: matchingEndpoint.path,
      method: matchingEndpoint.method,
      operationId: matchingEndpoint.operationId,
      fieldsCount: matchingEndpoint.fields?.length || 0
    });
    
    // Return the fields
    const fields = matchingEndpoint.fields || [];
    
    return res.status(200).json({ 
      success: true, 
      fields,
      endpoint: {
        path: matchingEndpoint.path,
        method: matchingEndpoint.method,
        description: matchingEndpoint.description,
        operationId: matchingEndpoint.operationId,
        graphqlType: matchingEndpoint.graphqlType
      }
    });
    
  } catch (error) {
    console.error('[get-graphql-fields] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 