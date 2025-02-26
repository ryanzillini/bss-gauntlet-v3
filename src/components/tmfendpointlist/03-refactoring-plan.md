# TMFEndpointList Component Refactoring Plan

## Phase 1: Consolidate Type Definitions (2-3 days)

### 1. Create a centralized types directory structure:
```
src/
  types/
    mapping/
      stages.ts       # MappingStage types
      results.ts      # MappingResult types
    endpoints/
      tmf.ts          # TMF endpoint types
      search.ts       # Search-related types
    ui/
      forms.ts        # Form state interfaces
      editing.ts      # UI editing state interfaces
```

### 2. Consolidate TMFField interface:
- Move the definition to a single location (types/endpoints/tmf.ts)
- Update all imports to use this centralized definition
- Ensure consistent structure across the application

### 3. Normalize nested interface structures:
- Break down complex nested interfaces into smaller, more focused interfaces
- Use composition over deep nesting

## Phase 2: Separate Domain and UI Models (2-3 days)

### 1. Create clear domain models:
- Move all domain entities (TMFEndpoint, TMFField, etc.) to domain-specific files
- Ensure these models match the back-end API structures

### 2. Create UI-specific state interfaces:
- Define interfaces for component state that don't represent domain entities
- Example: `EditingMappingState`, `EndpointCardState`

### 3. Implement intermediate data transformation functions:
- Add utility functions to transform between domain models and UI state

## Phase 3: Implement Component Refactoring (3-4 days)

### 1. Break down TMFEndpointList component:
- Extract `EndpointCard` into its own file
- Extract `AIChatModal` into its own file
- Create smaller, more focused components

### 2. Implement React Context for shared state:
- Create a MappingContext to share mapping state across components
- Reduce prop drilling

### 3. Use TypeScript generics for reusable patterns:
- Implement generic components for common UI patterns
- Create helper types for pagination, search filtering, etc.

## Phase 4: Testing and Documentation (2-3 days)

### 1. Update unit tests:
- Ensure all refactored interfaces work as expected
- Test edge cases for type compatibility

### 2. Add JSDoc comments:
- Document all interfaces with clear descriptions
- Include examples where appropriate

### 3. Create a type documentation guide:
- Document the new type system for future developers
- Include visual diagrams of type relationships 