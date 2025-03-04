# BSS Magic

BSS Magic is an AI-powered platform that maps telecom data from any source directly into an Ontology exposed via standardized TM Forum APIs.

## Architecture

The system consists of two main components:

1. **Design-Time Component**
   - AI-assisted ontology mapping configuration
   - Integration with Amazon Bedrock for intelligent mapping
   - Web UI for mapping management and validation
   - Mapping storage and version control

2. **Runtime Component**
   - TM Forum API implementation
   - Dynamic mapping execution
   - Integration with customer data sources
   - Secured with Amazon Cognito

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure AWS credentials for Bedrock and Cognito access

3. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── components/     # React components
├── pages/         # Next.js pages
│   ├── api/       # API routes
│   └── design/    # Design-time UI
└── utils/         # Shared utilities
```

## Development

- Use TypeScript for type safety
- Follow TM Forum API standards
- Implement declarative mapping configurations
- Leverage Amazon Bedrock for AI capabilities

## Security

- APIs are secured using Amazon Cognito
- Separate user pools for runtime and design-time components
- Role-based access control

## Testing

- TM Forum conformance testing
- Integration testing with sample providers
- AI mapping validation #   b s s - g a u n t l e t - v 3  
 