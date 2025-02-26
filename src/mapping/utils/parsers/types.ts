// Common types for all API documentation parsers

export interface ApiParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  schema?: any; // For complex parameter schemas
  in?: string;  // For REST APIs: query, path, body, header, etc.
}

export interface ApiResponse {
  type: string;
  description?: string;
  schema?: any; // For complex response schemas
  statusCode?: string; // For REST APIs
}

export interface ApiEndpoint {
  name: string;
  path?: string;
  method?: string;
  description?: string;
  parameters?: ApiParameter[];
  responses?: {
    [code: string]: {
      description?: string;
      schema?: any;
    };
  };
  type?: string;
  deprecated?: boolean;
  security?: any[];
  tags?: string[];
  operationId?: string;
  summary?: string;
}

export interface ApiSchema {
  type: string;
  properties?: Record<string, ApiSchema>;
  items?: ApiSchema; // For array types
  required?: string[];
  description?: string;
  enum?: string[];
  format?: string;
  ref?: string; // For $ref references
}

// Base interface for all documentation parsers
export interface ApiDocParser {
  parseContent(content: string): Promise<ApiEndpoint[]>;
  parseUrl(url: string): Promise<ApiEndpoint[]>;
}

// Configuration for parsers that use OpenAI
export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  batchSize?: number;
  onProgress?: (processed: number, total: number, avgTime: number) => void;
}

// Error types
export class ParserError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ParserError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
} 