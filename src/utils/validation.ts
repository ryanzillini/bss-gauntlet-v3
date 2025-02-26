export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateApiInputs = (
  apiDocUrl: string,
  graphqlBaseUrl: string,
  authType: string,
  authCredentials: string
): ValidationResult => {
  console.log('[Validation] Starting API input validation');
  const errors: string[] = [];

  // Validate API Documentation URL
  try {
    new URL(apiDocUrl);
    console.log('[Validation] API documentation URL is valid');
  } catch {
    console.warn('[Validation] Invalid API documentation URL:', apiDocUrl);
    errors.push('Invalid API documentation URL format');
  }

  // Validate GraphQL URL if provided
  if (graphqlBaseUrl) {
    try {
      new URL(graphqlBaseUrl);
      console.log('[Validation] GraphQL base URL is valid');
    } catch {
      console.warn('[Validation] Invalid GraphQL base URL:', graphqlBaseUrl);
      errors.push('Invalid GraphQL base URL format');
    }
  }

  // Validate auth credentials
  if (!authCredentials && authType !== 'none') {
    console.warn('[Validation] Missing auth credentials for type:', authType);
    errors.push('Authentication credentials are required');
  } else {
    console.log('[Validation] Auth credentials validation passed');
  }

  const result = {
    isValid: errors.length === 0,
    errors
  };
  console.log('[Validation] Validation result:', result);
  return result;
}; 