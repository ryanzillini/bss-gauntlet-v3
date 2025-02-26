# Installation Guide

## Prerequisites
- Node.js (v14 or higher)
- AWS Account with Bedrock access
- Supabase account
- Environment variables setup

## Environment Variables
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
OPENAI_API_KEY=your_openai_key
```

## Setup Steps

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd bss-tmf-mapper
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   - Copy `.env.local.example` to `.env.local`
   - Fill in required credentials

4. **Database Setup**
   - Configure Supabase connection
   - Run initial migrations

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Deployment
- Configure Vercel project
- Set environment variables in Vercel
- Deploy using Vercel CLI or GitHub integration 