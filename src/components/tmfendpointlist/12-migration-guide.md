# Migration Guide

This document provides guidance on migrating from the old interface structure to the new refactored interfaces.

## Interface Migration

### TMFField Migration

**Old Interface:**
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

**New Interface:**
```typescript
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
```

**Migration Steps:**
1. Replace direct usage of `subFields` with dynamically loaded fields via `getFieldDetails` API
2. Replace `expanded` property with component-level state
3. Move `schema` to the new `TMFFieldSchema` interface
4. Update all imports to use the central definition in `types/endpoints/tmf.ts`

**Example:**
```typescript
// Before
import { TMFField } from './localTypes';

const field: TMFField = {
  name: 'user',
  type: 'object',
  required: true,
  description: 'User object',
  expanded: false,
  subFields: [
    {
      name: 'name',
      type: 'string',
      required: true,
      description: 'User name'
    }
  ],
  schema: {
    $ref: '#/definitions/User'
  }
};

// After
import { TMFField, TMFFieldSchema } from '../../types/endpoints/tmf';

const field: TMFField = {
  name: 'user',
  type: 'object',
  required: true,
  description: 'User object',
  schema: {
    $ref: '#/definitions/User',
    type: 'object',
    properties: {
      name: {
        type: 'string'
      }
    }
  }
};

// Load subfields dynamically
const loadSubfields = async (field: TMFField) => {
  if (field.schema?.$ref) {
    const subfields = await tmfService.getFieldDetails(field.name, field.type);
    setExpandedFields(prev => ({
      ...prev,
      [field.name]: subfields
    }));
  }
};
```

### MappingResult Migration

**Old Interface:**
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

**New Interface:**
```typescript
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

**Migration Steps:**
1. Rename `field_mappings` to `fieldMappings`
2. Rename `confidence_score` to `confidenceScore`
3. Move `source_endpoint` to the new `SourceEndpoint` interface
4. Remove the redundant `mappings` array (use `fieldMappings` instead)
5. Update all imports to use the central definition in `types/mapping/results.ts`

**Example:**
```typescript
// Before
import { MappingResult } from './localTypes';

const mappingResult: MappingResult = {
  field_mappings: [
    {
      source: 'name',
      target: 'username',
      confidence: 90,
      transform: 'toLowerCase()'
    }
  ],
  confidence_score: 85,
  source_endpoint: {
    path: '/users',
    method: 'GET',
    description: 'Get all users'
  },
  reasoning: 'High confidence match based on field names',
  endpoint_id: 'endpoint-1'
};

// After
import { MappingResult } from '../../types/mapping/results';

const mappingResult: MappingResult = {
  fieldMappings: [
    {
      source: 'name',
      target: 'username',
      confidence: 90,
      transform: 'toLowerCase()'
    }
  ],
  confidenceScore: 85,
  sourceEndpoint: {
    path: '/users',
    method: 'GET',
    description: 'Get all users'
  },
  reasoning: 'High confidence match based on field names',
  endpointId: 'endpoint-1'
};
```

## API Response Transformation

Since the API may still return responses in the old format, you should create transformation functions to convert between formats:

### `/utils/transforms.ts`

```typescript
import { MappingResult, SourceEndpoint, FieldMapping } from '../types/mapping/results';
import { TMFField, TMFFieldSchema } from '../types/endpoints/tmf';

/**
 * Transform legacy API mapping result to new format
 */
export function transformMappingResult(legacyResult: any): MappingResult {
  return {
    sourceEndpoint: {
      path: legacyResult.source_endpoint?.path || '',
      method: legacyResult.source_endpoint?.method || '',
      description: legacyResult.source_endpoint?.description || ''
    },
    fieldMappings: Array.isArray(legacyResult.field_mappings)
      ? legacyResult.field_mappings.map(mapping => ({
          source: mapping.source,
          target: mapping.target,
          confidence: mapping.confidence || 0,
          transform: mapping.transform || ''
        }))
      : [],
    confidenceScore: legacyResult.confidence_score || 0,
    reasoning: legacyResult.reasoning,
    endpointId: legacyResult.endpoint_id
  };
}

/**
 * Transform new format mapping result to legacy format for API compatibility
 */
export function transformToLegacyMappingResult(result: MappingResult): any {
  return {
    field_mappings: result.fieldMappings.map(mapping => ({
      source: mapping.source,
      target: mapping.target,
      confidence: mapping.confidence,
      transform: mapping.transform || ''
    })),
    confidence_score: result.confidenceScore,
    source_endpoint: {
      path: result.sourceEndpoint.path,
      method: result.sourceEndpoint.method,
      description: result.sourceEndpoint.description
    },
    reasoning: result.reasoning,
    endpoint_id: result.endpointId
  };
}

/**
 * Transform legacy TMFField to new format
 */
export function transformLegacyField(legacyField: any): TMFField {
  const { expanded, subFields, ...rest } = legacyField;
  
  // Transform the field to the new format
  const result: TMFField = {
    ...rest,
    // If schema is provided, ensure it matches the new structure
    schema: legacyField.schema
      ? {
          $ref: legacyField.schema.$ref,
          // Add additional schema properties as needed
        }
      : undefined
  };
  
  return result;
}
```

## Component Migration

### EndpointCard Migration

**Old Approach:**
```typescript
// Direct state management inside TMFEndpointList
const [isExpanded, setIsExpanded] = useState(false);
const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
// ...more state variables

// Within component JSX
return (
  <div className="endpoint-card">
    <div 
      className="endpoint-header" 
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Header contents */}
    </div>
    
    {isExpanded && (
      <div className="endpoint-details">
        {/* Endpoint details */}
        
        <button onClick={handleMapEndpoint}>Map Endpoint</button>
        
        {mappingResult && (
          <div className="mapping-results">
            {/* Mapping results */}
          </div>
        )}
      </div>
    )}
  </div>
);
```

**New Approach:**
```typescript
// Extract to EndpointCard component
import React from 'react';
import { EndpointCardProps } from './types';
import { useEndpointMapping } from './hooks';
import { useMappingContext } from '../../contexts/MappingContext';
import { FieldList } from '../FieldList';
import { MappingActions } from '../MappingActions';
import { MappingEditor } from '../MappingEditor';

export const EndpointCard: React.FC<EndpointCardProps> = ({ endpoint, docId }) => {
  // Get mapping state from context
  const { mappingResults } = useMappingContext();
  const mappingResult = mappingResults[endpoint.id];
  
  // Use custom hook for mapping logic
  const { isMapping, mappingError, handleMapEndpoint } = useEndpointMapping(endpoint, docId);
  
  // Local state for UI
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="endpoint-card">
      <EndpointHeader 
        endpoint={endpoint}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
      />
      
      {isExpanded && (
        <>
          <FieldList 
            fields={endpoint.specification.fields}
            // Props for field list
          />
          
          <MappingActions 
            isMapping={isMapping}
            onMapEndpoint={handleMapEndpoint}
          />
          
          {mappingResult && (
            <MappingEditor 
              mappingResult={mappingResult}
              // Props for mapping editor
            />
          )}
        </>
      )}
    </div>
  );
};
```

### Mapping State Migration

**Old Approach:**
```typescript
// Direct API calls and state updates
const handleMapEndpoint = async () => {
  try {
    // API call
    const response = await fetch('/api/map-endpoint', {/* ... */});
    const data = await response.json();
    
    // Direct state update
    setMappingResult(data.data);
  } catch (error) {
    // Error handling
  }
};
```

**New Approach:**
```typescript
// In /components/EndpointCard/hooks.ts
export const useEndpointMapping = (endpoint: TMFEndpoint, docId: string) => {
  // Get context methods
  const { setMappingResult, updateMappingStage } = useMappingContext();
  
  // Local state
  const [isMapping, setIsMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  
  // Handle endpoint mapping
  const handleMapEndpoint = useCallback(async () => {
    try {
      setIsMapping(true);
      // API call
      const response = await fetch('/api/map-endpoint', {/* ... */});
      const data = await response.json();
      
      // Transform to new format if needed
      const formattedResult = transformMappingResult(data.data);
      
      // Update context instead of local state
      setMappingResult(endpoint.id, formattedResult);
    } catch (error) {
      setMappingError(error.message);
    } finally {
      setIsMapping(false);
    }
  }, [endpoint, docId, setMappingResult]);
  
  return {
    isMapping,
    mappingError,
    handleMapEndpoint
  };
};
```

## Migration Process

### Step 1: Create New Type Definitions

Create the new type definition files first, before changing any components:

```bash
mkdir -p src/types/{endpoints,mapping,ui}
touch src/types/endpoints/tmf.ts
touch src/types/mapping/results.ts
touch src/types/mapping/stages.ts
touch src/types/ui/editing.ts
touch src/types/ui/forms.ts
touch src/types/ui/search.ts
```

### Step 2: Create Transformation Utilities

Create utilities to transform between old and new formats:

```bash
mkdir -p src/utils
touch src/utils/transforms.ts
touch src/utils/validation.ts
```

### Step 3: Create Context Provider

Create the MappingContext for shared state:

```bash
mkdir -p src/contexts
touch src/contexts/MappingContext.tsx
```

### Step 4: Create Component Structure

Create the component folder structure:

```bash
mkdir -p src/components/{EndpointCard,AIChatModal}/
touch src/components/EndpointCard/index.tsx
touch src/components/EndpointCard/types.ts
touch src/components/EndpointCard/hooks.ts
touch src/components/AIChatModal/index.tsx
touch src/components/AIChatModal/types.ts
```

### Step 5: Migrate Components Incrementally

1. Start with low-risk components like AIChatModal
2. Then migrate helper components like FieldList
3. Finally migrate the main EndpointCard component

### Step 6: Update References

Once all components are migrated, update all references to use the new interfaces:

```bash
# Find all references to old interfaces
grep -r "field_mappings" --include="*.tsx" --include="*.ts" src/
grep -r "confidence_score" --include="*.tsx" --include="*.ts" src/
grep -r "source_endpoint" --include="*.tsx" --include="*.ts" src/
```

### Step 7: Add Feature Flags

Add feature flags to toggle between old and new implementations:

```typescript
// In src/config.ts
export const FEATURES = {
  USE_NEW_MAPPING_CONTEXT: true,
  USE_EXTRACTED_COMPONENTS: true
};

// In src/components/TMFEndpointList/index.tsx
import { FEATURES } from '../../config';

// Usage
{FEATURES.USE_EXTRACTED_COMPONENTS 
  ? <EndpointCard endpoint={endpoint} docId={docId} /> 
  : <LegacyEndpointCard endpoint={endpoint} docId={docId} />
}
```

## Handling Edge Cases

### Backward Compatibility

For backward compatibility with old API responses, add a check in your API service:

```typescript
// In src/services/TMFService.ts
export const getEndpointMapping = async (endpointId: string, docId: string) => {
  const response = await fetch(`/api/get-endpoint-mapping?endpointId=${endpointId}&docId=${docId}`);
  const data = await response.json();
  
  // Check if the response is in the old format
  if (data.data && 'field_mappings' in data.data) {
    // Transform to new format
    return transformMappingResult(data.data);
  }
  
  return data.data;
};
```

### API Requests

When sending data to the API, transform back to the format the API expects:

```typescript
// In src/hooks/useMappingOperations.ts
const updateMapping = async (mappingResult: MappingResult) => {
  // Check if the API requires the legacy format
  const apiPayload = USE_LEGACY_API 
    ? transformToLegacyMappingResult(mappingResult)
    : mappingResult;
  
  const response = await fetch(`/api/update-mapping?endpointId=${endpointId}&docId=${docId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiPayload),
  });
  
  // Handle response
};
```

## Rollback Plan

In case issues are encountered after deployment, implement a rollback strategy:

1. Add a feature flag system with persistent storage (localStorage or remote config)
2. Keep both old and new implementations in the codebase temporarily
3. Create a rollback function that can be triggered via admin interface or API

Example rollback function:

```typescript
// In src/utils/rollback.ts
export const rollbackToLegacyImplementation = () => {
  // Update feature flags
  localStorage.setItem('USE_NEW_MAPPING_CONTEXT', 'false');
  localStorage.setItem('USE_EXTRACTED_COMPONENTS', 'false');
  
  // Force reload the application
  window.location.reload();
};
``` 