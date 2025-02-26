# Type Definitions

This document outlines the structure and organization of type definitions for the TMFEndpointList component refactoring.

## Overview

Type definitions are organized into three main categories:
1. **Domain Types**: Represent business entities and API data structures
2. **UI State Types**: Represent component state and UI-specific data
3. **Component Types**: Define props and state for specific components

## Domain Types

### `/types/endpoints/tmf.ts`

```typescript
/**
 * Represents a TMF field with its metadata
 */
export interface TMFField {
  /** The name of the field */
  name: string;
  /** The data type of the field */
  type: string;
  /** Whether the field is required */
  required: boolean;
  /** Description of the field purpose */
  description: string;
  /** Optional schema information for complex types */
  schema?: TMFFieldSchema;
}

/**
 * Schema information for a TMF field
 */
export interface TMFFieldSchema {
  /** Reference to a schema definition */
  $ref?: string;
  /** The type of the schema */
  type?: string;
  /** For array types, describes the items */
  items?: TMFFieldSchema;
  /** For object types, describes the properties */
  properties?: Record<string, TMFFieldSchema>;
  /** For object types, controls additional properties */
  additionalProperties?: boolean | TMFFieldSchema;
}

/**
 * Represents a TMF endpoint
 */
export interface TMFEndpoint {
  /** Unique identifier for the endpoint */
  id: string;
  /** The API path */
  path: string;
  /** HTTP method */
  method: string;
  /** Detailed specification of the endpoint */
  specification: TMFEndpointSpecification;
}

/**
 * Detailed specification of a TMF endpoint
 */
export interface TMFEndpointSpecification {
  /** Description of the endpoint purpose */
  description: string;
  /** Fields associated with the endpoint */
  fields: TMFField[];
}
```

### `/types/mapping/results.ts`

```typescript
/**
 * Result of mapping between endpoints
 */
export interface MappingResult {
  /** Information about the source endpoint */
  sourceEndpoint: SourceEndpoint;
  /** Mappings between fields */
  fieldMappings: FieldMapping[];
  /** Confidence score of the mapping (0-100) */
  confidenceScore: number;
  /** Optional reasoning for the mapping */
  reasoning?: string;
  /** Optional reference to the endpoint ID */
  endpointId?: string;
}

/**
 * Source endpoint information
 */
export interface SourceEndpoint {
  /** The API path */
  path: string;
  /** HTTP method */
  method: string;
  /** Description of the endpoint */
  description: string;
}

/**
 * Mapping between source and target fields
 */
export interface FieldMapping {
  /** Source field path */
  source: string;
  /** Target field path */
  target: string;
  /** Confidence level for this mapping (0-100) */
  confidence: number;
  /** Optional transformation to apply */
  transform?: string;
}
```

### `/types/mapping/stages.ts`

```typescript
/**
 * Status of a mapping stage
 */
export type MappingStageStatus = 'pending' | 'in-progress' | 'complete' | 'error';

/**
 * A stage in the mapping process
 */
export interface MappingStage {
  /** Unique identifier for the stage */
  id: string;
  /** Title of the stage */
  title: string;
  /** Description of the stage */
  description: string;
  /** Current status of the stage */
  status: MappingStageStatus;
}

/**
 * Tracking progress of mapping
 */
export interface MappingProgress {
  /** Number of fields mapped */
  mapped: number;
  /** Total number of fields to map */
  total: number;
}
```

## UI State Types

### `/types/ui/editing.ts`

```typescript
/**
 * State for editing a mapping
 */
export interface EditingMappingState {
  /** Index of the mapping being edited */
  index: number;
  /** The mapping being edited */
  mapping: {
    /** Source field path */
    source: string;
    /** Target field path */
    target: string;
    /** Transformation to apply */
    transform: string;
  };
}

/**
 * State for adding a new mapping
 */
export interface NewMappingState {
  /** Source field path */
  source: string;
  /** Target field path */
  target: string;
  /** Transformation to apply */
  transform: string;
}
```

### `/types/ui/forms.ts`

```typescript
/**
 * State for adding a new endpoint
 */
export interface NewEndpointState {
  /** The API path */
  path: string;
  /** HTTP method */
  method: string;
  /** Description of the endpoint */
  description: string;
}

/**
 * State for additional endpoint information
 */
export interface AdditionalEndpointState {
  /** The API path */
  path: string;
  /** HTTP method */
  method: string;
  /** Description of the endpoint */
  description: string;
  /** Field to map */
  field: string;
  /** Optional transformation to apply */
  transform?: string;
}
```

### `/types/ui/search.ts`

```typescript
/**
 * Metadata for search results
 */
export interface SearchMetadata {
  /** Total number of results */
  total: number;
  /** Current page number */
  page: number;
  /** Results per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
  /** Applied filters */
  filters: SearchFilters;
}

/**
 * Search filters
 */
export interface SearchFilters {
  /** HTTP methods to filter by */
  methods: string[];
  /** APIs to filter by */
  apis: string[];
}
```

## Component Types

### `/components/EndpointCard/types.ts`

```typescript
import { TMFEndpoint } from '../../types/endpoints/tmf';
import { MappingResult, MappingStage, MappingProgress } from '../../types/mapping';
import { EditingMappingState, NewMappingState } from '../../types/ui/editing';

/**
 * Props for EndpointCard component
 */
export interface EndpointCardProps {
  /** The endpoint to display */
  endpoint: TMFEndpoint;
  /** Document ID for API calls */
  docId: string;
}

/**
 * Internal state for EndpointCard
 */
export interface EndpointCardState {
  /** Whether the card is expanded */
  isExpanded: boolean;
  /** Whether mapping is in progress */
  isMapping: boolean;
  /** Error message if mapping failed */
  mappingError: string | null;
  /** Result of mapping operation */
  mappingResult: MappingResult | null;
  /** Whether to show the mapping modal */
  showMappingModal: boolean;
  /** Whether to show the AI chat */
  showAIChat: boolean;
  /** Stages of the mapping process */
  mappingStages: MappingStage[];
  /** Progress of the mapping */
  mappingProgress: MappingProgress;
  /** Currently editing mapping */
  editingMapping: EditingMappingState | null;
  /** Whether adding a new mapping */
  isAddingMapping: boolean;
  /** Whether to show the add field mapping UI */
  showAddFieldMapping: boolean;
  /** New mapping being created */
  newMapping: NewMappingState;
  /** Record of expanded fields keyed by field path */
  expandedFields: Record<string, TMFField[]>;
  /** Set of field paths that are currently loading */
  loadingFields: Set<string>;
}
```

## Zod Validation Schemas

### `/utils/validation.ts`

```typescript
import { z } from 'zod';

/**
 * Zod schema for TMFField
 */
export const TMFFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  description: z.string(),
  schema: z.object({
    $ref: z.string().optional()
  }).optional()
});

/**
 * Zod schema for MappingResult
 */
export const MappingResultSchema = z.object({
  sourceEndpoint: z.object({
    path: z.string(),
    method: z.string(),
    description: z.string()
  }),
  fieldMappings: z.array(z.object({
    source: z.string(),
    target: z.string(),
    confidence: z.number().min(0).max(100),
    transform: z.string().optional()
  })),
  confidenceScore: z.number().min(0).max(100),
  reasoning: z.string().optional(),
  endpointId: z.string().optional()
});
``` 