/**
 * Utility functions for HTTP operations and formatting
 */

/**
 * Get color for HTTP method
 */
export const getMethodColor = (method: string): string => {
  switch (method.toUpperCase()) {
    case 'GET':
      return '#2196F3'; // Blue
    case 'POST':
      return '#4CAF50'; // Green
    case 'PUT':
      return '#FF9800'; // Orange
    case 'DELETE':
      return '#F44336'; // Red
    case 'PATCH':
      return '#9C27B0'; // Purple
    default:
      return '#757575'; // Grey
  }
};

/**
 * Get status code information
 */
export const getStatusInfo = (status: number) => {
  if (status >= 200 && status < 300) {
    return { color: 'success', text: 'Success' };
  } else if (status >= 300 && status < 400) {
    return { color: 'info', text: 'Redirection' };
  } else if (status >= 400 && status < 500) {
    return { color: 'warning', text: 'Client Error' };
  } else if (status >= 500) {
    return { color: 'error', text: 'Server Error' };
  }
  return { color: 'default', text: 'Unknown' };
};

/**
 * Format API response based on content type
 */
export const formatResponse = (data: any): string => {
  try {
    if (typeof data === 'string') {
      // Try to parse as JSON
      JSON.parse(data);
      return JSON.stringify(JSON.parse(data), null, 2);
    }
    return JSON.stringify(data, null, 2);
  } catch (error) {
    // If not valid JSON, return as is
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  }
};

/**
 * Parse API request parameters from an object
 */
export const parseRequestParams = (data: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  
  Object.entries(data).forEach(([key, value]) => {
    // Skip empty values
    if (value === undefined || value === null || value === '') {
      return;
    }
    
    // Handle different types
    if (typeof value === 'string' && value.trim() === '') {
      return;
    }
    
    result[key] = value;
  });
  
  return result;
}; 