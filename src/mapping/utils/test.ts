import { parseHtmlContent } from './parsers/html/parseHtmlContent';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Try to load environment variables from .env.local first, then .env
const envPath = path.resolve(__dirname, '../.env.local');
const defaultEnvPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });
dotenv.config({ path: defaultEnvPath }); // This will not override existing env vars

async function test() {
  try {
    // Get API key from command line argument or environment variable
    const apiKey = process.argv[2] || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Please provide an OpenAI API key as a command line argument or set OPENAI_API_KEY environment variable');
    }

    const url = 'https://docs.api.totogi.com/';
    console.log('Fetching and parsing API documentation from:', url);
    console.log('Using API key:', apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 4));
    
    const endpoints = await parseHtmlContent(url, apiKey);
    
    console.log('\nFound', endpoints.length, 'operations');
    
    // Save the results to a file
    await fs.writeFile(
      'api-docs-parsed.json', 
      JSON.stringify({ endpoints }, null, 2),
      'utf-8'
    );
    
    console.log('\nResults have been saved to api-docs-parsed.json');
    
    // Print first 2 operations as sample
    if (endpoints.length > 0) {
      console.log('\nSample operations:');
      endpoints.slice(0, 2).forEach((op, i) => {
        console.log(`\n${i + 1}. ${op.name} (${op.type})`);
        console.log('Description:', op.description);
        if (op.parameters?.length) {
          console.log('Parameters:', op.parameters.length);
        }
        if (op.response) {
          console.log('Returns:', op.response.type);
        }
      });
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test(); 