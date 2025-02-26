import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { TMFFile, TMFEndpoint } from '../../mapping/services/TMFService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query } = req;

  // Define paths
  const openApiPath = path.join(process.cwd(), 'src', 'mapping', 'Open_Api_And_Data_Model', 'apis');
  const schemasPath = path.join(process.cwd(), 'src', 'mapping', 'Open_Api_And_Data_Model', 'schemas');

  try {
    // Verify directories exist
    if (!fs.existsSync(openApiPath)) {
      console.error(`OpenAPI directory not found: ${openApiPath}`);
      throw new Error(`OpenAPI directory not found: ${openApiPath}`);
    }
    if (!fs.existsSync(schemasPath)) {
      console.error(`Schemas directory not found: ${schemasPath}`);
      throw new Error(`Schemas directory not found: ${schemasPath}`);
    }

    switch (method) {
      case 'GET':
        switch (query.action) {
          case 'listFiles':
            const dirs = fs.readdirSync(openApiPath)
              .filter(dir => fs.statSync(path.join(openApiPath, dir)).isDirectory());
            const files = dirs
              .map(dir => ({
                id: dir,
                name: dir
              }))
              .sort((a, b) => a.name.localeCompare(b.name));
            
            return res.status(200).json(files);

          case 'loadFile':
            const fileId = query.fileId as string;
            if (!fileId) {
              return res.status(400).json({ error: 'File ID is required' });
            }

            const swaggersPath = path.join(openApiPath, fileId, 'swaggers');
            if (!fs.existsSync(swaggersPath)) {
              throw new Error(`Swagger directory not found for ${fileId}`);
            }

            const swaggerFiles = fs.readdirSync(swaggersPath)
              .filter(file => file.endsWith('.swagger.json'))
              .sort((a, b) => b.localeCompare(a));

            if (swaggerFiles.length === 0) {
              throw new Error(`No swagger files found for ${fileId}`);
            }

            const latestSwagger = swaggerFiles[0];
            const filePath = path.join(swaggersPath, latestSwagger);
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const openApiData = JSON.parse(fileContent);

            const processedEndpoints: TMFEndpoint[] = (await Promise.all(
              Object.entries(openApiData.paths || {}).map(async ([pathUrl, pathItem]: [string, any]) => {
                const methodEndpoints = await Promise.all(
                  Object.entries(pathItem || {}).map(async ([method, operation]: [string, any]) => {
                    if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                      // Extract fields with schema details
                      const fields = extractOpenApiFields(operation, schemasPath);
                      
                      // Eagerly load field details for each field that has a schema reference
                      const fieldsWithDetails = await Promise.all(
                        fields.map(async field => {
                          if (field.schema?.$ref) {
                            const details = await searchSchemaDefinition(
                              field.name,
                              field.type,
                              schemasPath
                            );
                            return {
                              ...field,
                              details
                            };
                          }
                          return field;
                        })
                      );

                      return {
                        id: `${pathUrl}-${method}`,
                        name: operation.operationId || operation.summary || `${method} ${pathUrl}`,
                        path: pathUrl,
                        method: method.toUpperCase(),
                        specification: {
                          name: operation.summary || `${method} ${pathUrl}`,
                          description: operation.description || '',
                          fields: fieldsWithDetails,
                          category: operation.tags?.[0] || 'Uncategorized'
                        }
                      } as TMFEndpoint;
                    }
                    return null;
                  })
                );
                return methodEndpoints.filter((endpoint): endpoint is TMFEndpoint => endpoint !== null);
              })
            )).flat();

            const tmfFile: TMFFile = {
              id: fileId,
              name: openApiData.info?.title || fileId,
              description: openApiData.info?.description || '',
              endpoints: processedEndpoints
            };

            return res.status(200).json(tmfFile);

          case 'getFieldDetails':
            const { fieldName, fieldType } = query;
            if (!fieldName || !fieldType) {
              return res.status(400).json({ error: 'Field name and type are required' });
            }

            const schemaDetails = await searchSchemaDefinition(fieldName as string, fieldType as string, schemasPath);
            return res.status(200).json(schemaDetails);

          default:
            return res.status(400).json({ error: 'Invalid action' });
        }

      default:
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('TMF Service Error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
  }
}

function loadSchema(schemaRef: string, schemasPath: string): any {
  try {
    console.log('Loading schema ref:', schemaRef);
    
    // Handle #/definitions/ format
    if (schemaRef.startsWith('#/definitions/')) {
      const definitionName = schemaRef.replace('#/definitions/', '');
      const baseTypeName = definitionName.split('_')[0];
      console.log('Handling definitions reference:', { definitionName, baseTypeName });
      
      // Function to recursively search directories
      const searchDirectory = (dirPath: string): string | null => {
        console.log('Searching directory:', dirPath);
        const entries = fs.readdirSync(dirPath);
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry);
          const stats = fs.statSync(fullPath);
          
          if (stats.isDirectory()) {
            const found = searchDirectory(fullPath);
            if (found) return found;
          } else if (stats.isFile() && 
                    entry.toLowerCase() === `${baseTypeName.toLowerCase()}.schema.json`) {
            console.log('Found schema file:', fullPath);
            return fullPath;
          }
        }
        return null;
      };

      const schemaPath = searchDirectory(schemasPath);
      if (!schemaPath) {
        console.warn('Schema file not found:', baseTypeName);
        return null;
      }

      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent);
      console.log('Found schema file with definitions:', {
        title: schema.title,
        availableDefinitions: schema.definitions ? Object.keys(schema.definitions) : []
      });
      
      // Look for the specific definition
      if (schema.definitions?.[definitionName]) {
        const result = schema.definitions[definitionName];
        console.log('Found specific definition:', definitionName);
        return {
          ...result,
          definitions: schema.definitions // Keep definitions for nested references
        };
      }
      // If specific definition not found, try base type
      if (schema.definitions?.[baseTypeName]) {
        const result = schema.definitions[baseTypeName];
        console.log('Using base type definition:', baseTypeName);
        return {
          ...result,
          definitions: schema.definitions
        };
      }
      return null;
    }
    
    // Handle relative path references (e.g., "../EngagedParty/PartyAccount.schema.json#PartyAccount")
    const [filePath, definition] = schemaRef.split('#');
    
    // Determine the normalized path
    let normalizedPath = '';
    
    if (filePath.startsWith('.')) {
      // Handle relative paths
      normalizedPath = path.join(schemasPath, ...filePath.split('/').filter(p => p !== '..'));
    } else if (filePath.includes('/')) {
      // Handle absolute paths within schemas directory
      normalizedPath = path.join(schemasPath, filePath);
    } else {
      // Try to find the schema file recursively
      const baseTypeName = filePath.split('_')[0];
      const searchDirectory = (dirPath: string): string | null => {
        const entries = fs.readdirSync(dirPath);
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry);
          const stats = fs.statSync(fullPath);
          
          if (stats.isDirectory()) {
            const found = searchDirectory(fullPath);
            if (found) return found;
          } else if (stats.isFile() && 
                    entry.toLowerCase() === `${baseTypeName.toLowerCase()}.schema.json`) {
            return fullPath;
          }
        }
        return null;
      };

      const foundPath = searchDirectory(schemasPath);
      if (!foundPath) {
        console.warn('Schema file not found:', filePath);
        return null;
      }
      normalizedPath = foundPath;
    }
    
    console.log('Looking for schema at:', normalizedPath);
    
    if (!fs.existsSync(normalizedPath)) {
      console.warn('Schema file not found:', normalizedPath);
      return null;
    }

    const schemaContent = fs.readFileSync(normalizedPath, 'utf-8');
    const schema = JSON.parse(schemaContent);
    console.log('Loaded schema:', { 
      title: schema.title, 
      hasDefinitions: !!schema.definitions,
      availableDefinitions: schema.definitions ? Object.keys(schema.definitions) : []
    });

    // If there's a specific definition referenced
    if (definition) {
      if (schema.definitions?.[definition]) {
        const result = {
          ...schema.definitions[definition],
          definitions: schema.definitions // Keep definitions for nested references
        };
        console.log('Resolved definition:', { 
          title: result.title,
          properties: Object.keys(result.properties || {})
        });
        return result;
      }
      // Try base type if specific definition not found
      const baseType = definition.split('_')[0];
      if (schema.definitions?.[baseType]) {
        const result = {
          ...schema.definitions[baseType],
          definitions: schema.definitions
        };
        console.log('Using base type definition:', { 
          title: result.title,
          properties: Object.keys(result.properties || {})
        });
        return result;
      }
    }

    // Return the whole schema if no definition specified or not found
    console.log('Using full schema:', { 
      title: schema.title,
      properties: Object.keys(schema.properties || {})
    });
    return schema;
  } catch (error) {
    console.error('Error loading schema:', error);
    return null;
  }
}

interface SchemaDefinition {
  title?: string;
  description?: string;
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  allOf?: any[];
  definitions?: Record<string, any>;
  $ref?: string;
}

async function searchSchemaDefinition(
  fieldName: string,
  fieldType: string,
  schemasPath: string
): Promise<Array<{ name: string; type: string; required: boolean; description: string }>> {
  console.log('Searching schema definition:', { fieldName, fieldType, schemasPath });

  try {
    // Handle array types
    if (fieldType.startsWith('array[')) {
      const itemType = fieldType.slice(6, -1);
      console.log('Processing array type:', { itemType });
      return searchSchemaDefinition(fieldName, itemType, schemasPath);
    }

    // Get the base type name (e.g., 'PartyAccount' from 'PartyAccount_Create')
    const baseTypeName = fieldType.split('_')[0];
    console.log('Using base type name:', baseTypeName);

    // First, try to find the schema file anywhere in the schemas directory
    let schemaPath: string | null = null;

    // Function to recursively search directories
    const searchDirectory = (dirPath: string): string | null => {
      console.log('Searching directory:', dirPath);
      const entries = fs.readdirSync(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          // Recursively search subdirectories
          const found = searchDirectory(fullPath);
          if (found) return found;
        } else if (stats.isFile() && 
                  entry.toLowerCase() === `${baseTypeName.toLowerCase()}.schema.json`) {
          console.log('Found schema file:', fullPath);
          return fullPath;
        }
      }
      return null;
    };

    // Search for the schema file
    schemaPath = searchDirectory(schemasPath);

    if (!schemaPath) {
      console.warn('Schema file not found for:', baseTypeName);
      return [];
    }

    try {
      console.log('Loading schema from:', schemaPath);
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      const fullSchema: SchemaDefinition = JSON.parse(schemaContent);
      console.log('Loaded schema:', { 
        title: fullSchema.title, 
        hasDefinitions: !!fullSchema.definitions,
        availableDefinitions: fullSchema.definitions ? Object.keys(fullSchema.definitions) : []
      });

      // First try to find the exact definition
      let schema: SchemaDefinition | null = null;
      if (fieldType.includes('_') && fullSchema.definitions?.[fieldType]) {
        console.log('Found specific definition:', fieldType);
        schema = {
          ...fullSchema.definitions[fieldType],
          definitions: fullSchema.definitions  // Keep definitions for nested references
        };
      } else if (fullSchema.definitions?.[baseTypeName]) {
        console.log('Using base type definition:', baseTypeName);
        schema = {
          ...fullSchema.definitions[baseTypeName],
          definitions: fullSchema.definitions  // Keep definitions for nested references
        };
      } else if (fullSchema.allOf) {
        console.log('Schema uses allOf, merging schemas');
        schema = {
          properties: {},
          required: [],
          definitions: fullSchema.definitions,  // Keep definitions for nested references
          ...fullSchema
        };
        
        fullSchema.allOf.forEach((subSchema: SchemaDefinition) => {
          if (subSchema.properties) {
            schema!.properties = { ...schema!.properties, ...subSchema.properties };
          }
          if (subSchema.required) {
            schema!.required = [...(schema!.required || []), ...subSchema.required];
          }
        });
      } else {
        console.log('Using full schema');
        schema = fullSchema;
      }

      if (!schema) {
        console.warn('No suitable schema found');
        return [];
      }

      console.log('Using schema:', {
        title: schema.title,
        hasProperties: !!schema.properties,
        propertyCount: schema.properties ? Object.keys(schema.properties).length : 0,
        properties: schema.properties ? Object.keys(schema.properties) : [],
        hasAllOf: !!schema.allOf,
        hasDefinitions: !!schema.definitions
      });

      // Extract fields from the schema
      const fields = extractSchemaFields(schema, '', schemasPath, 0, new Set());
      console.log('Extracted fields:', {
        schemaTitle: schema.title,
        fieldCount: fields.length,
        fields: fields.map(f => ({ name: f.name, type: f.type }))
      });

      return fields;
    } catch (error) {
      console.error('Error processing schema:', error);
      return [];
    }
  } catch (error) {
    console.error('Error searching schema definition:', error);
    return [];
  }
}

function extractSchemaFields(
  schema: any, 
  parentName: string = '', 
  schemasPath: string,
  depth: number = 0,
  seenRefs: Set<string> = new Set()
): Array<{ name: string; type: string; required: boolean; description: string; schema?: any }> {
  // Prevent infinite recursion
  if (depth > 10) {
    console.log('Maximum depth reached, stopping recursion:', { parentName });
    return [];
  }

  if (!schema) {
    console.log('Schema is null or undefined');
    return [];
  }

  // Handle allOf in the schema
  if (!schema.properties && schema.allOf) {
    console.log('Schema uses allOf, merging schemas');
    const mergedSchema = {
      properties: {},
      required: [],
      definitions: schema.definitions,  // Keep definitions for nested references
      ...schema
    };
    
    schema.allOf.forEach((subSchema: any) => {
      // If subSchema is a reference, resolve it
      if (subSchema.$ref && schema.definitions) {
        const refParts = subSchema.$ref.split('/');
        const defName = refParts[refParts.length - 1];
        if (!seenRefs.has(defName)) {
          seenRefs.add(defName);
          const resolvedSchema = schema.definitions[defName];
          if (resolvedSchema) {
            if (resolvedSchema.properties) {
              mergedSchema.properties = { ...mergedSchema.properties, ...resolvedSchema.properties };
            }
            if (resolvedSchema.required) {
              mergedSchema.required = [...mergedSchema.required, ...resolvedSchema.required];
            }
          }
        }
      } else if (subSchema.properties) {
        mergedSchema.properties = { ...mergedSchema.properties, ...subSchema.properties };
      }
      if (subSchema.required) {
        mergedSchema.required = [...mergedSchema.required, ...subSchema.required];
      }
    });
    
    schema = mergedSchema;
  }

  if (!schema.properties) {
    console.log('No properties found in schema:', { 
      hasSchema: !!schema, 
      schemaKeys: schema ? Object.keys(schema) : [],
      hasAllOf: !!schema.allOf,
      hasDefinitions: !!schema.definitions
    });
    return [];
  }

  const fields: Array<{ name: string; type: string; required: boolean; description: string; schema?: any }> = [];
  const required = schema.required || [];

  // Process properties
  Object.entries(schema.properties).forEach(([name, prop]: [string, any]) => {
    const fullName = parentName ? `${parentName}.${name}` : name;
    console.log('Processing property:', { 
      name: fullName, 
      type: prop.type, 
      hasRef: !!prop.$ref,
      hasSchema: !!prop.schema,
      schemaRef: prop.schema?.$ref
    });
    
    if (prop.$ref) {
      // Check if we've seen this reference before
      if (!seenRefs.has(prop.$ref)) {
        seenRefs.add(prop.$ref);
        // This is a reference to another schema
        const referencedSchema = loadSchema(prop.$ref, schemasPath);
        if (referencedSchema) {
          fields.push({
            name: fullName,
            type: referencedSchema.title || 'object',
            required: required.includes(name),
            description: prop.description || referencedSchema.description || '',
            schema: { $ref: prop.$ref }
          });
          // Also include the fields of the referenced schema
          fields.push(...extractSchemaFields(referencedSchema, fullName, schemasPath, depth + 1, seenRefs));
        }
      } else {
        console.log('Skipping circular reference:', prop.$ref);
        fields.push({
          name: fullName,
          type: 'object',
          required: required.includes(name),
          description: prop.description || '',
          schema: { $ref: prop.$ref }
        });
      }
    } else if (prop.allOf) {
      // Handle allOf in property
      const mergedProp = {
        properties: {},
        required: [],
        definitions: schema.definitions,
        ...prop
      };
      
      prop.allOf.forEach((subSchema: any) => {
        if (subSchema.$ref && schema.definitions) {
          const refParts = subSchema.$ref.split('/');
          const defName = refParts[refParts.length - 1];
          if (!seenRefs.has(defName)) {
            seenRefs.add(defName);
            const resolvedSchema = schema.definitions[defName];
            if (resolvedSchema) {
              if (resolvedSchema.properties) {
                mergedProp.properties = { ...mergedProp.properties, ...resolvedSchema.properties };
              }
              if (resolvedSchema.required) {
                mergedProp.required = [...mergedProp.required, ...resolvedSchema.required];
              }
            }
          }
        } else if (subSchema.properties) {
          mergedProp.properties = { ...mergedProp.properties, ...subSchema.properties };
        }
        if (subSchema.required) {
          mergedProp.required = [...mergedProp.required, ...subSchema.required];
        }
      });

      fields.push({
        name: fullName,
        type: 'object',
        required: required.includes(name),
        description: prop.description || ''
      });
      fields.push(...extractSchemaFields(mergedProp, fullName, schemasPath, depth + 1, seenRefs));
    } else if (prop.type === 'object' && prop.properties) {
      // This is a nested object
      fields.push({
        name: fullName,
        type: 'object',
        required: required.includes(name),
        description: prop.description || ''
      });
      fields.push(...extractSchemaFields({ ...prop, definitions: schema.definitions }, fullName, schemasPath, depth + 1, seenRefs));
    } else if (prop.type === 'array' && prop.items) {
      // This is an array
      if (prop.items.$ref) {
        if (!seenRefs.has(prop.items.$ref)) {
          seenRefs.add(prop.items.$ref);
          const referencedSchema = loadSchema(prop.items.$ref, schemasPath);
          if (referencedSchema) {
            fields.push({
              name: fullName,
              type: `array[${referencedSchema.title || 'object'}]`,
              required: required.includes(name),
              description: prop.description || '',
              schema: { $ref: prop.items.$ref }
            });
            // Also include the fields of the array items
            fields.push(...extractSchemaFields(referencedSchema, `${fullName}[]`, schemasPath, depth + 1, seenRefs));
          }
        } else {
          console.log('Skipping circular array reference:', prop.items.$ref);
          fields.push({
            name: fullName,
            type: 'array[object]',
            required: required.includes(name),
            description: prop.description || '',
            schema: { $ref: prop.items.$ref }
          });
        }
      } else {
        fields.push({
          name: fullName,
          type: `array[${prop.items.type || 'object'}]`,
          required: required.includes(name),
          description: prop.description || ''
        });
      }
    } else {
      // This is a simple field
      fields.push({
        name: fullName,
        type: prop.type || 'string',
        required: required.includes(name),
        description: prop.description || ''
      });
    }
  });

  return fields;
}

function extractOpenApiFields(operation: any, schemasPath: string): Array<{ name: string; type: string; required: boolean; description: string; schema?: any }> {
  const fields: Array<{ name: string; type: string; required: boolean; description: string; schema?: any }> = [];
  
  console.log('Extracting OpenAPI fields from operation:', {
    operationId: operation.operationId,
    hasRequestBody: !!operation.requestBody,
    requestBodyContent: operation.requestBody?.content?.['application/json']?.schema,
    parameters: operation.parameters?.length || 0
  });

  // Extract path and query parameters
  if (operation.parameters) {
    operation.parameters.forEach((param: any) => {
      console.log('Processing parameter:', {
        name: param.name,
        in: param.in,
        hasRef: !!param.$ref,
        hasSchema: !!param.schema,
        schemaRef: param.schema?.$ref
      });

      if (param.$ref) {
        const referencedParam = loadSchema(param.$ref, schemasPath);
        if (referencedParam) {
          fields.push({
            name: referencedParam.name,
            type: referencedParam.schema?.type || referencedParam.type || 'string',
            required: referencedParam.required || false,
            description: referencedParam.description || '',
            schema: referencedParam.schema?.$ref ? { $ref: referencedParam.schema.$ref } : referencedParam.schema
          });
        }
      } else {
        // Handle parameters with schema references
        if (param.schema?.$ref) {
          fields.push({
            name: param.name,
            type: 'object', // Will be resolved when expanded
            required: param.required || false,
            description: param.description || '',
            schema: { $ref: param.schema.$ref }
          });
        } else {
          fields.push({
            name: param.name,
            type: param.schema?.type || param.type || 'string',
            required: param.required || false,
            description: param.description || '',
            schema: param.schema
          });
        }
      }
    });
  }

  // Extract request body fields if present
  if (operation.requestBody?.content?.['application/json']?.schema) {
    const schema = operation.requestBody.content['application/json'].schema;
    console.log('Processing request body schema:', {
      hasRef: !!schema.$ref,
      ref: schema.$ref,
      hasProperties: !!schema.properties,
      required: !!operation.requestBody.required
    });
    
    // If it's a reference, preserve it
    if (schema.$ref) {
      const schemaName = schema.$ref.split('/').pop() || 'body';
      console.log('Request body has schema reference:', schemaName);
      fields.push({
        name: schemaName.replace('.json', '').replace('.schema', ''),
        type: 'object',
        required: operation.requestBody.required || false,
        description: operation.requestBody.description || '',
        schema: { $ref: schema.$ref }
      });
    } else if (schema.properties) {
      Object.entries(schema.properties).forEach(([name, prop]: [string, any]) => {
        console.log('Processing request body property:', { 
          name, 
          type: prop.type, 
          hasRef: !!prop.$ref,
          ref: prop.$ref
        });
        
        if (prop.$ref) {
          fields.push({
            name,
            type: 'object',
            required: schema.required?.includes(name) || false,
            description: prop.description || '',
            schema: { $ref: prop.$ref }
          });
        } else {
          fields.push({
            name,
            type: prop.type || 'string',
            required: schema.required?.includes(name) || false,
            description: prop.description || '',
            schema: prop
          });
        }
      });
    }
  }

  // Extract response fields from 200/201 success responses
  ['200', '201'].forEach(statusCode => {
    const responseSchema = operation.responses?.[statusCode]?.content?.['application/json']?.schema;
    if (responseSchema) {
      console.log(`Processing ${statusCode} response schema:`, {
        hasRef: !!responseSchema.$ref,
        ref: responseSchema.$ref,
        hasProperties: !!responseSchema.properties
      });

      if (responseSchema.$ref) {
        const schemaName = responseSchema.$ref.split('/').pop() || `response${statusCode}`;
        fields.push({
          name: schemaName.replace('.json', '').replace('.schema', ''),
          type: 'object',
          required: false,
          description: operation.responses[statusCode].description || '',
          schema: { $ref: responseSchema.$ref }
        });
      } else if (responseSchema.properties) {
        Object.entries(responseSchema.properties).forEach(([name, prop]: [string, any]) => {
          console.log('Processing response property:', { 
            name, 
            type: prop.type, 
            hasRef: !!prop.$ref,
            ref: prop.$ref
          });

          if (prop.$ref) {
            fields.push({
              name,
              type: 'object',
              required: responseSchema.required?.includes(name) || false,
              description: prop.description || '',
              schema: { $ref: prop.$ref }
            });
          } else {
            fields.push({
              name,
              type: prop.type || 'string',
              required: responseSchema.required?.includes(name) || false,
              description: prop.description || '',
              schema: prop
            });
          }
        });
      }
    }
  });

  console.log('Extracted fields:', fields.map(f => ({
    name: f.name,
    type: f.type,
    hasSchema: !!f.schema,
    schemaRef: f.schema?.$ref
  })));
  return fields;
}

async function findSchemaFile(typeName: string, schemasPath: string): Promise<string | null> {
  try {
    console.log('Finding schema file for type:', typeName);
    const schemaDirs = fs.readdirSync(schemasPath);
    
    // If the type contains an underscore (e.g., PartyAccount_Create), try the base name first
    const baseTypeName = typeName.split('_')[0];
    console.log('Using base type name:', baseTypeName);
    
    for (const dir of schemaDirs) {
      const dirPath = path.join(schemasPath, dir);
      if (fs.statSync(dirPath).isDirectory()) {
        const schemaFiles = fs.readdirSync(dirPath)
          .filter(file => file.endsWith('.schema.json'));
        
        // First try exact match with base type name
        const baseMatch = schemaFiles.find(file => 
          file.toLowerCase() === `${baseTypeName.toLowerCase()}.schema.json`
        );
        if (baseMatch) {
          const fullPath = path.join(dirPath, baseMatch);
          console.log('Found base type schema:', fullPath);
          
          // Verify if the file contains the definition we need
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const schema = JSON.parse(content);
            if (typeName.includes('_') && schema.definitions?.[typeName]) {
              console.log('Found definition in schema:', typeName);
              return fullPath;
            } else if (!typeName.includes('_')) {
              console.log('Using base schema file');
              return fullPath;
            }
          } catch (err) {
            console.warn('Error reading schema file:', err);
          }
        }

        // Then try exact match with full type name
        const exactMatch = schemaFiles.find(file => 
          file.toLowerCase() === `${typeName.toLowerCase()}.schema.json`
        );
        if (exactMatch) {
          const fullPath = path.join(dirPath, exactMatch);
          console.log('Found exact match schema:', fullPath);
          return fullPath;
        }

        // Finally try partial match
        const partialMatch = schemaFiles.find(file => 
          file.toLowerCase().includes(baseTypeName.toLowerCase())
        );
        if (partialMatch) {
          const fullPath = path.join(dirPath, partialMatch);
          console.log('Found partial match schema:', fullPath);
          return fullPath;
        }
      }
    }
    console.warn('No schema file found for type:', typeName);
    return null;
  } catch (error) {
    console.error('Error finding schema file:', error);
    return null;
  }
} 