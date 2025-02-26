# System Architecture

## Component Overview

### 1. API Documentation Parser
- Processes and stores API documentation in structured format
- Maintains endpoint specifications, parameters, and response types
- Located in `api-docs-parsed.json`

### 2. Type System
Located in `types/index.ts`, defines core data structures:

#### Key Interfaces
- `TMFEndpoint`: TM Forum API endpoint representation
- `ApiEndpoint`: Generic API endpoint structure
- `MappingStep`: Endpoint mapping definition
- `OutputField`: Field-level mapping specification
- `BssEndpointMapping`: Complete BSS-TMF mapping record

### 3. Mapping Service
Located in `services/DocumentationMappingService.ts`:
- Integrates with AWS Bedrock for AI-powered analysis
- Handles documentation processing
- Manages mapping storage and retrieval
- Provides mapping suggestion generation

## Data Flow
1. API Documentation Ingestion
2. Endpoint Analysis
3. AI-Powered Mapping Generation
4. Human Review/Approval
5. Mapping Storage and Retrieval

## Integration Points
- AWS Bedrock for AI processing
- Supabase for data persistence
- OpenAI API for additional analysis
- Vercel for deployment 