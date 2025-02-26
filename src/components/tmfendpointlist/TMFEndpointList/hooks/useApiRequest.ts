import { useState, useCallback } from 'react';
import { parseRequestParams } from '../utils/httpUtils';

interface ApiRequestOptions {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
}

interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers?: Record<string, string>;
  time?: number;
}

export const useApiRequest = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<any>(null);

  const executeRequest = useCallback(async (options: ApiRequestOptions) => {
    const { url, method, headers = {}, data, timeout = 30000 } = options;
    
    setIsLoading(true);
    setResponse(null);
    setError(null);
    
    const startTime = Date.now();
    
    try {
      // Set default headers
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers,
      };
      
      // Prepare request options
      const requestOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: requestHeaders,
      };
      
      // Add body for non-GET requests
      if (method.toUpperCase() !== 'GET' && data) {
        requestOptions.body = JSON.stringify(parseRequestParams(data));
      }
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      requestOptions.signal = controller.signal;
      
      // Execute request
      const fetchResponse = await fetch(url, requestOptions);
      clearTimeout(timeoutId);
      
      // Parse response
      let responseData;
      const contentType = fetchResponse.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await fetchResponse.json();
      } else {
        responseData = await fetchResponse.text();
      }
      
      const apiResponse: ApiResponse = {
        status: fetchResponse.status,
        data: responseData,
        headers: Object.fromEntries(fetchResponse.headers.entries()),
        time: Date.now() - startTime,
      };
      
      setResponse(apiResponse);
      return apiResponse;
      
    } catch (err: any) {
      const errorResponse = {
        message: err.message || 'An error occurred',
        name: err.name,
        stack: err.stack,
      };
      
      setError(errorResponse);
      throw errorResponse;
      
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    isLoading,
    response,
    error,
    executeRequest,
  };
}; 