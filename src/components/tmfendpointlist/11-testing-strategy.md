# Testing Strategy

This document outlines the testing strategy for the TMFEndpointList component refactoring.

## Testing Approach

The testing approach for this refactoring follows a comprehensive strategy that includes:

1. **Unit Tests**: Testing individual components and functions in isolation
2. **Integration Tests**: Testing interactions between components and services
3. **End-to-End Tests**: Testing the complete workflow from user perspective

## Testing by Phase

### Phase 1: Consolidate Type Definitions

#### Unit Tests for Types

**Location**: `/types/__tests__/tmf.test.ts`

```typescript
import { z } from 'zod';
import { TMFFieldSchema } from '../../utils/validation';

describe('TMFField validation', () => {
  test('validates a valid TMFField object', () => {
    const validField = {
      name: 'username',
      type: 'string',
      required: true,
      description: 'The username for login'
    };
    
    const result = TMFFieldSchema.safeParse(validField);
    expect(result.success).toBe(true);
  });
  
  test('rejects an invalid TMFField object', () => {
    const invalidField = {
      name: 'username',
      // Missing type
      required: true,
      description: 'The username for login'
    };
    
    const result = TMFFieldSchema.safeParse(invalidField);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('type');
    }
  });
});
```

#### Type Compatibility Tests

**Location**: `/types/__tests__/compatibility.test.ts`

```typescript
import { TMFField } from '../endpoints/tmf';
import { transformLegacyField } from '../../utils/transforms';

// Mock legacy field from old interfaces
const legacyField = {
  name: 'username',
  type: 'string',
  required: true,
  description: 'The username for login',
  schema: {
    $ref: '#/definitions/User'
  },
  expanded: false,
  subFields: []
};

describe('Type compatibility', () => {
  test('can transform legacy field to new TMFField', () => {
    const result = transformLegacyField(legacyField);
    
    // Should match the shape of the new TMFField interface
    expect(result).toHaveProperty('name', 'username');
    expect(result).toHaveProperty('type', 'string');
    expect(result).toHaveProperty('required', true);
    expect(result).toHaveProperty('description', 'The username for login');
    expect(result).toHaveProperty('schema');
    expect(result.schema).toHaveProperty('$ref', '#/definitions/User');
    
    // Should not have legacy properties
    expect(result).not.toHaveProperty('expanded');
    expect(result).not.toHaveProperty('subFields');
  });
});
```

### Phase 2: Separate Domain and UI Models

#### Domain Model Tests

**Location**: `/types/__tests__/mapping/results.test.ts`

```typescript
import { MappingResult, FieldMapping } from '../../mapping/results';
import { MappingResultSchema } from '../../../utils/validation';

describe('MappingResult validation', () => {
  test('validates a complete mapping result', () => {
    const validResult: MappingResult = {
      sourceEndpoint: {
        path: '/users',
        method: 'GET',
        description: 'Get all users'
      },
      fieldMappings: [
        {
          source: 'name',
          target: 'username',
          confidence: 90,
          transform: 'toLowerCase()'
        }
      ],
      confidenceScore: 85,
      reasoning: 'High confidence match based on field names and types'
    };
    
    const result = MappingResultSchema.safeParse(validResult);
    expect(result.success).toBe(true);
  });
  
  test('validates a minimal mapping result', () => {
    const minimalResult: MappingResult = {
      sourceEndpoint: {
        path: '/users',
        method: 'GET',
        description: ''
      },
      fieldMappings: [],
      confidenceScore: 0
    };
    
    const result = MappingResultSchema.safeParse(minimalResult);
    expect(result.success).toBe(true);
  });
});
```

#### UI State Model Tests

**Location**: `/types/__tests__/ui/editing.test.ts`

```typescript
import { EditingMappingState, NewMappingState } from '../../ui/editing';
import { createInitialEditingState, createInitialNewMappingState } from '../../../utils/initializers';

describe('UI state models', () => {
  test('creates a valid initial editing state', () => {
    const initialState = createInitialEditingState();
    
    expect(initialState).toHaveProperty('index', -1);
    expect(initialState).toHaveProperty('mapping');
    expect(initialState.mapping).toHaveProperty('source', '');
    expect(initialState.mapping).toHaveProperty('target', '');
    expect(initialState.mapping).toHaveProperty('transform', '');
  });
  
  test('creates a valid initial new mapping state', () => {
    const initialState = createInitialNewMappingState();
    
    expect(initialState).toHaveProperty('source', '');
    expect(initialState).toHaveProperty('target', '');
    expect(initialState).toHaveProperty('transform', '');
  });
});
```

### Phase 3: Implement Component Refactoring

#### Component Unit Tests

**Location**: `/components/EndpointCard/__tests__/EndpointCard.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EndpointCard } from '../';
import { MappingProvider } from '../../../contexts/MappingContext';
import { mockEndpoint, mockDocId } from '../../../test/mocks';

// Setup mock for API calls
jest.mock('../../../services/TMFService', () => ({
  tmfService: {
    getFieldDetails: jest.fn().mockResolvedValue([
      {
        name: 'subField',
        type: 'string',
        required: false,
        description: 'A subfield'
      }
    ])
  }
}));

describe('<EndpointCard />', () => {
  test('renders endpoint details', () => {
    render(
      <MappingProvider>
        <EndpointCard endpoint={mockEndpoint} docId={mockDocId} />
      </MappingProvider>
    );
    
    expect(screen.getByText(mockEndpoint.path)).toBeInTheDocument();
    expect(screen.getByText(mockEndpoint.method)).toBeInTheDocument();
  });
  
  test('expands when clicked', () => {
    render(
      <MappingProvider>
        <EndpointCard endpoint={mockEndpoint} docId={mockDocId} />
      </MappingProvider>
    );
    
    // Initially not expanded
    expect(screen.queryByText(mockEndpoint.specification.fields[0].name)).not.toBeInTheDocument();
    
    // Click to expand
    fireEvent.click(screen.getByText(mockEndpoint.path));
    
    // Should now show fields
    expect(screen.getByText(mockEndpoint.specification.fields[0].name)).toBeInTheDocument();
  });
  
  test('initiates mapping when map button is clicked', () => {
    // Test mapping functionality
  });
});
```

#### Context and Hook Tests

**Location**: `/contexts/__tests__/MappingContext.test.tsx`

```typescript
import React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { MappingProvider, useMappingContext } from '../MappingContext';
import { mockMappingResult } from '../../test/mocks';

describe('MappingContext', () => {
  test('provides mapping context to components', () => {
    const wrapper = ({ children }) => (
      <MappingProvider>{children}</MappingProvider>
    );
    
    const { result } = renderHook(() => useMappingContext(), { wrapper });
    
    expect(result.current).toHaveProperty('mappingResults');
    expect(result.current).toHaveProperty('setMappingResult');
    expect(result.current).toHaveProperty('mappingStages');
    expect(result.current).toHaveProperty('updateMappingStage');
  });
  
  test('updates mapping result', () => {
    const wrapper = ({ children }) => (
      <MappingProvider>{children}</MappingProvider>
    );
    
    const { result } = renderHook(() => useMappingContext(), { wrapper });
    
    act(() => {
      result.current.setMappingResult('test-endpoint-id', mockMappingResult);
    });
    
    expect(result.current.mappingResults['test-endpoint-id']).toEqual(mockMappingResult);
  });
});
```

### Phase 4: Integration and End-to-End Tests

#### Integration Tests

**Location**: `/integration/__tests__/mapping-flow.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TMFEndpointList } from '../../components/TMFEndpointList';
import { mockApiResponses } from '../../test/mocks';

// Setup mock for API calls
jest.mock('../../services/TMFService', () => ({
  // Mock implementations
}));

describe('Mapping Flow Integration', () => {
  test('completes end-to-end mapping flow', async () => {
    render(<TMFEndpointList />);
    
    // Wait for endpoints to load
    await waitFor(() => {
      expect(screen.getByText('GET /users')).toBeInTheDocument();
    });
    
    // Click on an endpoint to expand it
    fireEvent.click(screen.getByText('GET /users'));
    
    // Click on the Map button
    fireEvent.click(screen.getByText('Map Endpoint'));
    
    // Wait for mapping to complete
    await waitFor(() => {
      expect(screen.getByText('Successfully mapped')).toBeInTheDocument();
    });
    
    // Verify mapping result is displayed
    expect(screen.getByText('name → username')).toBeInTheDocument();
  });
});
```

#### End-to-End Tests

**Location**: `/e2e/mapping.spec.ts`

```typescript
describe('TMF Endpoint Mapping', () => {
  beforeEach(() => {
    cy.visit('/endpoints');
    cy.intercept('GET', '/api/endpoints', { fixture: 'endpoints.json' });
  });
  
  it('completes a mapping workflow', () => {
    // Select a document
    cy.get('[data-testid="doc-selector"]').click();
    cy.get('[data-testid="doc-option-1"]').click();
    
    // Wait for endpoints to load
    cy.get('[data-testid="endpoint-card"]').should('have.length.at.least', 1);
    
    // Expand an endpoint
    cy.get('[data-testid="endpoint-card"]').first().click();
    
    // Click the Map button
    cy.get('[data-testid="map-button"]').click();
    
    // Verify mapping progress modal appears
    cy.get('[data-testid="mapping-progress-modal"]').should('be.visible');
    
    // Wait for mapping to complete
    cy.get('[data-testid="mapping-progress-modal"]').should('contain', 'Mapping complete');
    
    // Close the modal
    cy.get('[data-testid="close-modal-button"]').click();
    
    // Verify mapping results are displayed
    cy.get('[data-testid="mapping-result"]').should('be.visible');
    cy.get('[data-testid="mapping-confidence"]').should('contain', '%');
    
    // Edit a mapping
    cy.get('[data-testid="edit-mapping-button"]').first().click();
    cy.get('[data-testid="mapping-transform-input"]').clear().type('toUpperCase()');
    cy.get('[data-testid="save-mapping-button"]').click();
    
    // Verify changes are saved
    cy.get('[data-testid="mapping-transform"]').first().should('contain', 'toUpperCase()');
  });
});
```

## Mocking Strategy

For effective testing, we'll use the following mocking strategy:

### API Mocks

**Location**: `/test/mocks/api.ts`

```typescript
export const mockApiResponses = {
  endpoints: [
    {
      id: 'endpoint-1',
      path: '/users',
      method: 'GET',
      specification: {
        description: 'Get all users',
        fields: [
          {
            name: 'username',
            type: 'string',
            required: true,
            description: 'The username'
          },
          {
            name: 'email',
            type: 'string',
            required: true,
            description: 'The email address'
          }
        ]
      }
    }
  ],
  
  mappingResult: {
    sourceEndpoint: {
      path: '/api/users',
      method: 'GET',
      description: 'Returns a list of users'
    },
    fieldMappings: [
      {
        source: 'user.name',
        target: 'username',
        confidence: 90,
        transform: ''
      },
      {
        source: 'user.email',
        target: 'email',
        confidence: 95,
        transform: ''
      }
    ],
    confidenceScore: 92,
    reasoning: 'High confidence match based on field names'
  }
};
```

### Component Mocks

**Location**: `/test/mocks/components.tsx`

```typescript
import React from 'react';
import { TMFEndpoint } from '../../types/endpoints/tmf';
import { MappingResult } from '../../types/mapping/results';

export const mockEndpoint: TMFEndpoint = {
  id: 'test-endpoint',
  path: '/test',
  method: 'GET',
  specification: {
    description: 'Test endpoint',
    fields: [
      {
        name: 'testField',
        type: 'string',
        required: true,
        description: 'A test field'
      }
    ]
  }
};

export const mockDocId = 'test-doc-id';

export const mockMappingResult: MappingResult = {
  sourceEndpoint: {
    path: '/api/test',
    method: 'GET',
    description: 'Test source endpoint'
  },
  fieldMappings: [
    {
      source: 'source.field',
      target: 'testField',
      confidence: 90,
      transform: ''
    }
  ],
  confidenceScore: 90,
  reasoning: 'Test mapping'
};

// Mock context provider for testing
export const MockMappingProvider: React.FC = ({ children }) => {
  // Simplified implementation for testing
  return <div data-testid="mock-mapping-provider">{children}</div>;
};
```

## Testing Tools and Setup

### Jest Configuration

**Location**: `/jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/index.tsx',
    '!src/serviceWorker.ts',
    '!src/**/*.d.ts',
    '!src/test/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### Testing Utilities

**Location**: `/test/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000
});

// Mock fetch API
global.fetch = jest.fn();

// Mock toast notifications
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

// Reset mocks before each test
beforeEach(() => {
  jest.resetAllMocks();
});
```

## Continuous Integration Strategy

### CI Pipeline Steps

1. **Lint**: Check code style and formatting
2. **Type Check**: Ensure TypeScript types are valid
3. **Unit Tests**: Run all unit tests
4. **Integration Tests**: Run integration tests
5. **Build**: Create production build
6. **E2E Tests**: Run end-to-end tests on the built application

### GitHub Actions Workflow

**Location**: `/.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Lint
      run: npm run lint
      
    - name: Type check
      run: npm run type-check
      
    - name: Unit tests
      run: npm run test:unit
      
    - name: Integration tests
      run: npm run test:integration
      
    - name: Build
      run: npm run build
      
    - name: E2E tests
      run: npm run test:e2e
      
    - name: Upload coverage
      uses: codecov/codecov-action@v2
``` 