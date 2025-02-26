import { NextApiRequest, NextApiResponse } from 'next';
import { 
  getEndpointContext, 
  getEndpointDocuments, 
  saveEndpointContext, 
  getEndpointData,
  Message,
  Document
} from '@/services/contextService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, endpointId } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Get existing context if endpointId is provided
    let existingContext: Message[] = [];
    let documentContext = '';
    let endpointContext = '';
    
    if (endpointId) {
      existingContext = await getEndpointContext(endpointId);
      
      // Get documents for this endpoint to provide as context
      const documents = await getEndpointDocuments(endpointId);
      if (documents.length > 0) {
        documentContext = `The user has provided the following documents for context:\n${
          documents.map((doc: { name: string; size: string; uploadedAt: string }) => 
            `- ${doc.name} (${doc.size}, uploaded at ${doc.uploadedAt})`
          ).join('\n')
        }\n\nPlease refer to this context when addressing the user's questions about endpoint mapping.`;
      }
      
      // Get endpoint data to provide as context
      const endpointData = await getEndpointData(endpointId);
      if (endpointData) {
        endpointContext = `
You are discussing the following TMF API endpoint:
- ID: ${endpointData.id}
- Name: ${endpointData.name}
- Path: ${endpointData.path}
- Method: ${endpointData.method}
- Description: ${endpointData.specification.description || 'No description available'}

This endpoint has the following fields:
${endpointData.specification.fields.map((field: { 
  name: string; 
  type: string; 
  required: boolean; 
  description?: string 
}) => 
  `- ${field.name} (${field.type}${field.required ? ', required' : ''}): ${field.description || 'No description'}`
).join('\n')}

The endpoint belongs to category: ${endpointData.specification.category || 'Uncategorized'}
`;
      }
    }

    // Combine incoming messages with existing context, but only use the last 10 messages
    // to avoid context window limitations
    const contextMessages = [...existingContext, ...messages].slice(-10);
    
    // Construct a system message that provides context to the AI
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant helping with TMF API endpoint mapping. ${documentContext}
${endpointContext}
Your goal is to assist the user in mapping fields between different endpoints by providing guidance
and answering questions about best practices for TMF API integration.`
    };

    // Mock response generation
    const lastUserMessage = messages[messages.length - 1].content;
    const aiResponse = generateMockResponse(lastUserMessage, documentContext, endpointContext);
    
    // Create the assistant's message
    const assistantMessage: Message = {
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString()
    };

    // Update user message with timestamp if it doesn't have one
    const updatedMessages = messages.map(msg => {
      if (msg.role === 'user' && !msg.timestamp) {
        return { ...msg, timestamp: new Date().toISOString() };
      }
      return msg;
    });

    // Save to context if endpointId is provided
    if (endpointId) {
      await saveEndpointContext(
        endpointId, 
        [...existingContext, ...updatedMessages, assistantMessage]
      );
    }

    // Return the message content directly as a string to avoid the React error
    return res.status(200).json({ 
      message: assistantMessage.content,
      savedContext: Boolean(endpointId)
    });
    
  } catch (error) {
    console.error('Error processing chat:', error);
    return res.status(500).json({ error: 'Failed to process chat request' });
  }
}

// Mock function to generate responses based on user input
function generateMockResponse(userMessage: string, documentContext: string, endpointContext: string): string {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return "Hello! I'm here to help with your TMF API endpoint mapping. How can I assist you today?";
  }
  
  if (lowerMessage.includes('document') || lowerMessage.includes('context')) {
    if (documentContext) {
      return "I've reviewed the documents you've uploaded. They provide helpful context for your endpoint mapping. What specific questions do you have about the mapping process?";
    } else {
      return "You haven't uploaded any documents yet. If you have documentation about your endpoints, uploading them would help me provide more accurate assistance.";
    }
  }
  
  if (lowerMessage.includes('endpoint') || lowerMessage.includes('details') || lowerMessage.includes('information')) {
    if (endpointContext) {
      return "I have the details of this endpoint available. It contains several fields that can be mapped. Would you like me to explain any specific field in more detail, or suggest how to map this endpoint to another API?";
    } else {
      return "I don't have specific details about this endpoint yet. It would be helpful if you could provide some information about the endpoint structure or upload documentation about it.";
    }
  }
  
  if (lowerMessage.includes('map') || lowerMessage.includes('field') || lowerMessage.includes('mapping')) {
    return "When mapping fields between endpoints, it's important to consider data types, cardinality, and semantic meaning. The TMF API uses a standard information model that helps align these concepts. Would you like me to explain more about a specific aspect of field mapping?";
  }
  
  return "I understand you're working on TMF API endpoint mapping. Could you provide more details about your specific question or challenge, and I'll do my best to help?";
} 