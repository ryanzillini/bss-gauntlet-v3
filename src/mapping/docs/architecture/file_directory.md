# Project File Directory Structure

## Root Directory Structure
```
bss-tmf-mapper/
├── docs/                           # Documentation files
│   ├── README.md                   # Main documentation entry point
│   ├── architecture/               # System architecture documentation
│   │   ├── system-overview.md      # System components and interactions
│   │   └── file_directory.md       # This file - project structure
│   ├── api/                        # API documentation
│   │   └── endpoints.md            # API endpoints documentation
│   ├── mapping/                    # Mapping documentation
│   │   └── workflow.md             # Mapping process documentation
│   └── setup/                      # Setup and configuration
│       ├── installation.md         # Installation instructions
│       └── configuration.md        # Configuration guide
│
├── api/                            # API implementation
│   └── endpoints/                  # API endpoint handlers
│
├── services/                       # Business logic services
│   └── DocumentationMappingService.ts  # Core mapping service
│
├── types/                          # TypeScript type definitions
│   └── index.ts                   # Core type definitions
│
├── utils/                          # Utility functions
│   └── supabase-client.ts         # Database client utilities
│
├── parsed-apis/                    # Processed API definitions
│   └── [API specific files]       # Individual API documentation
│
├── Open_Api_And_Data_Model/        # OpenAPI specifications
│   └── apis/                      # API specifications
│       └── TMF656_Service_Problem/ # TMF API example
│           └── samples/           # Sample API responses
│
├── tsconfig.json                   # TypeScript configuration
├── api-docs-parsed.json           # Parsed API documentation
└── .env.local                     # Environment configuration
```

## Key Directories Explained

### `/docs`
Contains all project documentation, organized by topic:
- `architecture/`: System design and structure
- `api/`: API specifications and usage
- `mapping/`: Mapping process and workflows
- `setup/`: Installation and configuration guides

### `/api`
Houses the API implementation:
- REST endpoints
- Request handlers
- Response formatters

### `/services`
Contains core business logic:
- Documentation analysis
- Mapping generation
- AI integration services

### `/types`
TypeScript type definitions:
- Interface definitions
- Type exports
- Common types used across the application

### `/utils`
Utility functions and helpers:
- Database interactions
- Common helper functions
- Shared utilities

### `/parsed-apis`
Processed API documentation:
- Structured API definitions
- Parsed specifications
- Generated documentation

### `/Open_Api_And_Data_Model`
Raw OpenAPI specifications:
- TMF API definitions
- Sample responses
- API schemas

## Configuration Files
- `tsconfig.json`: TypeScript compiler configuration
- `api-docs-parsed.json`: Processed API documentation
- `.env.local`: Environment variables and configuration

## File Naming Conventions
- TypeScript files: `PascalCase.ts` for classes
- Configuration files: `kebab-case.json`
- Documentation: `lowercase.md`
- Test files: `*.test.ts` or `*.spec.ts`