# Directory Structure

This document outlines the recommended directory structure for the TMFEndpointList component refactoring.

## Root Structure

```
src/
├── components/         # React components
├── contexts/           # React Context providers
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── services/           # API services
```

## Components Structure

```
src/components/
├── TMFEndpointList/             # Main component (to be refactored)
│   ├── index.tsx                # Entry point
│   └── styles.ts                # Component styles
├── EndpointCard/                # Extracted component
│   ├── index.tsx                # Component implementation
│   ├── types.ts                 # Component-specific types
│   ├── hooks.ts                 # Custom hooks
│   └── styles.ts                # Component styles
├── AIChatModal/                 # Extracted component
│   ├── index.tsx
│   ├── types.ts
│   └── styles.ts
└── MappingProgressModal/        # Existing component to refactor
    ├── index.tsx
    └── types.ts
```

## Type Definitions Structure

```
src/types/
├── endpoints/
│   └── tmf.ts                   # TMF endpoint types
├── mapping/
│   ├── stages.ts                # Mapping stage types
│   └── results.ts               # Mapping result types
└── ui/
    ├── forms.ts                 # Form state interfaces
    ├── editing.ts               # UI editing state interfaces
    └── search.ts                # Search-related types
```

## Context Structure

```
src/contexts/
└── MappingContext.tsx           # Context for mapping operations
```

## Hooks Structure

```
src/hooks/
└── useMappingOperations.ts      # Shared mapping operation hooks
```

## Utils Structure

```
src/utils/
├── transforms.ts                # Data transformation utilities
└── validation.ts                # Zod schemas and validation
```

## Services Structure

```
src/services/
└── TMFService.ts                # Service to be updated with new types
```

## Implementation Steps

1. Create the base directory structure
2. Set up the type definition files
3. Create the React context provider
4. Scaffold the component structure
5. Migrate functionality from the monolithic component to the new structure
6. Update imports and references
7. Implement tests for the new structure 