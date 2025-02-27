import { NextApiRequest, NextApiResponse } from 'next';
import { bedrockClient } from '@/utils/aws-config';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { OntologyMapping } from '@/types/mapping';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sourceSchema, documentation } = req.body;

    if (!sourceSchema || !documentation) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prepare the prompt for Bedrock
    const prompt = {
      prompt: `Given the following API schema and documentation, suggest a mapping to TM Forum APIs:
      
Source Schema:
${JSON.stringify(sourceSchema, null, 2)}

Documentation:
${documentation}

Generate a mapping configuration that follows this structure:
${JSON.stringify(OntologyMapping.shape, null, 2)}`,
      max_tokens: 100000,
      temperature: 0.7,
    };

    // Call Amazon Bedrock
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-v2',
      body: JSON.stringify(prompt),
      contentType: 'application/json',
    });

    const response = await bedrockClient.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));

    // Parse and validate the mapping
    const mapping = OntologyMapping.parse(JSON.parse(result.completion));

    return res.status(200).json(mapping);
  } catch (error) {
    console.error('Error generating mapping:', error);
    return res.status(500).json({ error: 'Failed to generate mapping' });
  }
} 