/**
 * Mapping Results Type Definitions
 * 
 * This file contains the type definitions for mapping operations results.
 */

// Result of mapping between endpoints
export interface MappingResult {
  sourceEndpoint: SourceEndpoint;
  fieldMappings: FieldMapping[];
  confidenceScore: number;
  reasoning?: string;
  endpointId?: string;
}

export interface SourceEndpoint {
  path: string;
  method: string;
  description: string;
}

export interface FieldMapping {
  source: string;
  target: string;
  confidence: number;
  transform?: string;
}

// Legacy structure - for backward compatibility during refactoring
export interface LegacyMappingResult {
  field_mappings?: Array<{
    source: string;
    target: string;
    confidence: number;
    transform: string;
  }>;
  mappings?: Array<{
    source: string;
    target: string;
    transform?: string;
  }>;
  confidence_score?: number;
  source_endpoint?: {
    path: string;
    method: string;
    description: string;
  };
  reasoning?: string;
  endpoint_id?: string;
  fields?: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    path: string;
  }>;
} 