import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[evaluate-documentation] Request received');

    const { content, url } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const prompt = `You are evaluating an API documentation. Based on the content, provide a concise title and description.
    The title should be short (max 5 words) but descriptive. The description should be 1-2 sentences explaining what this API does.
    
    Content: ${content}...
    
    Respond in JSON format:
    {
      "title": "string",
      "description": "string"
    }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const result = completion.choices[0].message.content;
    if (!result) {
      throw new Error('Empty response from OpenAI');
    }

    const metadata = JSON.parse(result);
    console.log('[evaluate-documentation] Evaluation complete:', metadata);
    
    res.status(200).json(metadata);
  } catch (error) {
    console.error('[evaluate-documentation] Error:', error);
    res.status(500).json({ 
      error: 'Failed to evaluate documentation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 