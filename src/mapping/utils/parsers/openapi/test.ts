import { OpenAPIParser } from './openapiParser';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Try to load environment variables from .env.local first, then .env
const envPath = path.resolve(__dirname, '../../../.env.local');
const defaultEnvPath = path.resolve(__dirname, '../../../.env');

dotenv.config({ path: envPath });
dotenv.config({ path: defaultEnvPath }); // This will not override existing env vars

async function test() {
  try {
    // Get API key from command line argument or environment variable
    const apiKey = process.argv[2] || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Please provide an OpenAI API key as a command line argument or set OPENAI_API_KEY environment variable');
    }

    // Initialize parser
    const parser = new OpenAPIParser({
      apiKey,
      batchSize: 5,
      temperature: 0.1
    });

    // Setup directories
    const repoPath = path.resolve(__dirname, '../../../Open_Api_And_Data_Model');
    const outputDir = path.resolve(__dirname, '../../../parsed-apis');
    
    // Create output directory if it doesn't exist
    await fsPromises.mkdir(outputDir, { recursive: true });

    // Clone the repository if it doesn't exist
    if (!fs.existsSync(repoPath)) {
      console.log('Cloning TM Forum repository...');
      const cloneCmd = `git clone https://github.com/rogerHuntGauntlet/Open_Api_And_Data_Model.git "${repoPath}"`;
      await exec(cloneCmd);
    }

    // Find all OpenAPI files in the repository
    const apiDirs = await fsPromises.readdir(path.join(repoPath, 'apis'));
    const apiFiles = await findOpenAPIFiles(path.join(repoPath, 'apis'));
    
    // Find APIs without swagger files
    const apisWithSwagger = new Set(apiFiles.map(file => {
      const parts = file.split(path.sep);
      const apiDirIndex = parts.indexOf('apis') + 1;
      return parts[apiDirIndex];
    }));
    
    const missingSwaggerApis = apiDirs.filter(dir => !apisWithSwagger.has(dir));
    
    console.log(`\nFound ${apiFiles.length} total OpenAPI files`);
    if (missingSwaggerApis.length > 0) {
      console.log('\nWARNING: The following APIs are missing swagger files:');
      missingSwaggerApis.forEach(api => console.log(`- ${api}`));
    }

    // Get list of already processed files
    const processedFiles = new Set(
      (await fsPromises.readdir(outputDir))
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
    );

    // Filter out already processed files
    const remainingFiles = apiFiles.filter(file => {
      const apiName = path.basename(path.dirname(path.dirname(file)));
      const isProcessed = processedFiles.has(apiName);
      if (!isProcessed) {
        console.log(`Found unprocessed API: ${apiName}`);
      }
      return !isProcessed;
    });

    console.log(`\n${processedFiles.size} files already processed`);
    console.log(`${remainingFiles.length} files remaining to process\n`);

    // Process each remaining file
    for (let i = 0; i < remainingFiles.length; i++) {
      const file = remainingFiles[i];
      const apiName = path.basename(path.dirname(path.dirname(file)));
      console.log(`Processing ${apiName} (${i + 1}/${remainingFiles.length})...`);
      
      try {
        const content = await fsPromises.readFile(file, 'utf-8');
        const endpoints = await parser.parseContent(content);
        
        // Save results
        const outputPath = path.join(outputDir, `${apiName}.json`);
        
        await fsPromises.writeFile(
          outputPath,
          JSON.stringify({
            api: apiName,
            version: path.basename(file).match(/v\d+\.\d+\.\d+/)?.[0] || 'unknown',
            endpoints
          }, null, 2),
          'utf-8'
        );
        
        console.log(`✓ Saved ${endpoints.length} endpoints to ${outputPath}`);
      } catch (error) {
        console.error(`✗ Error processing ${file}:`, error);
      }
    }

    if (remainingFiles.length === 0) {
      console.log('\nAll files have already been processed!');
    } else {
      console.log(`\nCompleted processing ${remainingFiles.length} new files`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

async function findOpenAPIFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  async function walk(directory: string) {
    try {
      const entries = await fsPromises.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          // Look in all directories for potential swagger files
          const dirFiles = await fsPromises.readdir(fullPath);
          for (const file of dirFiles) {
            if (file.endsWith('.swagger.json') || file.endsWith('.yaml') || file.endsWith('.json')) {
              // For .json files, check if they're actually swagger files by reading first few lines
              if (file.endsWith('.json') && !file.endsWith('.swagger.json')) {
                try {
                  const content = await fsPromises.readFile(path.join(fullPath, file), 'utf-8');
                  const firstLines = content.split('\n').slice(0, 10).join('\n');
                  if (!firstLines.includes('"swagger"') && !firstLines.includes('"openapi"')) {
                    continue;
                  }
                } catch (error) {
                  continue;
                }
              }
              console.log(`Found API file: ${path.join(fullPath, file)}`);
              files.push(path.join(fullPath, file));
            }
          }
          // Continue walking subdirectories
          await walk(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error walking directory ${directory}:`, error);
    }
  }
  
  await walk(dir);
  return files;
}

async function exec(command: string): Promise<void> {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(command, (error: Error | null) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

test(); 