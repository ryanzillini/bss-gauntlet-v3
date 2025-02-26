# Site Endpoints Service

This service provides API endpoints for site-related functionality.

## Directory Structure

```
site-endpoints/
├── src/
│   ├── controllers/    # Request handlers
│   ├── routes/         # API route definitions
│   ├── services/       # Business logic
│   ├── models/         # Data models and types
│   └── utils/          # Utility functions
├── package.json        # Dependencies and scripts
└── tsconfig.json       # TypeScript configuration
```

## Getting Started

### Installation

```bash
cd site-endpoints
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Run Production

```bash
npm start
```

## API Documentation

The API endpoints will be documented here as they are developed.

## Dependencies

- Express: Web server framework
- Cors: Cross-origin resource sharing middleware
- Dotenv: Environment variable management
- Axios: HTTP client
- Zod: Schema validation

## Development Dependencies

- TypeScript: Static typing
- Jest: Testing framework
- ts-node: TypeScript execution environment 