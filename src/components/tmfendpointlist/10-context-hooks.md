# Context and Hooks

This document outlines the React Context and custom hooks used in the TMFEndpointList component refactoring.

## Mapping Context

The MappingContext provides shared state for mapping operations across components.

### Context Definition

**Location**: `/contexts/MappingContext.tsx`

```typescript
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MappingResult, MappingStage, MappingProgress } from '../types/mapping';
import { MappingStageStatus } from '../types/mapping/stages';

/**
 * Interface for the MappingContext value
 */
interface MappingContextType {
  // Mapping results for each endpoint, keyed by endpoint ID
  mappingResults: Record<string, MappingResult>;
  
  // Function to set a mapping result for an endpoint
  setMappingResult: (endpointId: string, result: MappingResult) => void;
  
  // Mapping stages for each endpoint, keyed by endpoint ID
  mappingStages: Record<string, MappingStage[]>;
  
  // Function to update a mapping stage for an endpoint
  updateMappingStage: (
    endpointId: string,
    stageId: string,
    status: MappingStageStatus,
    description?: string
  ) => void;
  
  // Mapping progress for each endpoint, keyed by endpoint ID
  mappingProgress: Record<string, MappingProgress>;
  
  // Function to update mapping progress for an endpoint
  updateMappingProgress: (endpointId: string, progress: MappingProgress) => void;
  
  // Flag indicating if mapping is in progress for any endpoint
  isAnyMapping: boolean;
  
  // Function to set mapping status for an endpoint
  setIsMapping: (endpointId: string, isMapping: boolean) => void;
}

// Create the context with undefined initial value
const MappingContext = createContext<MappingContextType | undefined>(undefined);

/**
 * Props for the MappingProvider component
 */
interface MappingProviderProps {
  children: ReactNode;
}

/**
 * Provider component for the MappingContext
 */
export const MappingProvider: React.FC<MappingProviderProps> = ({ children }) => {
  // State for mapping results
  const [mappingResults, setMappingResults] = useState<Record<string, MappingResult>>({});
  
  // State for mapping stages
  const [mappingStages, setMappingStages] = useState<Record<string, MappingStage[]>>({});
  
  // State for mapping progress
  const [mappingProgress, setMappingProgress] = useState<Record<string, MappingProgress>>({});
  
  // State for mapping status
  const [mappingStatus, setMappingStatus] = useState<Record<string, boolean>>({});
  
  // Function to set a mapping result for an endpoint
  const setMappingResult = (endpointId: string, result: MappingResult) => {
    setMappingResults(prev => ({
      ...prev,
      [endpointId]: result
    }));
  };
  
  // Function to update a mapping stage for an endpoint
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
  
  // Function to update mapping progress for an endpoint
  const updateMappingProgress = (endpointId: string, progress: MappingProgress) => {
    setMappingProgress(prev => ({
      ...prev,
      [endpointId]: progress
    }));
  };
  
  // Function to set mapping status for an endpoint
  const setIsMapping = (endpointId: string, isMapping: boolean) => {
    setMappingStatus(prev => ({
      ...prev,
      [endpointId]: isMapping
    }));
  };
  
  // Compute if any endpoint is currently mapping
  const isAnyMapping = Object.values(mappingStatus).some(status => status);
  
  // Context value
  const contextValue: MappingContextType = {
    mappingResults,
    setMappingResult,
    mappingStages,
    updateMappingStage,
    mappingProgress,
    updateMappingProgress,
    isAnyMapping,
    setIsMapping
  };
  
  return (
    <MappingContext.Provider value={contextValue}>
      {children}
    </MappingContext.Provider>
  );
};

/**
 * Custom hook to use the MappingContext
 */
export const useMappingContext = () => {
  const context = useContext(MappingContext);
  if (context === undefined) {
    throw new Error('useMappingContext must be used within a MappingProvider');
  }
  return context;
};
```

## Custom Hooks

### useEndpointMapping

**Location**: `/components/EndpointCard/hooks.ts`

This hook encapsulates the logic for mapping endpoints.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { TMFEndpoint } from '../../types/endpoints/tmf';
import { MappingResult } from '../../types/mapping/results';
import { useMappingContext } from '../../contexts/MappingContext';
import { INITIAL_MAPPING_STAGES } from './constants';
import { toast } from 'react-hot-toast';

/**
 * Custom hook for endpoint mapping operations
 */
export const useEndpointMapping = (endpoint: TMFEndpoint, docId: string) => {
  // Get mapping context
  const { 
    setMappingResult, 
    updateMappingStage, 
    updateMappingProgress,
    setIsMapping
  } = useMappingContext();
  
  // Local state
  const [mappingError, setMappingError] = useState<string | null>(null);
  
  // Function to handle endpoint mapping
  const handleMapEndpoint = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    try {
      // Set mapping in progress
      setIsMapping(endpoint.id, true);
      setMappingError(null);
      
      // Reset mapping stages
      const stages = [...INITIAL_MAPPING_STAGES];
      stages.forEach(stage => {
        updateMappingStage(endpoint.id, stage.id, 'pending');
      });
      
      // Step 1: Context Analysis
      updateMappingStage(endpoint.id, '1', 'in-progress', 'Analyzing endpoint semantics and context...');
      
      // Call API for context analysis
      const contextResponse = await fetch(`/api/generate-mapping-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpointId: endpoint.id,
          docId
        })
      });
      
      if (!contextResponse.ok) {
        throw new Error('Failed to analyze endpoint context');
      }
      
      updateMappingStage(endpoint.id, '1', 'complete', 'Context analysis complete');
      
      // Step 2: Documentation Retrieval
      updateMappingStage(endpoint.id, '2', 'in-progress', 'Fetching documentation...');
      
      const docResponse = await fetch(`/api/get-documentation?docId=${docId}`);
      if (!docResponse.ok) {
        throw new Error('Failed to fetch documentation');
      }
      
      // Step 3: Enhanced Mapping
      updateMappingStage(endpoint.id, '2', 'in-progress', 'Finding documentation matches...');
      
      const mappingResponse = await fetch('/api/map-endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceEndpoint: {
            path: endpoint.path,
            method: endpoint.method,
            description: endpoint.specification?.description || '',
          },
          targetEndpoint: {
            id: endpoint.id,
            fields: endpoint.specification.fields,
          },
          docId
        }),
      });
      
      if (!mappingResponse.ok) {
        throw new Error('Failed to map endpoint');
      }
      
      const data = await mappingResponse.json();
      
      // Prepare result
      if (data.data?.suggestions?.length) {
        const bestMatch = data.data.suggestions[0];
        
        // Update mapping result
        setMappingResult(endpoint.id, bestMatch);
        
        // Update mapping progress
        updateMappingProgress(endpoint.id, {
          mapped: bestMatch.field_mappings?.length || 0,
          total: endpoint.specification.fields.length
        });
        
        // Update mapping stage
        updateMappingStage(endpoint.id, '3', 'complete', 
          `Mapped ${bestMatch.field_mappings?.length || 0} fields`);
        
        toast.success(
          `Successfully mapped ${bestMatch.field_mappings?.length || 0} fields with ${
            Math.round(bestMatch.confidence_score || 0)
          }% confidence`
        );
      } else {
        // No matches found
        updateMappingStage(endpoint.id, '2', 'complete', 'No matching endpoints found');
        
        // Set empty mapping result
        setMappingResult(endpoint.id, {
          sourceEndpoint: {
            path: '',
            method: '',
            description: ''
          },
          fieldMappings: [],
          confidenceScore: 0,
          reasoning: 'No valid endpoints found in documentation'
        });
        
        toast('No matching endpoints found in documentation');
      }
    } catch (error) {
      console.error('Error in mapping process:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setMappingError(errorMessage);
      toast.error(errorMessage);
      
      // Update mapping stages to show error
      updateMappingStage(endpoint.id, '1', 'error', errorMessage);
    } finally {
      // Reset mapping in progress
      setIsMapping(endpoint.id, false);
    }
  }, [endpoint, docId, setMappingResult, updateMappingStage, updateMappingProgress, setIsMapping]);
  
  // Function to load existing mapping
  const loadExistingMapping = useCallback(async () => {
    try {
      const encodedEndpointId = encodeURIComponent(endpoint.id);
      const response = await fetch(`/api/get-endpoint-mapping?endpointId=${encodedEndpointId}&docId=${docId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.data) {
          // Update mapping result
          setMappingResult(endpoint.id, data.data);
          
          // Update mapping progress
          updateMappingProgress(endpoint.id, {
            mapped: data.data.field_mappings?.length || 0,
            total: endpoint.specification.fields.length
          });
        }
      }
    } catch (error) {
      console.error('Error fetching existing mapping:', error);
    }
  }, [endpoint.id, docId, endpoint.specification.fields.length, setMappingResult, updateMappingProgress]);
  
  // Load existing mapping when component mounts
  useEffect(() => {
    loadExistingMapping();
  }, [loadExistingMapping]);
  
  return {
    mappingError,
    handleMapEndpoint,
    loadExistingMapping
  };
};
```

### useFieldExpansion

**Location**: `/components/EndpointCard/hooks.ts`

This hook manages the expansion and loading of nested fields.

```typescript
import { useState, useCallback } from 'react';
import { TMFField } from '../../types/endpoints/tmf';
import { tmfService } from '../../services/TMFService';

/**
 * Custom hook for field expansion
 */
export const useFieldExpansion = () => {
  // State for expanded fields and loading states
  const [expandedFields, setExpandedFields] = useState<Record<string, TMFField[]>>({});
  const [loadingFields, setLoadingFields] = useState<Set<string>>(new Set());
  
  // Function to handle field expansion
  const handleFieldExpand = useCallback(async (field: TMFField, fieldPath: string) => {
    try {
      // Check if field has schema reference
      if (!field?.schema?.$ref) {
        console.log(`No schema ref for field ${fieldPath}`);
        return;
      }
      
      // Set field as loading
      setLoadingFields(prev => new Set([...Array.from(prev), fieldPath]));
      
      // Extract field type from schema reference
      let fieldType = field.type;
      const schemaRef = field.schema.$ref;
      
      if (schemaRef.includes('#/definitions/')) {
        fieldType = schemaRef.split('#/definitions/')[1];
      } else if (schemaRef.includes('#/components/schemas/')) {
        fieldType = schemaRef.split('#/components/schemas/')[1];
      } else if (schemaRef.includes('#')) {
        fieldType = schemaRef.split('#')[1];
      }
      
      // Fetch subfields from service
      const subFields = await tmfService.getFieldDetails(field.name, fieldType);
      
      if (subFields && subFields.length > 0) {
        // Update expanded fields
        setExpandedFields(prev => ({
          ...prev,
          [fieldPath]: subFields.map(subField => ({
            ...subField,
            expanded: false
          }))
        }));
        
        // Expand nested fields recursively
        const nestedFields = subFields.filter(subField => subField.schema?.$ref);
        
        if (nestedFields.length > 0) {
          const nestedPromises = nestedFields.map(subField => {
            const nestedPath = `${fieldPath}.${subField.name}`;
            return handleFieldExpand(subField, nestedPath);
          });
          await Promise.all(nestedPromises);
        }
      }
    } catch (error) {
      console.error('Error expanding field:', fieldPath, error);
    } finally {
      // Remove field from loading set
      setLoadingFields(prev => {
        const next = new Set(Array.from(prev));
        next.delete(fieldPath);
        return next;
      });
    }
  }, []);
  
  // Function to count all fields including expanded ones
  const countAllFields = useCallback((fields: TMFField[]) => {
    // Helper function to count fields recursively
    const countFields = (fields: TMFField[], path: string = ''): number => {
      let count = 0;
      
      fields.forEach(field => {
        // Count this field
        count++;
        
        // If this field has expanded subfields, count those too
        const fieldPath = path ? `${path}.${field.name}` : field.name;
        const subFields = expandedFields[fieldPath];
        
        if (subFields) {
          count += countFields(subFields, fieldPath);
        }
      });
      
      return count;
    };
    
    return countFields(fields);
  }, [expandedFields]);
  
  return {
    expandedFields,
    loadingFields,
    handleFieldExpand,
    countAllFields
  };
};
```

## Utility Hooks

### useMappingOperations

**Location**: `/hooks/useMappingOperations.ts`

This hook provides CRUD operations for mappings.

```typescript
import { useCallback } from 'react';
import { MappingResult, FieldMapping } from '../types/mapping/results';
import { useMappingContext } from '../contexts/MappingContext';
import { toast } from 'react-hot-toast';

/**
 * Custom hook for mapping CRUD operations
 */
export const useMappingOperations = (endpointId: string, docId: string) => {
  // Get mapping context
  const { mappingResults, setMappingResult, updateMappingProgress } = useMappingContext();
  
  // Get current mapping result
  const currentMapping = mappingResults[endpointId];
  
  // Function to save edited mapping
  const saveEditedMapping = useCallback(async (index: number, updatedMapping: FieldMapping) => {
    if (!currentMapping) return;
    
    try {
      // Make sure field_mappings is an array before spreading
      const currentMappings = Array.isArray(currentMapping.fieldMappings) 
        ? currentMapping.fieldMappings 
        : [];
      
      // Update the mapping at the specified index
      const updatedMappings = [...currentMappings];
      updatedMappings[index] = updatedMapping;
      
      // Create the complete updated mapping object
      const updatedMappingResult: MappingResult = {
        ...currentMapping,
        fieldMappings: updatedMappings
      };
      
      // Update the mapping on the server
      const response = await fetch(`/api/update-mapping?endpointId=${endpointId}&docId=${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMappingResult),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update mapping');
      }
      
      // Update the mapping in context
      setMappingResult(endpointId, updatedMappingResult);
      
      // Show success message
      toast.success('Mapping updated successfully');
      
      return true;
    } catch (error) {
      console.error('Error updating mapping:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update mapping');
      return false;
    }
  }, [currentMapping, endpointId, docId, setMappingResult]);
  
  // Function to delete a mapping
  const deleteMapping = useCallback(async (index: number) => {
    if (!currentMapping) return;
    
    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to delete this mapping?')) {
      return false;
    }
    
    try {
      // Make sure field_mappings is an array before filtering
      const currentMappings = Array.isArray(currentMapping.fieldMappings) 
        ? currentMapping.fieldMappings 
        : [];
      
      // Remove the mapping at the specified index
      const updatedMappings = currentMappings.filter((_, i) => i !== index);
      
      // Create the updated mapping result
      const updatedMappingResult: MappingResult = {
        ...currentMapping,
        fieldMappings: updatedMappings
      };
      
      // Update the mapping on the server
      const response = await fetch(`/api/update-mapping?endpointId=${endpointId}&docId=${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMappingResult),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete mapping');
      }
      
      // Update the mapping in context
      setMappingResult(endpointId, updatedMappingResult);
      
      // Update mapping progress
      updateMappingProgress(endpointId, {
        mapped: updatedMappings.length,
        total: currentMapping.fieldMappings.length
      });
      
      // Show success message
      toast.success('Mapping deleted successfully');
      
      return true;
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete mapping');
      return false;
    }
  }, [currentMapping, endpointId, docId, setMappingResult, updateMappingProgress]);
  
  // Function to add a new mapping
  const addNewMapping = useCallback(async (newMapping: FieldMapping) => {
    try {
      // Create a new mapping result if one doesn't exist yet
      let updatedMappingResult: MappingResult;
      
      if (currentMapping) {
        // Make sure field_mappings is an array before spreading
        const currentMappings = Array.isArray(currentMapping.fieldMappings) 
          ? currentMapping.fieldMappings 
          : [];
        
        // Add the new mapping to the array
        const updatedMappings = [
          ...currentMappings,
          newMapping
        ];
        
        // Create the updated mapping result
        updatedMappingResult = {
          ...currentMapping,
          fieldMappings: updatedMappings
        };
      } else {
        // Create a new mapping result
        updatedMappingResult = {
          sourceEndpoint: {
            path: '',
            method: '',
            description: ''
          },
          fieldMappings: [newMapping],
          confidenceScore: 70,
          reasoning: 'Manually created mapping'
        };
      }
      
      // Update the mapping on the server
      const response = await fetch(`/api/update-mapping?endpointId=${endpointId}&docId=${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMappingResult),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add mapping');
      }
      
      // Update the mapping in context
      setMappingResult(endpointId, updatedMappingResult);
      
      // Update mapping progress
      updateMappingProgress(endpointId, {
        mapped: updatedMappingResult.fieldMappings.length,
        total: currentMapping?.fieldMappings.length || 0
      });
      
      // Show success message
      toast.success('New mapping added successfully');
      
      return true;
    } catch (error) {
      console.error('Error adding mapping:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add mapping');
      return false;
    }
  }, [currentMapping, endpointId, docId, setMappingResult, updateMappingProgress]);
  
  return {
    saveEditedMapping,
    deleteMapping,
    addNewMapping
  };
};
```
``` 