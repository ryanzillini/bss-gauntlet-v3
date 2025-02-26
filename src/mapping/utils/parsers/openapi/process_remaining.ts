import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { OpenAPIParser } from './openapiParser';
import { OpenAIConfig } from '../types';

const REMAINING_APIS = [
  'TMF915_AI_Management',
  'TMF908-IoT_Agent_and_Device',
  'TMF710_General_Test_Artifact',
  'TMF709_Test_Scenario',
  'TMF708_Test_Execution',
  'TMF707_Test_Result',
  'TMF706_Test_Data',
  'TMF705_Test_Environment',
  'TMF704_Test_Case',
  'TMF703_Entity_Inventory',
  'TMF702_Resource_Activation',
  'TMF701_Process_Flow',
  'TMF699_Sales',
  'TMF696_Risk_Management',
  'TMF668_Partnership'
];

async function processRemainingApis() {
  const openaiConfig: OpenAIConfig = {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4'
  };
  
  const parser = new OpenAPIParser(openaiConfig);
  const baseDir = path.resolve(__dirname, '../../../Open_Api_And_Data_Model/apis');
  const outputDir = path.resolve(__dirname, '../../../parsed-apis');

  for (const apiName of REMAINING_APIS) {
    console.log(`\nProcessing ${apiName}...`);
    
    try {
      // Find swagger files for this API
      const apiDir = path.join(baseDir, apiName, 'swaggers');
      const swaggerFiles = await fsPromises.readdir(apiDir);
      const swaggerFile = swaggerFiles.find(f => f.endsWith('.swagger.json') || f.endsWith('.yaml'));
      
      if (!swaggerFile) {
        console.error(`No swagger file found for ${apiName}`);
        continue;
      }

      // Read and parse the file
      const filePath = path.join(apiDir, swaggerFile);
      const content = await fsPromises.readFile(filePath, 'utf-8');
      const endpoints = await parser.parseContent(content);
      
      // Save results
      const outputPath = path.join(outputDir, `${apiName}.json`);
      await fsPromises.writeFile(
        outputPath,
        JSON.stringify({
          api: apiName,
          version: swaggerFile.match(/v\d+\.\d+\.\d+/)?.[0] || 'unknown',
          endpoints
        }, null, 2),
        'utf-8'
      );
      
      console.log(`Saved ${endpoints.length} endpoints to ${outputPath}`);
    } catch (error) {
      console.error(`Error processing ${apiName}:`, error);
    }
  }
}

processRemainingApis().catch(console.error); 