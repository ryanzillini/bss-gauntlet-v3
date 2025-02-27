import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../utils/supabase-client';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enable streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { messages, endpointId, docId, mappingStatus } = req.body;

    if (!messages || !endpointId || !docId) {
      res.write(`data: ${JSON.stringify({ error: 'Missing required fields' })}\n\n`);
      res.end();
      return;
    }

    // Get endpoint details
    const { data: endpoint, error: endpointError } = await supabase
      .from('bss_endpoints')
      .select('*')
      .eq('id', endpointId)
      .single();

    if (endpointError) {
      console.error('[ai-chat] Endpoint fetch error:', endpointError);
      res.write(`data: ${JSON.stringify({ error: 'Failed to fetch endpoint details' })}\n\n`);
      res.end();
      return;
    }

    // Get ALL available mappings for this documentation
    const { data: allMappings, error: allMappingsError } = await supabase
      .from('bss_mappings')
      .select('*')
      .eq('show', true);

    if (allMappingsError) {
      console.error('[ai-chat] All mappings fetch error:', allMappingsError);
      res.write(`data: ${JSON.stringify({ error: 'Failed to fetch all mappings' })}\n\n`);
      res.end();
      return;
    }

    // Get current mapping details
    const { data: currentMapping, error: mappingError } = await supabase
      .from('bss_endpoint_mappings')
      .select('*')
      .eq('endpoint_id', endpointId)
      .eq('doc_id', docId)
      .single();

    if (mappingError && mappingError.code !== 'PGRST116') {
      console.error('[ai-chat] Current mapping fetch error:', mappingError);
      res.write(`data: ${JSON.stringify({ error: 'Failed to fetch current mapping details' })}\n\n`);
      res.end();
      return;
    }

    // Get specific documentation details
    const { data: docDetails, error: docError } = await supabase
      .from('bss_mappings')

      .select('*')
      .eq('show', true)
      .eq('id', docId)
      .single();

    if (docError) {
      console.error('[ai-chat] Documentation fetch error:', docError);
      res.write(`data: ${JSON.stringify({ error: 'Failed to fetch documentation details' })}\n\n`);
      res.end();
      return;
    }

    // Check if the last message indicates a request for detailed analysis or endpoint review
    const lastUserMessage = messages[messages.length - 1];
    const messageContent = lastUserMessage.content.toLowerCase();
    
    const isEndpointReviewRequested = 
      messageContent.includes('wrong endpoint') || 
      messageContent.includes('incorrect endpoint') ||
      messageContent.includes('look again') ||
      messageContent.includes('find better') ||
      messageContent.includes('more appropriate') ||
      messageContent.includes('different endpoint');

    const isDetailedAnalysisRequested = 
      messageContent.includes('analyze') || 
      messageContent.includes('specific') ||
      messageContent.includes('detailed') ||
      messageContent.includes('look through');

    // Extract all available endpoints from mappings
    const availableEndpoints = allMappings
      .filter(m => m.endpoints && Array.isArray(m.endpoints))
      .flatMap(m => m.endpoints)
      .filter(Boolean);

    // Prepare system message with context
    const systemMessage = {
      role: 'system',
      content: `You are a specialized API mapping assistant with deep knowledge of TMF APIs and BSS integration patterns.
      
      Current Context:
      TMF Endpoint: ${endpoint.path} (${endpoint.method})
      - Name: ${endpoint.name}
      - Description: ${endpoint.specification.description}
      
      Fields to Map:
      ${endpoint.specification.fields.map((f: { name: string; type: string; required: boolean; description: string }) => 
        `- ${f.name} (${f.type})${f.required ? ' [Required]' : ''}: ${f.description}`
      ).join('\n')}
      
      Current Mapping Status:
      - Mapped: ${mappingStatus.mappedFields}/${mappingStatus.totalFields} fields (${Math.round((mappingStatus.mappedFields / mappingStatus.totalFields) * 100)}%)
      - Unmapped Required Fields: ${mappingStatus.unmappedRequiredFields.join(', ')}
      
      ${isEndpointReviewRequested ? `
      Endpoint Review Mode:
      You must:
      1. Analyze all available endpoints in the documentation
      2. Compare endpoint purposes, fields, and data structures
      3. Look for semantic matches in endpoint descriptions and field names
      4. Consider the business context and use case
      5. Suggest better endpoint matches if found
      6. Explain why a different endpoint might be more appropriate
      7. Detail the potential mapping improvements with the suggested endpoint

      Available Endpoints in Documentation:
      ${JSON.stringify(availableEndpoints, null, 2)}
      ` : isDetailedAnalysisRequested ? `
      Detailed Analysis Mode:
      - Perform thorough field-by-field analysis
      - Consider field name similarity, data types, and semantic meaning
      - Check for common BSS field patterns and naming conventions
      - Analyze field descriptions for contextual clues
      - Look for specific transformation requirements
      - Consider business logic implications
      - Validate against TMF standards
      ` : `
      Standard Assistance Mode:
      - Help with general mapping questions
      - Provide guidance on specific fields when asked
      - Explain existing mappings
      - Suggest basic improvements
      `}

      Current Mappings:
      ${mappingStatus.mappings.map((m: any) => 
        `- ${m.target} ← ${m.source}${m.transform ? ` (Transform: ${m.transform})` : ''}`
      ).join('\n')}

      Documentation Context:
      ${docDetails ? `- Name: ${docDetails.name}
      - Type: ${docDetails.type}
      - Description: ${docDetails.description || 'N/A'}
      - API URL: ${docDetails.api_url || 'N/A'}
      - Success Rate: ${docDetails.success_rate || 'N/A'}
      - Available Endpoints: ${JSON.stringify(docDetails.endpoints || [], null, 2)}
      - Configuration: ${JSON.stringify(docDetails.config || {}, null, 2)}` : 'No additional documentation context available'}

      When analyzing or suggesting mappings:
      1. Focus on semantic meaning over exact name matches
      2. Consider field type compatibility and required transformations
      3. Prioritize required fields that are still unmapped
      4. Reference specific TMF standards when applicable
      5. Consider common BSS integration patterns
      6. Look for field naming patterns in existing mappings
      7. Suggest specific transformations when needed

      Be precise and specific in your responses, avoiding generic advice unless explicitly requested.
      If asked to review endpoints or find better matches, you MUST analyze the available documentation thoroughly.`
    };

    // Call OpenAI API with streaming
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 100000,
        temperature: (isEndpointReviewRequested || isDetailedAnalysisRequested) ? 0.3 : 0.7,
        stream: true,
        messages: [
          systemMessage,
          ...messages.map((m: any) => ({
            role: m.role,
            content: m.content
          }))
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[ai-chat] Claude API error:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      throw new Error(`Failed to get response from Claude API: ${response.status} ${response.statusText}`);
    }

    const stream = response.body;
    if (!stream) {
      throw new Error('No response stream from Claude API');
    }

    // Stream the response
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsedData = JSON.parse(data);
              if (parsedData.type === 'content_block_delta' && parsedData.delta?.text) {
                res.write(`data: ${JSON.stringify({ content: parsedData.delta.text })}\n\n`);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[ai-chat] Error:', error);
    res.write(`data: ${JSON.stringify({ 
      error: 'Failed to process chat',
      details: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
    res.end();
  }
} 