// Type guard function to check if error is an Error object
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getDetailedErrorMessage(error: unknown): { message: string; details?: string; code?: string } {
  if (isError(error)) {
    // Handle specific error types
    if (error.message.includes('OPENAI_API_KEY')) {
      return {
        message: 'OpenAI API configuration error',
        details: 'The OpenAI API key is missing or invalid. Please check your environment variables.',
        code: 'OPENAI_CONFIG_ERROR'
      };
    }
    if (error.message.includes('supabase')) {
      return {
        message: 'Database operation failed',
        details: 'There was an error accessing the database. Please check your database configuration.',
        code: 'DATABASE_ERROR'
      };
    }
    return {
      message: error.message,
      details: error.stack,
      code: 'UNKNOWN_ERROR'
    };
  }
  return {
    message: 'An unexpected error occurred',
    details: String(error),
    code: 'UNEXPECTED_ERROR'
  };
} 