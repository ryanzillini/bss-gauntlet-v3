export interface TMFField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface TMFEndpointContext {
  semanticDescription: string;
  suggestedMappingApproach: string;
  identifiedPatterns: string[];
  confidenceScore: number;
}

export interface EndpointMappingRequest {
  endpointId: string;
  path: string;
  method: string;
  specification: {
    fields: TMFField[];
  };
  docId: string;
  preprocessedDoc: {
    endpoints: any[];
  };
  context?: TMFEndpointContext;
}

export interface ApiMapping {
  confidenceScore: number;
  reasoning: string;
  steps: Array<{
    endpoint: {
      path: string;
      method: string;
      description?: string;
      parameters?: any[];
      responses?: Record<string, any>;
      matchReason?: string;
      confidenceScore?: number;
    };
    outputFields: Array<{
      source: string;
      target: string;
      transform?: string;
    }>;
  }>;
}

export interface BssEndpointMapping {
  id: string;
  endpoint_id: string;
  doc_id: string;
  source_endpoint: {
    path: string;
    method: string;
    description: string;
    parameters: any[];
    responses: Record<string, any>;
    matchReason: string;
    confidenceScore: number;
  };
  field_mappings: Array<{
    source: string;
    target: string;
    transform: string;
  }>;
  confidence_score: number;
  reasoning: string;
  status: 'draft' | 'published' | 'archived';
  created_at?: string;
  updated_at?: string;
}

export interface TMFEndpoint {
  path: string;
  method: string;
  specification: {
    fields: TMFField[];
  };
  context?: TMFEndpointContext;
} 