// Instead of importing react-toastify directly, let's handle errors without toast
// import { toast } from 'react-toastify';

// Define interfaces for Logisense API format
interface LogisenseParameter {
  name: string;
  type?: string;
  description?: string;
  required?: boolean;
}

interface LogisenseEndpoint {
  name: string;
  method: string;
  path: string;
  description?: string;
  parameters?: LogisenseParameter[];
}

interface LogisenseAPI {
  name: string;
  source_file: string;
  endpoints: LogisenseEndpoint[];
}

interface LogisenseData {
  apis: LogisenseAPI[];
}

// Define the format expected by the dropdown
export interface DocumentEndpoint {
  id: string;
  path: string;
  method: string;
  description: string;
  fields?: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  operationId?: string;
  graphqlType?: string;
}

export interface DocumentItem {
  id: string;
  name: string;
}

export const logisenseService = {
  // Logisense document information
  LOGISENSE_DOC: {
    id: '0bcde642-a626-4fe8-8da3-c0d9d4e8bf9f',
    name: 'Logisense API'
  },
  
  /**
   * Ensures that Logisense is included in the list of available documents
   * @param documents The current list of documents
   * @returns An array of documents with Logisense included
   */
  ensureLogisenseInDocuments(documents: DocumentItem[] = []): DocumentItem[] {
    // Check if Logisense already exists in the documents list
    const logisenseExists = documents.some(doc => 
      doc.id === this.LOGISENSE_DOC.id || doc.name === this.LOGISENSE_DOC.name
    );
    
    // If it doesn't exist, add it
    if (!logisenseExists) {
      return [...documents, this.LOGISENSE_DOC];
    }
    
    // Otherwise, return the original list
    return documents;
  },

  /**
   * Fetch and transform Logisense API data into the format expected by the dropdown
   * @returns A promise that resolves to an array of formatted endpoints
   */
  async getLogisenseEndpoints(): Promise<DocumentEndpoint[]> {
    try {
      console.log('[logisenseService] Loading Logisense endpoints from local file');
      
      // Define the path to the Logisense API file
      let filePath = '/src/mapping/logisense/all_logisense_apis.json';
      console.log('[logisenseService] Trying relative path:', filePath);
      
      // First try loading from the relative path
      let response = await fetch(filePath);
      
      // If that fails, try the absolute path
      if (!response.ok) {
        console.log('[logisenseService] Relative path failed, trying absolute path...');
        
        // Use the absolute file path for Windows
        filePath = '/c:/Users/roger/Gauntlet_Projects/build2/src/mapping/logisense/all_logisense_apis.json';
        console.log('[logisenseService] Trying absolute path:', filePath);
        
        response = await fetch(filePath);
        
        if (!response.ok) {
          throw new Error(`Failed to load Logisense API file from both paths: ${response.status}`);
        }
      }
      
      // Parse the JSON data
      const logisenseData: LogisenseData = await response.json();
      console.log('[logisenseService] Data loaded successfully, processing APIs');
      
      if (!logisenseData || !logisenseData.apis || !Array.isArray(logisenseData.apis)) {
        throw new Error('Invalid Logisense API data format');
      }
      
      // Extract and transform endpoints
      const allEndpoints: DocumentEndpoint[] = [];
      
      for (const api of logisenseData.apis) {
        if (api.endpoints && Array.isArray(api.endpoints)) {
          for (const endpoint of api.endpoints) {
            allEndpoints.push({
              id: `${api.name}_${endpoint.name}`,
              path: endpoint.path,
              method: endpoint.method,
              description: endpoint.name,
              fields: endpoint.parameters ? endpoint.parameters.map(param => ({
                name: param.name,
                type: param.type || 'string',
                description: param.description || '',
                required: param.required || false
              })) : []
            });
          }
        }
      }
      
      // Sort endpoints by method and path
      const sortedEndpoints = [...allEndpoints].sort((a, b) => {
        // First sort by method
        const methodOrder: Record<string, number> = { 
          GET: 1, 
          POST: 2, 
          PUT: 3, 
          PATCH: 4, 
          DELETE: 5 
        };
        const methodA = methodOrder[a.method as keyof typeof methodOrder] || 99;
        const methodB = methodOrder[b.method as keyof typeof methodOrder] || 99;
        
        if (methodA !== methodB) return methodA - methodB;
        
        // Then sort by path
        return a.path.localeCompare(b.path);
      });
      
      console.log('[logisenseService] Processed endpoints:', sortedEndpoints.length);
      
      return sortedEndpoints;
    } catch (error) {
      console.error('[logisenseService] Error processing Logisense data:', error);
      // Remove toast notification from service layer
      // toast.error('Failed to load Logisense API definition');
      return [];
    }
  }
};

export default logisenseService; 