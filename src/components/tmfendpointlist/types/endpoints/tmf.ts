/**
 * TMF Endpoint Type Definitions
 * 
 * This file contains the consolidated type definitions for the TMF endpoints.
 * It eliminates duplicate definitions across the codebase.
 */

// Base TMF Field interface
export interface TMFField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  expanded?: boolean;
  subFields?: TMFField[];
  schema?: TMFFieldSchema;
}

export interface TMFFieldSchema {
  $ref?: string;
  type?: string;
  items?: TMFFieldSchema;
  properties?: Record<string, TMFFieldSchema>;
  additionalProperties?: boolean | TMFFieldSchema;
}

// TMF Endpoint representation
export interface TMFEndpoint {
  id: string;
  path: string;
  method: string;
  description?: string;
  operationId?: string;
  fields?: TMFField[];
  specification?: TMFEndpointSpecification;
}

export interface TMFEndpointSpecification {
  description: string;
  fields: TMFField[];
}

// Search parameters for TMF endpoints
export interface TMFEndpointSearchParams {
  query?: string;
  docId?: string;
  tmfApi?: string;
  page?: number;
  limit?: number;
}

// Search result for TMF endpoints
export interface TMFEndpointSearchResult {
  endpoints: TMFEndpoint[];
  total: number;
  page: number;
  limit: number;
} 