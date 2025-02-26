# Proposed New Interface Structures

This document outlines the proposed new interface structures for the TMFEndpointList component refactoring. These interfaces focus on better separation of concerns, composability, and type safety.

## Domain Models

### `/types/endpoints/tmf.ts`

```typescript
// Base TMF Field interface
export interface TMFField {
  name: string;
  type: string;
  required: boolean;
  description: string;
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
  specification: TMFEndpointSpecification;
}

export interface TMFEndpointSpecification {
  description: string;
  fields: TMFField[];
}
```

### `/types/mapping/results.ts`

```typescript
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
```

### `/types/mapping/stages.ts`

```typescript
// Mapping stage status
export type MappingStageStatus = 'pending' | 'in-progress' | 'complete' | 'error';

// Mapping stage representation
export interface MappingStage {
  id: string;
  title: string;
  description: string;
  status: MappingStageStatus;
}

// Mapping progress tracking
export interface MappingProgress {
  mapped: number;
  total: number;
}
```

## UI State Models

### `/types/ui/editing.ts`

```typescript
// State for editing a mapping
export interface EditingMappingState {
  index: number;
  mapping: {
    source: string;
    target: string;
    transform: string;
  };
}

// State for adding a new mapping
export interface NewMappingState {
  source: string;
  target: string;
  transform: string;
}
```

### `/types/ui/forms.ts`

```typescript
// State for adding a new endpoint
export interface NewEndpointState {
  path: string;
  method: string;
  description: string;
}

// State for additional endpoint information
export interface AdditionalEndpointState {
  path: string;
  method: string;
  description: string;
  field: string;
  transform?: string;
}
```

### `/types/ui/search.ts`

```typescript
// Search results metadata
export interface SearchMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: SearchFilters;
}

export interface SearchFilters {
  methods: string[];
  apis: string[];
}
```

## Component State Models

### `/components/EndpointCard/types.ts`

```typescript
import { TMFEndpoint } from '../../types/endpoints/tmf';
import { MappingResult, MappingStage, MappingProgress } from '../../types/mapping';
import { EditingMappingState, NewMappingState } from '../../types/ui/editing';

// Props for EndpointCard component
export interface EndpointCardProps {
  endpoint: TMFEndpoint;
  docId: string;
}

// Internal state for EndpointCard
export interface EndpointCardState {
  isExpanded: boolean;
  isMapping: boolean;
  mappingError: string | null;
  mappingResult: MappingResult | null;
  showMappingModal: boolean;
  showAIChat: boolean;
  mappingStages: MappingStage[];
  mappingProgress: MappingProgress;
  editingMapping: EditingMappingState | null;
  isAddingMapping: boolean;
  showAddFieldMapping: boolean;
  newMapping: NewMappingState;
  expandedFields: Record<string, TMFField[]>;
  loadingFields: Set<string>;
}
``` 