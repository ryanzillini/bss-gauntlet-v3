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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const context = JSON.parse(completion.choices[0].message?.content || '{}');
    res.status(200).json(context);
  } catch (error) {
    console.error('Error in analyze-endpoint-context:', error);
    res.status(500).json({ error: 'Failed to analyze endpoint context' });
  }
} 