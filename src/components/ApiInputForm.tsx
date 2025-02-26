import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { ApiDocumentationService } from '../services/ApiDocumentationService';

export interface ApiFormData {
  apiDocUrl: string;
  apiKey: string;
  endpointBaseUrl: string;
  authType: string;
  authCredentials: string;
}

interface BatchInfo {
  estimatedTotalEndpoints: number;
  estimatedTotalBatches: number;
  documentType: string;
  estimatedProcessingTime: number;
  estimatedProcessingTimeMinutes: number;
}

export interface ApiInputFormProps {
  onSubmit: (data: ApiFormData) => void;
  isLoading?: boolean;
  initialValues?: ApiFormData;
  submitLabel?: string;
}

const ApiInputForm: React.FC<ApiInputFormProps> = ({ 
  onSubmit, 
  isLoading = false,
  initialValues,
  submitLabel = 'Add Documentation'
}) => {
  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<ApiFormData>({
    defaultValues: initialValues || {
      apiDocUrl: '',
      apiKey: '',
      endpointBaseUrl: '',
      authType: '',
      authCredentials: ''
    }
  });

  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  const apiDocUrl = watch('apiDocUrl');
  
  // Properly memoize the documentation service to prevent re-creation on each render
  const documentationService = useMemo(() => {
    return new ApiDocumentationService(process.env.NEXT_PUBLIC_OPENAI_API_KEY);
  }, []);

  // Reset form when initialValues change
  useEffect(() => {
    if (initialValues) {
      reset(initialValues);
      // If we have initialValues, don't show batch info for existing docs
      setBatchInfo(null);
    }
  }, [initialValues, reset]);

  // Debounced fetch of batch information when URL changes, with proper cleanup
  useEffect(() => {
    // Don't analyze invalid or short URLs
    if (!apiDocUrl || apiDocUrl.length < 10 || !apiDocUrl.startsWith('http')) {
      setBatchInfo(null);
      setAnalysisError(null);
      return;
    }

    // Store a flag to track if component is still mounted
    let isMounted = true;
    
    const timer = setTimeout(async () => {
      if (!isMounted) return;
      
      try {
        setIsAnalyzing(true);
        setAnalysisError(null);
        
        // Check if the API is reachable first with a fetch
        const checkResponse = await fetch('/api/fetch-documentation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: apiDocUrl, checkOnly: true })
        });
        
        if (!isMounted) return;
        
        if (!checkResponse.ok) {
          throw new Error('Unable to access this API documentation URL. Please check the URL and try again.');
        }
        
        // Then get batch info
        const info = await documentationService.getDocumentationBatchInfo(apiDocUrl);
        
        if (!isMounted) return;
        
        setBatchInfo(info);
      } catch (error) {
        if (!isMounted) return;
        
        console.error('Error analyzing documentation:', error);
        setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze documentation');
        setBatchInfo(null);
      } finally {
        if (isMounted) {
          setIsAnalyzing(false);
        }
      }
    }, 1000); // 1 second delay to avoid too many requests

    // Clear both the timer and the mounted flag on cleanup
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [apiDocUrl, documentationService]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="apiDocUrl" className="block text-sm font-medium text-pure-white light-mode:text-black mb-2">
          API Documentation URL
        </label>
        <input
          id="apiDocUrl"
          type="url"
          {...register('apiDocUrl', { required: 'API Documentation URL is required' })}
          className="w-full px-4 py-2 bg-pure-white/5 light-mode:bg-white border border-pure-white/10 light-mode:border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-totogi-purple text-pure-white light-mode:text-black placeholder-pure-white/30 light-mode:placeholder-slate-400"
          placeholder="https://api.example.com/docs/swagger.json"
        />
        {errors.apiDocUrl && (
          <p className="mt-1 text-sm text-red-400 light-mode:text-red-600">{errors.apiDocUrl.message}</p>
        )}
        
        {/* Show batch information if available */}
        {isAnalyzing && (
          <div className="mt-2 flex items-center text-sm text-pure-white/70 light-mode:text-black/60">
            <div className="w-4 h-4 border-t-2 border-totogi-purple rounded-full animate-spin mr-2" />
            Analyzing documentation...
          </div>
        )}
        
        {analysisError && (
          <p className="mt-2 text-sm text-red-400 light-mode:text-red-600">
            {analysisError}
          </p>
        )}
        
        {batchInfo && !isAnalyzing && !analysisError && (
          <div className="mt-2 p-3 bg-pure-white/5 light-mode:bg-black/5 rounded-lg text-sm">
            <div className="font-medium text-totogi-purple mb-1">Documentation Analysis</div>
            <div className="text-pure-white/80 light-mode:text-black/70 space-y-1">
              <div>Detected {batchInfo.documentType.toUpperCase()} format</div>
              <div>Estimated processing:</div>
              <ul className="list-disc list-inside ml-2 text-xs">
                <li>{batchInfo.estimatedTotalEndpoints} endpoints</li>
                <li>{batchInfo.estimatedTotalBatches} processing batches</li>
                <li>Approximately {batchInfo.estimatedProcessingTimeMinutes} minutes to complete</li>
                <li>
                  Estimated completion at{' '}
                  {new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: true
                  }).format(new Date(Date.now() + batchInfo.estimatedProcessingTime * 1000))}
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="apiKey" className="block text-sm font-medium text-pure-white light-mode:text-black mb-2">
          API Key (Optional)
        </label>
        <input
          id="apiKey"
          type="password"
          {...register('apiKey')}
          className="w-full px-4 py-2 bg-pure-white/5 light-mode:bg-white border border-pure-white/10 light-mode:border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-totogi-purple text-pure-white light-mode:text-black placeholder-pure-white/30 light-mode:placeholder-slate-400"
          placeholder="Enter your API key if required"
        />
      </div>

      <div>
        <label htmlFor="endpointBaseUrl" className="block text-sm font-medium text-pure-white light-mode:text-black mb-2">
          Endpoint Base URL
        </label>
        <input
          id="endpointBaseUrl"
          type="url"
          {...register('endpointBaseUrl')}
          className="w-full px-4 py-2 bg-pure-white/5 light-mode:bg-white border border-pure-white/10 light-mode:border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-totogi-purple text-pure-white light-mode:text-black placeholder-pure-white/30 light-mode:placeholder-slate-400"
          placeholder="https://api.example.com"
        />
      </div>

      <div>
        <label htmlFor="authType" className="block text-sm font-medium text-pure-white light-mode:text-black mb-2">
          Auth Type
        </label>
        <input
          id="authType"
          type="text"
          {...register('authType')}
          className="w-full px-4 py-2 bg-pure-white/5 light-mode:bg-white border border-pure-white/10 light-mode:border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-totogi-purple text-pure-white light-mode:text-black placeholder-pure-white/30 light-mode:placeholder-slate-400"
          placeholder="Bearer, Basic, etc."
        />
      </div>

      <div>
        <label htmlFor="authCredentials" className="block text-sm font-medium text-pure-white light-mode:text-black mb-2">
          Auth Credentials
        </label>
        <input
          id="authCredentials"
          type="password"
          {...register('authCredentials')}
          className="w-full px-4 py-2 bg-pure-white/5 light-mode:bg-white border border-pure-white/10 light-mode:border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-totogi-purple text-pure-white light-mode:text-black placeholder-pure-white/30 light-mode:placeholder-slate-400"
          placeholder="Enter authentication credentials"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`w-full px-6 py-3 bg-gradient-to-r from-totogi-purple to-totogi-blue rounded-lg font-medium text-pure-white transition-all duration-300 ${
          isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-t-2 border-pure-white rounded-full animate-spin" />
            <span>Processing...</span>
          </div>
        ) : (
          submitLabel
        )}
      </button>
    </form>
  );
};

export default ApiInputForm; 