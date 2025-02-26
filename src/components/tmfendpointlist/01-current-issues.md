# Current Issues with TMFEndpointList Component

## 1. Duplicate Interface Definitions
- `TMFField` is defined in multiple places:
  - TMFEndpointList.tsx
  - TMFService.ts
  - DocumentationService.ts
  - types/tmf.ts

## 2. Inconsistent Interface Structure
- Different versions of similar interfaces exist across the codebase
- Interfaces have different property sets and types for the same concepts

## 3. Bloated Component File
- TMFEndpointList.tsx contains too many interface definitions
- The component file is unnecessarily large, making it difficult to maintain

## 4. Complex Nested Interfaces
- Many interfaces have deeply nested structures
- Data models are excessively complex, making type safety difficult

## 5. Unclear Separation of Concerns
- Domain models and UI state interfaces are mixed together
- No clear distinction between data models and component state 