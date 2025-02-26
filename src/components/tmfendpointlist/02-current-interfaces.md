# Current Interfaces in TMFEndpointList Component

Based on the analysis of the code, the following interfaces are defined in the TMFEndpointList.tsx file:

## 1. SearchMetadata
```typescript
interface SearchMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: {
    methods: string[];
    apis: string[];
  };
}
```

## 2. MappingStageStatus
```typescript
type MappingStageStatus = 'pending' | 'in-progress' | 'complete' | 'error';
```

## 3. MappingStage
```typescript
interface MappingStage {
  id: string;
  title: string;
  description: string;
  status: MappingStageStatus;
}
```

## 4. MappingResult
```typescript
interface MappingResult {
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
```

## 5. EditingMapping
```typescript
interface EditingMapping {
  index: number;
  mapping: {
    source: string;
    target: string;
    transform: string;
  };
}
```

## 6. NewEndpoint
```typescript
interface NewEndpoint {
  path: string;
  method: string;
  description: string;
}
```

## 7. AdditionalEndpoint
```typescript
interface AdditionalEndpoint {
  path: string;
  method: string;
  description: string;
  field: string;
  transform?: string;
}
```

## 8. TMFField
```typescript
interface TMFField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  expanded?: boolean;
  subFields?: TMFField[];
  schema?: {
    $ref?: string;
  };
}
``` 