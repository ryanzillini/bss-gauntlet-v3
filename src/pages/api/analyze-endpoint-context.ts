import OpenAI from 'openai';
import { NextApiRequest, NextApiResponse } from 'next';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { path, method, name, description, fields, category } = req.body;

    const prompt = `Analyze this API endpoint and generate a comprehensive context:

Endpoint Information:
- Path: ${path}
- Method: ${method}
- Name: ${name}
- Category: ${category}
- Description: ${description}

Fields:
${fields.map((f: any) => `- ${f.name} (${f.type}): ${f.description}`).join('\n')}

Based on this information, provide a structured analysis in JSON format with the following:

{
  "alternativeTerms": [], // Alternative terms and phrases that could describe this endpoint's purpose
  "useCases": [], // Common business scenarios where this endpoint would be used
  "businessProcesses": [], // Key business processes this endpoint supports
  "relatedConcepts": [], // Technical and business concepts related to this endpoint
  "semanticProfile": {
    "domain": "", // The business domain this endpoint belongs to
    "purpose": "", // The core purpose of this endpoint
    "dataModel": "" // Description of the data model this endpoint handles
  }
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 8000
      })
    });

    const completion = await response.json();
    
    // Extract JSON from Claude's response which might be wrapped in markdown
    let jsonText = completion.content[0].text || '{}';
    
    // If the response starts with markdown formatting or explanatory text
    // Try to extract JSON content from a code block if it exists
    if (jsonText.includes('```json')) {
      // Extract content between ```json and ``` markers
      const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    } else if (jsonText.includes('```')) {
      // Try with just ``` if ```json is not found
      const match = jsonText.match(/```\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }
    
    // As a fallback, try to find content that looks like JSON (starts with { and ends with })
    if (!jsonText.startsWith('{')) {
      const match = jsonText.match(/(\{[\s\S]*\})/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }
    
    try {
      const context = JSON.parse(jsonText);
      res.status(200).json(context);
    } catch (jsonError) {
      console.error('Failed to parse JSON from Claude response:', jsonError);
      console.log('Raw response:', jsonText);
      res.status(500).json({ error: 'Failed to parse AI response as JSON' });
    }
  } catch (error) {
    console.error('Error in analyze-endpoint-context:', error);
    res.status(500).json({ error: 'Failed to analyze endpoint context' });
  }
} 