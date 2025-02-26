import { EndpointInfo } from '../../types/api';

export interface TMFEndpoint {
  path: string;
  method: string;
  specification: {
    fields: Array<{
      name: string;
      required: boolean;
    }>;
  };
}

export interface ApiEndpoint {
  path: string;
  method: string;
  description?: string;
  parameters?: any[];
  responses?: Record<string, any>;
  matchReason?: string;
  confidenceScore?: number;
}

export interface OutputField {
  source: string;
  target: string;
  transform?: string;
}

export interface MappingStep {
  endpoint: ApiEndpoint;
  outputFields: OutputField[];
}

export interface ApiMapping {
  steps: MappingStep[];
  confidenceScore: number;
  reasoning: string;
}

export interface MappingSuggestion {
  sourceEndpoints: ApiEndpoint[];
  targetTMFEndpoint: TMFEndpoint;
  confidenceScore: number;
  reasoning: string;
}

export interface MappingProgress {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  error?: string;
  timestamp: string;
}

export interface EndpointMappingRequest {
  endpointId: string;
  path: string;
  method: string;
  specification: string;
  docId: string;
}

export interface BssEndpointMapping {
  id: string;
  endpoint_id: string;
  doc_id: string;
  source_endpoint: ApiEndpoint;
  field_mappings: OutputField[];
  confidence_score: number;
  reasoning: string;
  status: 'draft' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
} 