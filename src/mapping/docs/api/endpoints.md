# API Endpoints

## Core Endpoints

### Documentation Analysis
- **Path**: `/api/fetch-documentation`
- **Method**: POST
- **Purpose**: Retrieves and processes API documentation
- **Input**: Documentation ID
- **Output**: Structured API documentation

### Mapping Operations
- **Path**: `/api/mappings`
- **Methods**: GET, POST, PUT
- **Purpose**: CRUD operations for API mappings
- **Authentication**: Required

## Data Models

### TMF Endpoint
```typescript
interface TMFEndpoint {
  path: string;
  method: string;
  specification: string;
}
```

### API Endpoint
```typescript
interface ApiEndpoint {
  path: string;
  method: string;
  description?: string;
  parameters?: any[];
  responses?: Record<string, any>;
  confidenceScore?: number;
}
```

## Error Handling
- Standard HTTP status codes
- Detailed error messages in response body
- Rate limiting information where applicable 