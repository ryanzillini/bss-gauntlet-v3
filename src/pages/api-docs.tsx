import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '../components/layout/MainLayout';
import ApiInputForm from '../components/ApiInputForm';
import { ApiDocumentationService } from '../services/ApiDocumentationService';
import { getAllMappingsFromDb, updateMappingInDb, deleteMappingFromDb } from '../utils/supabase-client';
import Link from 'next/link';

interface ApiDoc {
  id: string;
  name: string;
  description?: string;
  api_docs: string;
  api_url?: string;
  created_at: string;
  status: string;
  api_key?: string;
  config?: {
    processed?: boolean;
    error?: string;
    processedAt?: string;
    processingStarted?: string;
    estimatedCompletionTime?: string;
    processingProgress?: {
      totalEndpoints: number;
      processedEndpoints: number;
      estimatedTimeRemaining: number;
      type: string;
      lastUpdate: string;
    };
    batchInfo?: {
      estimatedTotalBatches: number;
      estimatedProcessingTime: number;
    };
  };
}

// Add type definitions for status config
interface StatusConfig {
  className: string;
  label: string;
  icon: JSX.Element;
  progress?: JSX.Element | null;
}

const ApiDocsPage = () => {
  const [docs, setDocs] = useState<ApiDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<ApiDoc | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [apiKeyWarning, setApiKeyWarning] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<ApiDoc | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const documentationService = useMemo(() => {
    const service = new ApiDocumentationService(process.env.NEXT_PUBLIC_OPENAI_API_KEY);
    if (!service.isOpenAIConfigured()) {
      setApiKeyWarning('OpenAI API key is not configured. Some features may be limited.');
    }
    return service;
  }, []);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    try {
      const mappings = await getAllMappingsFromDb();
      const apiDocs = mappings.filter(m => m.type === 'documentation');
      setDocs(apiDocs);
    } catch (error) {
      console.error('Error loading API docs:', error);
      setError('Failed to load API documentation');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    console.log('[ApiDocsPage] Form submission started:', {
      url: formData.apiDocUrl,
      hasApiKey: !!formData.apiKey,
      isEditMode,
      hasSelectedDoc: !!selectedDoc
    });

    try {
      setIsUploading(true);
      setError(null);
      
      if (!documentationService.isOpenAIConfigured()) {
        const error = 'OpenAI API key is required for analyzing documentation. Please configure it in settings.';
        console.error('[ApiDocsPage] OpenAI not configured');
        setError(error);
        return;
      }

      console.log('[ApiDocsPage] Starting documentation process...');
      if (isEditMode && selectedDoc) {
        console.log('[ApiDocsPage] Edit mode - updating existing doc');
        await handleEditSubmit(formData);
      } else {
        console.log('[ApiDocsPage] New doc mode - creating new documentation');
        await handleNewDocSubmit(formData);
      }
      
      console.log('[ApiDocsPage] Documentation processed, reloading docs...');
      await loadDocs();
      console.log('[ApiDocsPage] Docs reloaded successfully');
    } catch (error) {
      console.error('[ApiDocsPage] Error in form submission:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      setError('Failed to save API documentation. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditSubmit = async (data: any) => {
    if (!selectedDoc) return;
    const updates = {
      api_docs: data.apiDocUrl,
      api_key: data.apiKey,
      api_url: data.endpointBaseUrl,
      updated_at: new Date().toISOString()
    };
    await updateMappingInDb(selectedDoc.id, updates);
    setIsEditMode(false);
    setSelectedDoc(null);
  };

  const handleNewDocSubmit = async (data: any) => {
    console.log('[ApiDocsPage] Starting new doc submission:', {
      apiDocUrl: data.apiDocUrl,
      hasApiKey: !!data.apiKey,
      endpointBaseUrl: data.endpointBaseUrl
    });

    try {
      const duplicate = docs.find(doc => doc.api_docs === data.apiDocUrl);
      if (duplicate) {
        console.error('[ApiDocsPage] Duplicate documentation found:', {
          existingDoc: {
            id: duplicate.id,
            url: duplicate.api_docs,
            created_at: duplicate.created_at
          }
        });
        throw new Error('This API documentation has already been uploaded');
      }

      console.log('[ApiDocsPage] Calling saveApiDocumentation...');
      const result = await documentationService.saveApiDocumentation(
        data.apiDocUrl, 
        data.apiKey,
        data.endpointBaseUrl // Pass the endpoint base URL
      );
      console.log('[ApiDocsPage] Documentation saved successfully:', {
        id: result.id,
        name: result.name,
        created_at: result.created_at
      });
      return result;
    } catch (error) {
      console.error('[ApiDocsPage] Error in handleNewDocSubmit:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  };

  const handleDocumentClick = (doc: ApiDoc) => {
    console.log('Selected doc for editing:', doc);
    setSelectedDoc(doc);
    setIsEditMode(true);
    setError(null);
  };

  const handleCancelEdit = () => {
    setSelectedDoc(null);
    setIsEditMode(false);
    setError(null);
  };

  const handleDocumentDelete = async (doc: ApiDoc) => {
    try {
      console.log('[ApiDocsPage] Deleting documentation:', doc.id);
      setIsDeleting(true);
      await deleteMappingFromDb(doc.id);
      console.log('[ApiDocsPage] Documentation deleted successfully');
      
      // Update the UI by removing the deleted doc from state
      setDocs(prevDocs => prevDocs.filter(d => d.id !== doc.id));
      
      // Reset delete state
      setDocToDelete(null);
    } catch (error) {
      console.error('[ApiDocsPage] Error deleting documentation:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      setError('Failed to delete API documentation. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (doc: ApiDoc, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the doc click handler
    setDocToDelete(doc);
  };

  const cancelDelete = () => {
    setDocToDelete(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatEstimatedCompletion = (estimatedCompletionTime: string | undefined): {
    formattedTime: string;
    minutesRemaining: number;
  } => {
    if (!estimatedCompletionTime) {
      return {
        formattedTime: 'N/A',
        minutesRemaining: 0
      };
    }
    
    const completionTime = new Date(estimatedCompletionTime);
    const now = new Date();
    
    // Calculate minutes remaining
    const diffInMs = completionTime.getTime() - now.getTime();
    const diffInMinutes = Math.max(Math.ceil(diffInMs / (1000 * 60)), 0);
    
    // Format the time
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
    
    // Calculate if it's today or tomorrow
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = completionTime.getDate() === today.getDate() && 
                    completionTime.getMonth() === today.getMonth() && 
                    completionTime.getFullYear() === today.getFullYear();
                    
    const isTomorrow = completionTime.getDate() === tomorrow.getDate() && 
                       completionTime.getMonth() === tomorrow.getMonth() && 
                       completionTime.getFullYear() === tomorrow.getFullYear();
    
    let dayPrefix = '';
    if (isToday) {
      dayPrefix = 'Today at ';
    } else if (isTomorrow) {
      dayPrefix = 'Tomorrow at ';
    } else {
      // If beyond tomorrow, show the date
      const dateFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
      });
      dayPrefix = `${dateFormatter.format(completionTime)} at `;
    }
    
    return {
      formattedTime: `${dayPrefix}${timeFormatter.format(completionTime)}`,
      minutesRemaining: diffInMinutes
    };
  };

  const getStatusBadge = (doc: ApiDoc) => {
    const statusConfig: Record<string, StatusConfig> = {
      processing: {
        className: 'bg-warning/20 text-warning',
        label: 'Processing',
        icon: (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ),
        progress: doc.config?.processingProgress ? (
          <div className="ml-2 text-xs">
            <div className="flex items-center">
              <span className="mr-1">
                {doc.config.processingProgress.processedEndpoints} / {doc.config.processingProgress.totalEndpoints}
              </span>
              {doc.config.processingProgress.estimatedTimeRemaining > 0 && (
                <span className="text-warning/70">
                  (~{Math.ceil(doc.config.processingProgress.estimatedTimeRemaining / 60)} min remaining)
                </span>
              )}
            </div>
            <div className="w-full bg-warning/10 rounded-full h-1 mt-1">
              <div 
                className="bg-warning rounded-full h-1 transition-all duration-500"
                style={{ 
                  width: `${(doc.config.processingProgress.processedEndpoints / doc.config.processingProgress.totalEndpoints) * 100}%` 
                }}
              />
            </div>
            {doc.config.batchInfo && (
              <div className="mt-1 text-warning/70">
                {doc.config.batchInfo.estimatedTotalBatches} batches • Approx. {Math.ceil(doc.config.batchInfo.estimatedProcessingTime / 60)} min total
              </div>
            )}
            {doc.config.estimatedCompletionTime && (
              <div className="mt-1 text-warning/70">
                <div className="flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Est. completion: {formatEstimatedCompletion(doc.config.estimatedCompletionTime).formattedTime}
                  </span>
                </div>
                <div className="flex items-center ml-4 text-xs text-warning/60">
                  <span>
                    {formatEstimatedCompletion(doc.config.estimatedCompletionTime).minutesRemaining} min remaining
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : null
      },
      active: {
        className: 'bg-success/20 text-success',
        label: 'Active',
        icon: (
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        )
      },
      error: {
        className: 'bg-error/20 text-error',
        label: 'Error',
        icon: (
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        )
      }
    };

    const config = statusConfig[doc.status] || statusConfig.processing;

    return (
      <div className="flex flex-col">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center ${config.className}`}>
          {config.icon}
          {config.label}
        </span>
        {config.progress}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-pure-white light-mode:text-black mb-4">API Documentation</h1>
          {apiKeyWarning && (
            <div className="bg-warning/20 border border-warning/30 text-warning px-4 py-3 rounded-lg mb-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {apiKeyWarning}
              </div>
            </div>
          )}
          {error && (
            <div className="bg-error/20 border border-error/30 text-error px-4 py-3 rounded-lg mb-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {docToDelete && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="glass-card p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold text-pure-white light-mode:text-black mb-4">
                Delete Documentation?
              </h3>
              <p className="text-pure-white/70 light-mode:text-black/60 mb-6">
                Are you sure you want to delete <span className="font-semibold text-pure-white light-mode:text-black">{docToDelete.name}</span>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 rounded-lg bg-pure-white/10 light-mode:bg-black/10 text-pure-white light-mode:text-black hover:bg-pure-white/20 light-mode:hover:bg-black/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDocumentDelete(docToDelete)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg bg-error text-pure-white hover:bg-error/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-t-2 border-pure-white rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section - Left Side */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-semibold text-pure-white light-mode:text-black">
                {isEditMode ? 'Edit Documentation' : 'Add New Documentation'}
                </h2>
              {isEditMode && (
                <button
                  className="text-sm text-pure-white/50 hover:text-pure-white light-mode:text-black/50 light-mode:hover:text-black"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              )}
            </div>
            <ApiInputForm
              onSubmit={handleSubmit}
              isLoading={isUploading}
              initialValues={selectedDoc ? {
                apiDocUrl: selectedDoc.api_docs,
                apiKey: selectedDoc.api_key || '',
                endpointBaseUrl: selectedDoc.api_url || '',
                authType: '',
                authCredentials: ''
              } : undefined}
              submitLabel={isEditMode ? 'Update Documentation' : 'Add Documentation'}
            />
          </div>

          {/* Documentation List Section - Right Side */}
          <div className="lg:col-span-2">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-semibold text-pure-white light-mode:text-black">
                  Your API Documentation
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-pure-white/50 light-mode:text-black/50">
                    {docs.length} {docs.length === 1 ? 'Document' : 'Documents'}
                  </span>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-totogi-purple"></div>
                </div>
              ) : docs.length > 0 ? (
                <div className="space-y-4">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className={`glass-card p-6 hover:scale-[1.01] transition-all duration-300 cursor-pointer ${
                        selectedDoc?.id === doc.id ? 'ring-2 ring-totogi-purple' : ''
                      }`}
                      onClick={() => handleDocumentClick(doc)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-pure-white light-mode:text-black">
                              {doc.name}
                            </h3>
                            {getStatusBadge(doc)}
                          </div>
                          {doc.status === 'error' && doc.config?.error && (
                            <p className="text-error text-sm mb-3 light-mode:text-red-600">
                              Error: {doc.config.error}
                            </p>
                          )}
                          <p className="text-pure-white/70 light-mode:text-black/60 text-sm mb-3">
                            {doc.description || 'No description provided'}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-pure-white/50 light-mode:text-black/50">
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span>Added {formatDate(doc.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                />
                              </svg>
                              <a
                                href={doc.api_docs}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-totogi-purple transition-colors light-mode:hover:text-totogi-purple"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Source
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            className="btn-primary text-sm whitespace-nowrap"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDocumentClick(doc);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg bg-error/20 text-error text-sm hover:bg-error/30 transition-colors"
                            onClick={(e) => confirmDelete(doc, e)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-totogi-purple/20 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-totogi-purple"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-display font-semibold text-pure-white light-mode:text-black mb-2">
                    No Documentation Yet
                  </h3>
                  <p className="text-pure-white/70 light-mode:text-black/60 max-w-sm mx-auto">
                    Upload your first API documentation to get started with TMF mapping.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ApiDocsPage; 