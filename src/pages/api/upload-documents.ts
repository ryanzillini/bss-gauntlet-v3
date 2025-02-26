import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import { addEndpointDocument, Document } from '../../services/contextService';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Disable body parser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form with files
    const data: any = await new Promise((resolve, reject) => {
      const form = new IncomingForm({
        multiples: true,
        keepExtensions: true,
      });
      
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });
    
    const { fields, files } = data;
    const { endpointId } = fields;
    
    if (!endpointId || typeof endpointId !== 'string') {
      return res.status(400).json({ error: 'Endpoint ID is required' });
    }
    
    // In a real implementation, you would store files in a proper storage service
    // like AWS S3, Google Cloud Storage, etc. 
    // For this demo, we'll just simulate storing document metadata
    
    // Process each uploaded file
    const documentFiles = Array.isArray(files.documents) ? files.documents : [files.documents];
    let uploadedCount = 0;
    
    for (const file of documentFiles) {
      if (!file) continue;
      
      // Generate a unique ID for the document
      const docId = uuidv4();
      
      // In a real system, this is where you'd upload to cloud storage
      // For now, we'll simulate by just reading the file
      // const fileContents = await fs.readFile(file.filepath, 'utf8');
      
      // Create document record
      const document: Document = {
        id: docId,
        name: file.originalFilename || 'unnamed-file',
        size: formatFileSize(file.size),
        path: file.filepath,
        contentType: file.mimetype || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
      };
      
      // Add document to endpoint context
      await addEndpointDocument(endpointId, document);
      uploadedCount++;
    }
    
    return res.status(200).json({ 
      success: true, 
      uploaded: uploadedCount 
    });
    
  } catch (error) {
    console.error('Error uploading documents:', error);
    return res.status(500).json({ error: 'Failed to upload documents' });
  }
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  else return (bytes / 1073741824).toFixed(1) + ' GB';
} 