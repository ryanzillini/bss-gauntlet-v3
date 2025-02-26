# Component Extraction Guide

This document provides guidance on how to extract components from the current TMFEndpointList component to create more focused, maintainable components.

## Components to Extract

### 1. EndpointCard Component

The `EndpointCard` component manages the display and interaction with a single TMF endpoint. It should be extracted to its own file with its own state management.

#### File Structure
```
/components/
  /EndpointCard/
    index.tsx        # Main component
    types.ts         # Component types
    styles.ts        # Styling (if using CSS-in-JS)
    hooks.ts         # Custom hooks for the component
```

#### Component Responsibilities
- Display endpoint details
- Manage expansion state
- Handle field expansion/collapse
- Manage mapping interactions
- Display mapping results

### 2. AIChatModal Component

The `AIChatModal` component provides AI chat functionality and should be extracted to its own component.

#### File Structure
```
/components/
  /AIChatModal/
    index.tsx        # Main component
    types.ts         # Component types
    styles.ts        # Styling
    hooks.ts         # Custom hooks
```

#### Component Responsibilities
- Manage chat UI
- Handle message sending/receiving
- Manage chat state
- Handle loading states

### 3. MappingProgressModal Component

This component is already separate but may need refactoring to use the new interface structures.

#### Component Responsibilities
- Display mapping progress
- Visualize mapping stages
- Show mapping results
- Provide actions for mapping workflow

## State Management Strategy

### 1. React Context for Shared State

Create a MappingContext to share mapping-related state across components:

```typescript
// /contexts/MappingContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MappingResult, MappingStage } from '../types/mapping';

interface MappingContextType {
  mappingResults: Record<string, MappingResult>;
  setMappingResult: (endpointId: string, result: MappingResult) => void;
  mappingStages: Record<string, MappingStage[]>;
  updateMappingStage: (
    endpointId: string,
    stageId: string,
    status: MappingStageStatus,
    description?: string
  ) => void;
  // Add other shared state and actions
}

const MappingContext = createContext<MappingContextType | undefined>(undefined);

export const MappingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mappingResults, setMappingResults] = useState<Record<string, MappingResult>>({});
  const [mappingStages, setMappingStages] = useState<Record<string, MappingStage[]>>({});

  const setMappingResult = (endpointId: string, result: MappingResult) => {
    setMappingResults(prev => ({
      ...prev,
      [endpointId]: result
    }));
  };

  const updateMappingStage = (
    endpointId: string,
    stageId: string,
    status: MappingStageStatus,
    description?: string
  ) => {
    setMappingStages(prev => {
      const endpointStages = prev[endpointId] || [];
      const updatedStages = endpointStages.map(stage =>
        stage.id === stageId
          ? { ...stage, status, description: description || stage.description }
          : stage
      );
      return {
        ...prev,
        [endpointId]: updatedStages
      };
    });
  };

  return (
    <MappingContext.Provider
      value={{
        mappingResults,
        setMappingResult,
        mappingStages,
        updateMappingStage,
      }}
    >
      {children}
    </MappingContext.Provider>
  );
};

export const useMappingContext = () => {
  const context = useContext(MappingContext);
  if (context === undefined) {
    throw new Error('useMappingContext must be used within a MappingProvider');
  }
  return context;
};
```

### 2. Custom Hooks for Component Logic

Extract complex logic into custom hooks to keep components focused on rendering:

```typescript
// /components/EndpointCard/hooks.ts
import { useState, useEffect, useCallback } from 'react';
import { TMFEndpoint } from '../../types/endpoints/tmf';
import { MappingResult } from '../../types/mapping/results';
import { useMappingContext } from '../../contexts/MappingContext';
import { tmfService } from '../../services/TMFService';

export const useEndpointMapping = (endpoint: TMFEndpoint, docId: string) => {
  const { setMappingResult, updateMappingStage } = useMappingContext();
  const [isMapping, setIsMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const handleMapEndpoint = useCallback(async () => {
    setIsMapping(true);
    setMappingError(null);
    
    try {
      // Mapping logic here
      // ...
      
      const result: MappingResult = {/* ... */};
      setMappingResult(endpoint.id, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMappingError(errorMessage);
    } finally {
      setIsMapping(false);
    }
  }, [endpoint, docId, setMappingResult, updateMappingStage]);

  return {
    isMapping,
    mappingError,
    handleMapEndpoint
  };
};
```

## Steps for Extraction

1. Identify all dependencies of the component to be extracted
2. Create the component structure with types
3. Copy the JSX and logic from the original component
4. Replace direct state with context or props
5. Update imports to use the new interfaces
6. Test the extracted component independently
7. Replace the original component with the new extracted component
8. Test the integration to ensure functionality is preserved 