import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[process-endpoint-with-ai] Request received: ', req.body);
  
  const { endpoint } = req.body;
  
  if (!endpoint || !endpoint.path || !endpoint.method) {
    return res.status(400).json({ error: 'Missing endpoint data - both path and method are required' });
  }
 
  console.log('[process-endpoint-with-ai] Processing endpoint:', endpoint.path, 'method:', endpoint.method, "_original:", endpoint);
  console.log('[process-endpoint-with-ai] Complete endpoint keys:', Object.keys(endpoint));
  
  // Check if we have filtered configData 
  if (endpoint.configData) {
    console.log('[process-endpoint-with-ai] Found configData in endpoint object. Keys:', Object.keys(endpoint.configData));
    
    // Log only selective information to avoid overwhelming logs
    try {
      // Show configData type without full content
      const configDataSummary = Object.keys(endpoint.configData).reduce((summary: any, key: string) => {
        const value = endpoint.configData[key];
        
        if (typeof value === 'object' && value !== null) {
          summary[key] = Array.isArray(value) 
            ? `Array[${value.length}]` 
            : `Object(${Object.keys(value).join(', ')})`;
        } else {
          summary[key] = value;
        }
        
        return summary;
      }, {});
      
      console.log('[process-endpoint-with-ai] ConfigData summary:', configDataSummary);
    } catch (e) {
      console.log('Unable to summarize configData:', e);
    }
  } else {
    console.log('[process-endpoint-with-ai] No configData found in endpoint data');
  }
  
  console.log('[process-endpoint-with-ai] ENDPOINT SUMMARY:');
  try {
    // Only log essential data
    const endpointSummary = {
      path: endpoint.path,
      method: endpoint.method,
      description: endpoint.description,
      hasConfigData: !!endpoint.configData,
      configDataKeys: endpoint.configData ? Object.keys(endpoint.configData) : [],
      _original: endpoint._original
    };
    console.log(JSON.stringify(endpointSummary, null, 2));
  } catch (e) {
    console.log('Unable to stringify endpoint summary:', e);
  }

  const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!CLAUDE_API_KEY && !OPENAI_API_KEY) {
    console.error('[process-endpoint-with-ai] No AI API keys available');
    return res.status(500).json({ error: 'No AI API configuration available' });
  }

  // Construct a prompt focused on extracting fields from the endpoint data
  let prompt = `
    I'm providing you with information about a specific API endpoint. Your task is to analyze this data 
    and extract ALL fields/properties that are part of this endpoint's request or response structure.
    
    IMPORTANT: You need to identify fields from:
    1. URL parameters like {id}
    2. Request body fields if this is a POST/PUT/PATCH method
    3. Response body fields that would be returned
    
    Endpoint Information:
    - Path: ${endpoint.path}
    - Method: ${endpoint.method}
    - Description: ${endpoint.description}
    
    API Type: ${endpoint.configData?.type ? "GraphQL" : 
              endpoint.configData?.resource ? "TMF API" : 
              endpoint.configData?.pathData ? "OpenAPI/Swagger" : "Generic API"}
    
    ${endpoint.configData ? `The endpoint data includes the following configuration sections:
    ${Object.keys(endpoint.configData).join(', ')}` : "No specific configuration data available."}
    
    FULL ENDPOINT DATA (with configuration):
    ${JSON.stringify(endpoint, null, 2)}
    
    Your task:
    1. Carefully analyze the provided endpoint data
    2. Extract ALL fields related to this endpoint, including all nested properties within objects
    3. For each field, determine if it's a parameter (URL/query param) or response field
    4. For each field, provide name, type, description, required status, field location, and if it has a parent object
    
    Return the fields in this precise structure:
    [
      {
        "name": "fieldName",
        "type": "string|number|boolean|object|array|etc",
        "description": "Description of what this field represents",
        "required": true/false,
        "fieldLocation": "parameter|response", // Indicate if this is a parameter or response field
        "hasParent": true/false, // Indicate if this field is nested within a parent object
        "parentName": "user" // Name of immediate parent object if hasParent is true
      }
    ]
    
    IMPORTANT NOTES:
    - List ALL fields as individual entries, including nested ones
    - For nested fields, indicate the parent object using hasParent and parentName
    - Only include fields that actually exist in the API data
    - Do not invent field names or make assumptions
    - If no fields can be determined from the data, return an empty array
    - Do not include parent objects themselves in the output, only their child fields
  `;
  console.log('[process-endpoint-with-ai] Preparing to send prompt to AI...');
  
  try {
    // First try with Claude
    if (CLAUDE_API_KEY) {
      console.log('[process-endpoint-with-ai] Trying Claude API...');
      
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({
        apiKey: CLAUDE_API_KEY,
      });
      
      const claudePayload = {
        model: "claude-3-sonnet-20240229",
        max_tokens: 4000,
        temperature: 0.2,
        system: "You are an API documentation specialist tasked with finding and normalizing ALL fields from an API endpoint structure. Analyze the endpoint data to find fields in URL parameters, request body, and response body. Return ONLY a JSON array of field objects with no additional text.",
        messages: [
          {
            role: "user" as const, 
            content: prompt
          }
        ]
      };
      
      console.log('[process-endpoint-with-ai] Claude API payload prepared (not logging full content)');
      
      try {
        const claudeResponse = await anthropic.messages.create(claudePayload);
        console.log('[process-endpoint-with-ai] Claude API response received with structure:', Object.keys(claudeResponse));
        
        // Extract structured data from message content
        let fieldsData = [];
        try {
          // Access the content correctly based on the type
          const contentBlock = claudeResponse.content[0];
          const responseText = 'text' in contentBlock ? contentBlock.text : '';
          
          console.log('[process-endpoint-with-ai] Processing Claude response text...');
          
          // Extract JSON array from response text
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            fieldsData = JSON.parse(jsonMatch[0]);
          } else {
            // If it couldn't extract JSON array, try parsing the whole response
            try {
              fieldsData = JSON.parse(responseText);
            } catch (e) {
              console.error('[process-endpoint-with-ai] Failed to parse as JSON, treating as empty array');
              fieldsData = [];
            }
          }
        } catch (parseError) {
          console.error('[process-endpoint-with-ai] Failed to parse Claude response:', parseError);
          // Fallback to OpenAI if available
          if (OPENAI_API_KEY) {
            console.log('[process-endpoint-with-ai] Falling back to OpenAI due to Claude parsing error');
            throw new Error('Failed to parse Claude response - falling back to OpenAI');
          }
          return res.status(500).json({ error: 'Failed to parse AI response' });
        }
        
        console.log(`[process-endpoint-with-ai] Extracted ${fieldsData.length} normalized fields`);
        
        return res.status(200).json({
          success: true,
          endpoint: endpoint,
          fields: fieldsData
        });
      } catch (claudeError) {
        console.error('[process-endpoint-with-ai] Claude API error:', claudeError);
        
        // Fallback to OpenAI if available
        if (OPENAI_API_KEY) {
          console.log('[process-endpoint-with-ai] Falling back to OpenAI due to Claude error');
        } else {
          return res.status(500).json({ error: 'Claude API error and no fallback available' });
        }
      }
    }
    
    // Try OpenAI if Claude not available or failed
    if (OPENAI_API_KEY) {
      console.log('[process-endpoint-with-ai] Using OpenAI API...');
      
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });
      
      try {
        const openaiResponse = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content: "You are an API documentation specialist tasked with finding and normalizing ALL fields from an API endpoint structure. Analyze the endpoint data to find fields in URL parameters, request body, and response body. Return ONLY a JSON array of field objects with no additional text."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        });
        
        console.log('[process-endpoint-with-ai] OpenAI response received');
        const content = openaiResponse.choices[0].message.content;
        
        if (!content) {
          return res.status(500).json({ error: 'Empty response from OpenAI' });
        }
        
        // Parse the JSON response
        let fieldsData = [];
        try {
          const parsedResponse = JSON.parse(content);
          fieldsData = parsedResponse.fields || [];
        } catch (parseError) {
          console.error('[process-endpoint-with-ai] Failed to parse OpenAI response:', parseError);
          return res.status(500).json({ error: 'Failed to parse AI response' });
        }
        
        console.log(`[process-endpoint-with-ai] Extracted ${fieldsData.length} normalized fields from OpenAI`);
        
        return res.status(200).json({
          success: true,
          endpoint: endpoint,
          fields: fieldsData
        });
      } catch (openaiError) {
        console.error('[process-endpoint-with-ai] OpenAI API error:', openaiError);
        return res.status(500).json({ error: 'AI processing failed' });
      }
    }
    
  } catch (error) {
    console.error('[process-endpoint-with-ai] Error processing endpoint:', error);
    return res.status(500).json({ error: 'Failed to process endpoint' });
  }
} 