import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

// AWS Region where services are deployed
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Cognito User Pool IDs
export const RUNTIME_USER_POOL_ID = process.env.RUNTIME_USER_POOL_ID;
export const DESIGN_USER_POOL_ID = process.env.DESIGN_USER_POOL_ID;

// Cognito App Client IDs
export const RUNTIME_CLIENT_ID = process.env.RUNTIME_CLIENT_ID;
export const DESIGN_CLIENT_ID = process.env.DESIGN_CLIENT_ID;

// Initialize AWS clients
export const bedrockClient = new BedrockRuntimeClient({
  region: AWS_REGION,
});

export const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
});

// Validate required environment variables
if (!RUNTIME_USER_POOL_ID || !DESIGN_USER_POOL_ID) {
  throw new Error('Missing required Cognito User Pool IDs');
}

if (!RUNTIME_CLIENT_ID || !DESIGN_CLIENT_ID) {
  throw new Error('Missing required Cognito App Client IDs');
} 