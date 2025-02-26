# Configuration Guide

## AWS Bedrock Setup
1. Create AWS account
2. Enable Bedrock service
3. Configure IAM roles and permissions
4. Set up API credentials

## Database Configuration
- Supabase project setup
- Schema initialization
- Migration management
- Backup configuration

## API Configuration
- Rate limiting settings
- CORS configuration
- Authentication setup
- Error handling preferences

## Environment Variables
Detailed description of all required and optional environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| AWS_REGION | AWS region for Bedrock | Yes | us-east-1 |
| AWS_ACCESS_KEY_ID | AWS access key | Yes | - |
| AWS_SECRET_ACCESS_KEY | AWS secret key | Yes | - |
| OPENAI_API_KEY | OpenAI API key | Yes | - |
| NEXT_PUBLIC_SITE_URL | Site URL | No | http://localhost:3000 | 