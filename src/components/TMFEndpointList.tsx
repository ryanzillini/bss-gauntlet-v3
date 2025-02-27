import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import { toast } from 'react-hot-toast';
import { tmfService, TMFEndpoint } from '../services/TMFService';
import { tmfContextService } from '../services/TMFContextService';
import { MappingContext } from '../types/TMFTypes';
import MappingProgressModal from './MappingProgressModal';
import { flushSync } from 'react-dom';
import { logisenseService } from '../services/logisenseService';

interface SearchMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: {
    methods: string[];
    apis: string[];
  };
}

type MappingStageStatus = 'pending' | 'in-progress' | 'complete' | 'error';

interface MappingStage {
  id: string;
  title: string;
  description: string;
  status: MappingStageStatus;
}

interface MappingResult {
  field_mappings?: Array<{
    source: string;
    target: string;
    confidence: number;
    transform: string;
    endpoint_info?: {
      path: string;
      method: string;
    };
  }>;
  mappings?: Array<{
    source: string;
    target: string;
    transform?: string;
  }>;
  confidence_score?: number;
  source_endpoint?: {
    path: string;
    method: string;
    description: string;
  };
  reasoning?: string;
  endpoint_id?: string;
  fields?: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    path: string;
  }>;
}

interface EditingMapping {
  index: number;
  mapping: {
    source: string;
    target: string;
    transform: string;
    endpoint_info?: {
      path: string;
      method: string;
    };
  };
}

interface NewEndpoint {
  path: string;
  method: string;
  description: string;
}

interface AdditionalEndpoint {
  path: string;
  method: string;
  description: string;
  field: string;
  transform?: string;
}

interface TMFField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  expanded?: boolean;
  subFields?: TMFField[];
  schema?: {
    $ref?: string;
  };
}

const INITIAL_MAPPING_STAGES: MappingStage[] = [
  {
    id: '1',
    title: 'Analyzing Endpoint',
    description: 'Analyzing endpoint structure and requirements',
    status: 'pending'
  },
  {
    id: '2',
    title: 'Generating Mapping',
    description: 'Creating field mappings based on analysis',
    status: 'pending'
  },
  {
    id: '3',
    title: 'Validating Mapping',
    description: 'Ensuring mapping meets all requirements',
    status: 'pending'
  }
];

const AIChatModal: React.FC<{ isOpen: boolean; onClose: () => void; endpointId?: string; docId?: string; endpoint?: TMFEndpoint }> = ({ isOpen, onClose, endpointId, docId, endpoint }) => {
  const [messages, setMessages] = useState<Array<{ role: string; content: string; timestamp?: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; size: string; uploadedAt: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortController = useRef<AbortController | null>(null);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load conversation and documents when modal opens
  useEffect(() => {
    if (isOpen && endpointId) {
      loadConversation();
      loadDocuments();
      
      // Add endpoint information directly if available
      if (endpoint) {
        addEndpointInfoToContext(endpoint);
      }
    }
  }, [isOpen, endpointId, endpoint]);

  // New function to add endpoint info to context directly
  const addEndpointInfoToContext = (endpointData: TMFEndpoint) => {
    try {
      // Generate a unique ID for the document
      const documentId = `endpoint-data-${Date.now()}`;
      
      // Add the endpoint data directly to the documents list
      setDocuments(prevDocs => {
        // Check if we already have an endpoint data document
        const hasEndpointData = prevDocs.some(doc => doc.name === "Endpoint Data");
        if (hasEndpointData) return prevDocs;
        
        return [
          ...prevDocs,
          {
            id: documentId,
            name: "Endpoint Data",
            size: "JSON",
            uploadedAt: new Date().toISOString()
          }
        ];
      });
      
      // Add system message about added endpoint data
      const systemMessage = {
        role: 'system' as const,
        content: `Endpoint information added to context: ${endpointData.method} ${endpointData.path}`,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, systemMessage]);
      
      // Save the updated conversation
      saveConversation();
      
      console.log('Successfully added endpoint data to context');
      toast.success('Endpoint data added to context');
    } catch (error) {
      console.error('Error adding endpoint data to context:', error);
      toast.error('Failed to add endpoint data to context');
    }
  };

  const loadConversation = async () => {
    if (!endpointId) return;
    
    try {
      const response = await fetch(`/api/endpoint-context?endpointId=${endpointId}`);
      const data = await response.json();
      
      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error('Failed to load previous conversation');
    }
  };

  const loadDocuments = async () => {
    if (!endpointId) return;
    
    try {
      const response = await fetch(`/api/endpoint-documents?endpointId=${endpointId}`);
      const data = await response.json();
      
      if (data.documents && Array.isArray(data.documents)) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    }
  };

  const saveConversation = async () => {
    if (!endpointId || messages.length === 0) return;
    
    try {
      await fetch('/api/endpoint-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpointId,
          messages,
        }),
      });
    } catch (error) {
      console.error('Error saving conversation:', error);
      toast.error('Failed to save conversation');
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;
    
    // Add user message
    const userMessage = { role: 'user' as const, content: input.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    
    // Create abort controller for the fetch request
    abortController.current = new AbortController();
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          endpointId,
        }),
        signal: abortController.current.signal,
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }
      
      const data = await response.json();
      
      // Add assistant message
      const assistantMessage = { 
        role: 'assistant' as const, 
        content: data.message, 
        timestamp: new Date().toISOString() 
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Save conversation after each exchange
      await saveConversation();
      
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error sending message:', error);
        toast.error('Failed to get response from AI');
      }
    } finally {
      setLoading(false);
      abortController.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCancelRequest = () => {
    if (abortController.current) {
      abortController.current.abort();
      setLoading(false);
      toast.success('Request cancelled');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !endpointId) return;
    
    setUploading(true);
    setUploadError(null);
    
    const formData = new FormData();
    formData.append('endpointId', endpointId);
    
    for (let i = 0; i < files.length; i++) {
      formData.append('documents', files[i]);
    }
    
    try {
      const response = await fetch('/api/upload-documents', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload documents');
      }
      
      const data = await response.json();
      toast.success(`${data.uploaded} document(s) uploaded successfully`);
      
      // Reload documents
      loadDocuments();
      
      // Add system message about uploaded documents
      const fileNames = Array.from(files).map(file => file.name).join(', ');
      const systemMessage = { 
        role: 'system' as const, 
        content: `Uploaded document(s): ${fileNames}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, systemMessage]);
      
      // Save conversation
      await saveConversation();
      
    } catch (error) {
      console.error('Error uploading documents:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload documents');
      toast.error('Error uploading documents');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveDocument = async (documentId: string) => {
    if (!endpointId) return;
    
    try {
      const response = await fetch(`/api/remove-document?documentId=${documentId}&endpointId=${endpointId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove document');
      }
      
      toast.success('Document removed successfully');
      
      // Reload documents
      loadDocuments();
      
    } catch (error) {
      console.error('Error removing document:', error);
      toast.error('Failed to remove document');
    }
  };

  const handleClearConversation = async () => {
    if (!window.confirm('Are you sure you want to clear the conversation history?')) return;
    
    setMessages([]);
    
    if (endpointId) {
      try {
        await fetch(`/api/endpoint-context?endpointId=${endpointId}`, {
          method: 'DELETE',
        });
        toast.success('Conversation cleared');
      } catch (error) {
        console.error('Error clearing conversation:', error);
        toast.error('Failed to clear conversation');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Context Assistant</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Main chat area */}
          <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-800">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No messages yet. Start a conversation or upload a document.</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] px-4 py-3 rounded-lg ${
                        message.role === 'user' 
                          ? 'bg-primary text-white' 
                          : message.role === 'system'
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="text-sm font-medium mb-1">
                        {message.role === 'user' ? 'You' : message.role === 'system' ? 'System' : 'Assistant'}
                        {message.timestamp && (
                          <span className="text-xs opacity-70 ml-2">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            
            {/* Input area */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-3 min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={loading}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-2 rounded-lg"
                    title="Upload documents"
                  >
                    {uploading ? (
                      <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    )}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.txt,.json,.csv,.xlsx,.xls"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || loading}
                    className="bg-primary hover:bg-primary-dark text-white p-2 rounded-lg disabled:opacity-50"
                  >
                    {loading ? (
                      <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              {uploadError && (
                <div className="mt-2 text-error text-sm">
                  {uploadError}
                </div>
              )}
              
              <div className="flex justify-between mt-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Press Shift+Enter for a new line
                </div>
                <div className="space-x-2">
                  {loading && (
                    <button
                      onClick={handleCancelRequest}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Cancel request
                    </button>
                  )}
                  <button
                    onClick={handleClearConversation}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Clear conversation
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Documents sidebar */}
          <div className="w-72 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 overflow-y-auto">
            <h3 className="font-medium text-gray-800 dark:text-white mb-3">Documents</h3>
            
            {documents.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                <p>No documents uploaded yet.</p>
                <p className="mt-2">Upload documents to provide additional context for your endpoint mapping.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex justify-between items-center"
                  >
                    <div className="truncate">
                      <div className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate" title={doc.name}>
                        {doc.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {doc.size}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="text-gray-500 hover:text-error"
                      title="Remove document"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Document
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EndpointCard: React.FC<{ endpoint: TMFEndpoint; docId: string }> = ({ endpoint, docId }) => {
  // Count initial fields
  const initialFieldCount = endpoint.specification.fields.length;
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [mappingStages, setMappingStages] = useState<MappingStage[]>(INITIAL_MAPPING_STAGES);
  const [mappingProgress, setMappingProgress] = useState<{ mapped: number; total: number }>({ 
    mapped: 0, 
    total: initialFieldCount  // Initialize with the count of top-level fields
  });
  const [editingMapping, setEditingMapping] = useState<EditingMapping | null>(null);
  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [newMapping, setNewMapping] = useState({ source: '', target: '', transform: '' });
  const [isAddingEndpoint, setIsAddingEndpoint] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string>('');
  const [availableDocs, setAvailableDocs] = useState<Array<{ id: string; name: string }>>([]);
  const [newEndpointPath, setNewEndpointPath] = useState('');
  const [expandedFields, setExpandedFields] = useState<{ [key: string]: Array<TMFField> }>({});
  const [loadingFields, setLoadingFields] = useState<Set<string>>(new Set());
  const [newEndpoint, setNewEndpoint] = useState<NewEndpoint>({
    path: '',
    method: 'GET',
    description: ''
  });
  const [documentEndpoints, setDocumentEndpoints] = useState<Array<{
    id: string;
    path: string;
    method: string;
    description: string;
    fields?: Array<{
      name: string;
      type: string;
      description: string;
      required: boolean;
    }>;
    operationId?: string;
    graphqlType?: string;
  }>>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('');
  // Add these state variables for field loading
  const [loadingEndpointFields, setLoadingEndpointFields] = useState(false);
  const [fetchedEndpointFields, setFetchedEndpointFields] = useState<any[]>([]);
  const [processingEndpointWithAI, setProcessingEndpointWithAI] = useState(false);
  const [aiProcessedFields, setAiProcessedFields] = useState<any[]>([]);
  // Add shared state to filter endpoints by the current card's method
  const [currentMethod, setCurrentMethod] = useState<string>(endpoint.method);
  
  // Use effect to set the current method when expanded
  useEffect(() => {
    if (isExpanded) {
      // Set the current method based on the endpoint's method
      setCurrentMethod(endpoint.method);
      console.log(`Setting current method filter to: ${endpoint.method}`);
    }
  }, [isExpanded, endpoint.method]);

  // Function to handle AI field click
  const handleAIFieldClick = (fieldName: string) => {
    console.log('[TMFEndpointList] AI field clicked:', fieldName);
    // Set the field name as the source in the new mapping
    setNewMapping(prev => ({ ...prev, source: fieldName }));
    // If we're not already adding a mapping, start the process
    if (!isAddingMapping) {
      setIsAddingMapping(true);
    }
    // Show a toast to confirm selection
    toast.success(`Field "${fieldName}" selected for mapping`);
  };

  // Function to fetch endpoints for the selected document
  const fetchEndpoints = async () => {
    if (!selectedDoc) return;
    
    console.log('[TMFEndpointList] Fetching endpoints for document:', selectedDoc);
    try {
      setDocumentEndpoints([]); // Clear previous endpoints
      
      // Check if selected document is the Logisense document - note the updated ID
      if (selectedDoc === '0ncde642-a626-4fe8-8da3-c0d9d4e8bf9f') {
        console.log('[TMFEndpointList] Using API to load Logisense endpoints');
        
        // Use the API endpoint that has the special case handling
        const response = await fetch(`/api/get-document-endpoints?docId=${selectedDoc}`);
        console.log('[TMFEndpointList] Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[TMFEndpointList] Endpoints data received:', data);
          
          if (data.endpoints && Array.isArray(data.endpoints)) {
            console.log('[TMFEndpointList] Setting endpoints:', data.endpoints.length, 'endpoints found');
            
            // Log the first endpoint to see its structure
            if (data.endpoints.length > 0) {
              console.log('[TMFEndpointList] First endpoint sample:', data.endpoints[0]);
            }
            
            // Sort endpoints by path for better usability
            const sortedEndpoints = [...data.endpoints].sort((a, b) => {
              // First sort by method
              const methodOrder: Record<string, number> = { GET: 1, POST: 2, PUT: 3, PATCH: 4, DELETE: 5 };
              const methodA = methodOrder[a?.method as keyof typeof methodOrder] || 99;
              const methodB = methodOrder[b?.method as keyof typeof methodOrder] || 99;
              
              if (methodA !== methodB) return methodA - methodB;
              
              // Then sort by path - add null checks
              if (!a?.path) return -1;
              if (!b?.path) return 1;
              return a.path.localeCompare(b.path);
            });
            
            // Map parameters to fields for the dropdown to work correctly
            const processedEndpoints = sortedEndpoints.map(endpoint => {
              // Properly expand parameters if they exist
              let expandedFields = [];
              
              if (endpoint.parameters && Array.isArray(endpoint.parameters)) {
                // Expand each parameter object fully
                expandedFields = endpoint.parameters.map((param: any) => {
                  // If param is already a fully defined object, use it
                  // Otherwise try to expand it by accessing its properties
                  if (typeof param === 'object' && param !== null) {
                    return {
                      name: param.name || '',
                      type: param.type || (param.schema && param.schema.type) || 'string',
                      description: param.description || '',
                      required: param.required || false,
                      path: param.in || '',
                      schema: param.schema || {}
                    };
                  }
                  return param;
                });
                console.log('[TMFEndpointList] Expanded parameters:', expandedFields);
              }
              
              return {
                ...endpoint,
                // Use expanded fields or fallback
                fields: expandedFields.length > 0 ? expandedFields : endpoint.fields || []
              };
            });
            
            console.log('[TMFEndpointList] Processed endpoints with expanded fields:', processedEndpoints[0]);
            setDocumentEndpoints(processedEndpoints);
          } else {
            console.error('[TMFEndpointList] No endpoints found in response:', data);
            toast.error('No endpoints found in Logisense API definition');
          }
        } else {
          console.error('[TMFEndpointList] Failed to fetch endpoints from API:', response.status);
          toast.error('Failed to load Logisense API definition');
        }
      } else {
        // For all other documents, use the regular API endpoint
        const response = await fetch(`/api/get-document-endpoints?docId=${selectedDoc}`);
        console.log('[TMFEndpointList] Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[TMFEndpointList] Endpoints data received:', data);
          
          if (data.endpoints && Array.isArray(data.endpoints)) {
            console.log('[TMFEndpointList] Setting endpoints:', data.endpoints.length, 'endpoints found');
            
            // Log the first endpoint to see its structure
            if (data.endpoints.length > 0) {
              console.log('[TMFEndpointList] First endpoint sample:', data.endpoints[0]);
            }
            
            // Sort endpoints by path for better usability
            const sortedEndpoints = [...data.endpoints].sort((a, b) => {
              // First sort by method
              const methodOrder: Record<string, number> = { GET: 1, POST: 2, PUT: 3, PATCH: 4, DELETE: 5 };
              const methodA = methodOrder[a?.method as keyof typeof methodOrder] || 99;
              const methodB = methodOrder[b?.method as keyof typeof methodOrder] || 99;
              
              if (methodA !== methodB) return methodA - methodB;
              
              // Then sort by path - add null checks
              if (!a?.path) return -1;
              if (!b?.path) return 1;
              return a.path.localeCompare(b.path);
            });
            
            // Make sure we preserve all fields from the server response
            const processedEndpoints = sortedEndpoints.map(endpoint => {
              // Properly expand parameters if they exist
              let expandedFields = [];
              
              if (endpoint.parameters && Array.isArray(endpoint.parameters)) {
                // Expand each parameter object fully
                expandedFields = endpoint.parameters.map((param: any) => {
                  // If param is already a fully defined object, use it
                  // Otherwise try to expand it by accessing its properties
                  if (typeof param === 'object' && param !== null) {
                    return {
                      name: param.name || '',
                      type: param.type || (param.schema && param.schema.type) || 'string',
                      description: param.description || '',
                      required: param.required || false,
                      path: param.in || '',
                      schema: param.schema || {}
                    };
                  }
                  return param;
                });
                console.log('[TMFEndpointList] Expanded parameters:', expandedFields);
              }
              
              return {
                ...endpoint,
                // Use expanded fields or fallback
                fields: expandedFields.length > 0 ? expandedFields : endpoint.fields || []
              };
            });
            
            console.log('[TMFEndpointList] Processed endpoints with expanded fields:', processedEndpoints[0]);
            setDocumentEndpoints(processedEndpoints);
          } else {
            console.error('[TMFEndpointList] No endpoints found in response:', data);
            toast.error('No endpoints found');
          }
        } else {
          console.error('[TMFEndpointList] Failed to fetch endpoints:', response.status);
          toast.error('Failed to load endpoints');
        }
      }
    } catch (error) {
      console.error('[TMFEndpointList] Error fetching endpoints:', error);
      toast.error('Failed to fetch endpoints');
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsMapping(false);
    setShowMappingModal(false);
    setMappingStages(INITIAL_MAPPING_STAGES);
  };

  const updateMappingStage = (stageId: string, status: MappingStageStatus, description?: string) => {
    setMappingStages(prevStages => 
      prevStages.map(stage => 
        stage.id === stageId 
          ? { ...stage, status, description: description || stage.description }
          : stage
      )
    );
  };

  const handleMapEndpoint = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsMapping(true);
      setMappingError(null);
      setMappingResult(null);
      setShowMappingModal(true);

      // Step 1: Context Analysis
      updateMappingStage('1', 'in-progress', 'Analyzing endpoint semantics and context...');
      let mappingContext: MappingContext;
      
      try {
        mappingContext = await tmfContextService.generateMappingContext(endpoint, docId);
        updateMappingStage('1', 'complete', 'Context analysis complete');
      } catch (error) {
        updateMappingStage('1', 'error', 'Failed to analyze endpoint context');
        throw error;
      }

      // Get preprocessed documentation
      updateMappingStage('2', 'in-progress', 'Fetching documentation...');
      const docResponse = await fetch(`/api/get-documentation?docId=${docId}`);
      if (!docResponse.ok) {
        updateMappingStage('2', 'error', 'Failed to fetch documentation');
        throw new Error('Failed to fetch documentation');
      }
      const preprocessedDoc = await docResponse.json();

      // Step 2: Enhanced Mapping with Context
      updateMappingStage('2', 'in-progress', 'Finding documentation matches...');
      
      try {
        const response = await fetch('/api/map-endpoint', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceEndpoint: {
              path: endpoint.path,
              method: endpoint.method,
              description: endpoint.specification?.description || '',
            },
            targetEndpoint: {
              id: endpoint.id,
              fields: endpoint.specification.fields,
            },
          }),
        });

        if (!response.ok) {
          console.log('[TMFEndpointList] Failed to map endpoint but continuing:', response);
          // throw new Error('Failed to map endpoint');
        }

        const data = await response.json();

        // When no matches are found, show a clear message
        if (!data.data?.suggestions?.length) {
          updateMappingStage('2', 'complete', 'No matching endpoints found');
          setMappingResult({
            field_mappings: [],
            confidence_score: 0,
            source_endpoint: {
              path: '',
              method: '',
              description: ''
            },
            reasoning: 'No valid endpoints found in documentation'
          });
          toast('No matching endpoints found in documentation');
          return;
        }

        const bestMatch = data.data.suggestions[0];
        
        // Handle low confidence matches
        if (bestMatch.confidence_score < 30) {
          updateMappingStage('2', 'in-progress', 
            `Low confidence match (${bestMatch.confidence_score}%). Consider reviewing the mapping.`);
        } else {
          updateMappingStage('2', 'complete', 'Found high confidence matches');
        }

        // Update mapping data
        updateMappingStage('3', 'in-progress', 'Applying field mappings...');
        
        const mappingResponse = await fetch(
          `/api/get-endpoint-mapping?endpointId=${endpoint.id}&docId=${docId}`
        );
        const mappingData = await mappingResponse.json();

        if (mappingData.data) {
          // Update the transform field for each mapping to include "AI generated mapping from TMF to {source}"
          if (mappingData.data.field_mappings && mappingData.data.field_mappings.length > 0) {
            // Get the source API path from the first mapping or the source_endpoint
            const sourcePath = mappingData.data.source_endpoint?.path || '';
            
            // Update each field mapping's transform field
            mappingData.data.field_mappings = mappingData.data.field_mappings.map((mapping: {
              source: string;
              target: string;
              confidence: number;
              transform?: string;
              endpoint_info?: {
                path: string;
                method: string;
              };
            }) => ({
              ...mapping,
              transform: `AI generated mapping from TMF to ${sourcePath || mapping.source}`
            }));
            
            // Save the updated mappings back to the server
            try {
              const updateResponse = await fetch(`/api/update-mapping?endpointId=${endpoint.id}&docId=${docId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(mappingData.data),
              });
              
              if (!updateResponse.ok) {
                console.error('[TMFEndpointList] Failed to update transform fields:', updateResponse.statusText);
              }
            } catch (updateError) {
              console.error('[TMFEndpointList] Error updating transform fields:', updateError);
              // Continue with the process even if saving fails
            }
          }
          
          setMappingResult(mappingData.data);
          setMappingProgress({
            mapped: mappingData.data.field_mappings.length,
            total: endpoint.specification.fields.length
          });

          updateMappingStage('3', 'complete', 
            `Mapped ${mappingData.data.field_mappings.length} fields`);

          toast.success(
            `Successfully mapped ${mappingData.data.field_mappings.length} fields with ${
              Math.round(mappingData.data.confidence_score)
            }% confidence`
          );
        }

      } catch (error) {
        updateMappingStage('2', 'error', 'Failed to process mapping');
        throw error;
      }

      setIsMapping(false);

    } catch (error) {
      console.error('Error in mapping process:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(errorMessage);
      setMappingError(errorMessage);
      setIsMapping(false);
    }
  };

  // Function to handle testing the endpoint
  const handleTestEndpoint = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Here you would implement the endpoint testing logic
      // For example, you could open a modal to input test parameters
      // and then make a request to test the endpoint
      
      // This is a placeholder - implement the actual testing logic based on your requirements
      console.log('Testing endpoint:', endpoint.path, endpoint.method);
      
      // Show a notification that the test was initiated
      toast(`Testing ${endpoint.method} ${endpoint.path}`);
      
    } catch (error) {
      console.error('Error testing endpoint:', error);
      toast(error instanceof Error ? error.message : 'Failed to test endpoint');
    }
  };

  // Function to handle generating FastAPI code
  const handleFastAPI = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Log the action
      console.log('Generating FastAPI code for endpoint:', endpoint.path, endpoint.method);
      
      // Show a notification
      toast(`Generating FastAPI code for ${endpoint.method} ${endpoint.path}`);
      
      // Here you would implement the actual FastAPI code generation logic
      // For example, generating a Python FastAPI endpoint based on the TMF endpoint
      
    } catch (error) {
      console.error('Error generating FastAPI code:', error);
      toast(error instanceof Error ? error.message : 'Failed to generate FastAPI code');
    }
  };

  // Fetch existing mapping when component mounts
  useEffect(() => {
    const fetchExistingMapping = async () => {
      try {
        const encodedEndpointId = encodeURIComponent(endpoint.id);
        const response = await fetch(`/api/get-endpoint-mapping?endpointId=${encodedEndpointId}&docId=${docId}`);
        const data = await response.json();
        
        if (response.ok && data.data) {
          setMappingResult(data.data);
          setMappingProgress({
            mapped: data.data.field_mappings.length,
            total: endpoint.specification.fields.length
          });
        }
      } catch (error) {
        console.error('Error fetching existing mapping:', error);
      }
    };

    fetchExistingMapping();
  }, [endpoint.id, docId, endpoint.specification.fields.length]);

  // Calculate mapping progress when mappingResult changes
  useEffect(() => {
    if (!mappingResult?.field_mappings) {
      setMappingProgress(prev => ({
        ...prev,
        mapped: 0
      }));
      return;
    }

    // Count mapped fields including nested ones
    const countMappedFields = (mappings: Array<{ source: string }>) => {
      return mappings.reduce((count, mapping) => {
        // Split the source path to handle nested fields (e.g., "parent.child")
        const fieldParts = mapping.source.split('.');
        return count + fieldParts.length;
      }, 0);
    };

    // Only update if field_mappings is an array
    if (Array.isArray(mappingResult.field_mappings)) {
      const mappedFields = countMappedFields(mappingResult.field_mappings);
      setMappingProgress(prev => ({ 
        ...prev, 
        mapped: mappedFields 
      }));
    }
  }, [mappingResult]);

  // Add a visual indicator for mapped endpoints in the header
  const renderMappingIndicator = () => {
    if (!mappingResult?.field_mappings?.length || !mappingResult.source_endpoint?.path) return null;
    
    const mappedPercentage = Math.round((mappingProgress.mapped / mappingProgress.total) * 100);
    
    return (
      <span className={`text-xs px-2 py-1 rounded ${
        mappedPercentage >= 70 ? 'bg-success/20 text-success' :
        mappedPercentage >= 50 ? 'bg-warning/20 text-warning' :
        'bg-error/20 text-error'
      }`}>
        {mappedPercentage}% Mapped
      </span>
    );
  };

  const handleEditMapping = (index: number, mapping: any) => {
    setEditingMapping({ index, mapping: { ...mapping } });
  };

  const handleSaveEdit = async () => {
    if (!editingMapping || !mappingResult) return;

    try {
      // Make sure field_mappings is an array before spreading
      const currentMappings = Array.isArray(mappingResult.field_mappings) ? mappingResult.field_mappings : [];
      const updatedMappings = [...currentMappings];
      
      // Update the mapping at the specified index
      updatedMappings[editingMapping.index] = {
        ...updatedMappings[editingMapping.index],
        ...editingMapping.mapping,
      };

      // Create the complete updated mapping object
      const updatedMappingResult = {
        ...mappingResult,
        field_mappings: updatedMappings,
        confidence_score: mappingResult.confidence_score || 0,
        source_endpoint: mappingResult.source_endpoint || {
          path: '',
          method: '',
          description: ''
        },
        reasoning: mappingResult.reasoning || 'Updated mapping'
      };

      const response = await fetch(`/api/update-mapping?endpointId=${endpoint.id}&docId=${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMappingResult),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update mapping');
      }

      const responseData = await response.json();
      setMappingResult(responseData.data);
      setEditingMapping(null);
      toast.success('Mapping updated successfully');
    } catch (error) {
      console.error('Error updating mapping:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update mapping');
    }
  };

  const handleDeleteMapping = async (index: number) => {
    if (!mappingResult) return;

    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to delete this mapping?')) {
      return;
    }

    try {
      // Make sure field_mappings is an array before filtering
      const currentMappings = Array.isArray(mappingResult.field_mappings) ? mappingResult.field_mappings : [];
      const updatedMappings = currentMappings.filter((_, i) => i !== index);
      
      // If this was the last mapping, set a minimal valid state
      const updatedMappingResult = updatedMappings.length === 0 ? {
        field_mappings: [],
        confidence_score: 0,
        source_endpoint: {
          path: '',
          method: '',
          description: ''
        },
        reasoning: 'No mappings defined'
      } : {
        ...mappingResult,
        field_mappings: updatedMappings,
        confidence_score: mappingResult.confidence_score,
        source_endpoint: mappingResult.source_endpoint,
        reasoning: mappingResult.reasoning
      };

      const response = await fetch(`/api/update-mapping?endpointId=${endpoint.id}&docId=${docId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedMappingResult),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete mapping');
      }

      const responseData = await response.json();
      setMappingResult(responseData.data);
      toast.success('Mapping deleted successfully');
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete mapping');
    }
  };

  const handleAddMapping = async () => {
    console.log('[TMFEndpointList] Starting handleAddMapping with:', { 
      newMapping, 
      endpoint, 
      docId, 
      mappingResult,
      selectedEndpoint,
      documentEndpoints 
    });
    
    if (!newMapping.source || !newMapping.target) {
      toast.error('Both source and target fields are required');
      return;
    }

    if (!endpoint || !endpoint.id) {
      console.error('[TMFEndpointList] Missing endpoint or endpoint.id');
      toast.error('Missing endpoint information. Please select an endpoint first.');
      return;
    }

    if (!docId) {
      console.error('[TMFEndpointList] Missing docId');
      toast.error('Missing document ID. Please select a document first.');
      return;
    }
    
    // Get the endpoint from the dropdown selection
    let sourceEndpoint = null;
    if (selectedEndpoint && documentEndpoints.length > 0) {
      const endpointIndex = parseInt(selectedEndpoint);
      sourceEndpoint = documentEndpoints[endpointIndex];
    }

    // If no source endpoint is found from dropdown, display error
    if (!sourceEndpoint) {
      toast.error('Please select a source endpoint from the dropdown first');
      return;
    }

    try {
      console.log('[TMFEndpointList] Adding new mapping:', newMapping);
      
      // Create a new mapping result if one doesn't exist yet
      let updatedMappingResult;
      
      if (mappingResult) {
        console.log('[TMFEndpointList] Updating existing mapping result');
        // Make sure field_mappings is an array before spreading
        const currentMappings = Array.isArray(mappingResult.field_mappings) ? mappingResult.field_mappings : [];
        
        // Create the new mapping with confidence
        const newMappingWithConfidence = { 
          ...newMapping, 
          confidence: 70, // Default confidence for manual mappings
          endpoint_info: {
            path: sourceEndpoint.path,
            method: sourceEndpoint.method
          }
        };
        
        // Add the new mapping to the array
        const updatedMappings = [
          ...currentMappings,
          newMappingWithConfidence
        ];
        
        // Create the updated mapping result object
        updatedMappingResult = {
          ...mappingResult,
          field_mappings: updatedMappings,
        };
      } else {
        console.log('[TMFEndpointList] Creating new mapping result');
        // Create a new mapping result if one doesn't exist
        updatedMappingResult = {
          source_endpoint: {
            path: endpoint.path,
            method: endpoint.method,
            description: '' // Default empty description
          },
          field_mappings: [{
            ...newMapping,
            confidence: 70, // Default confidence for manual mappings
            endpoint_info: {
              path: sourceEndpoint.path,
              method: sourceEndpoint.method
            }
          }],
          confidence_score: 70, // Default confidence score
          reasoning: 'Manually created mapping'
          // Remove status field as it's not in the MappingResult type
        };
      }
      
      console.log('[TMFEndpointList] Updated mapping result:', updatedMappingResult);
      console.log('[TMFEndpointList] Sending to API with endpointId:', endpoint.id, 'and docId:', docId);

      // Send the update to the server
      const response = await fetch(`/api/update-mapping?endpointId=${endpoint.id}&docId=${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMappingResult),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to add mapping');
      }

      // Get the response data
      const responseData = await response.json();
      console.log('[TMFEndpointList] Server response after adding mapping:', responseData);
      
      // Update the local state with the new mapping result
      setMappingResult(updatedMappingResult);
      
      // Reset the form
      setNewMapping({ source: '', target: '', transform: '' });
      setIsAddingMapping(false);
      
      // Show success message
      toast.success('New mapping added successfully');
      
      // Update the mapping progress
      setMappingProgress(prev => ({
        ...prev,
        mapped: updatedMappingResult.field_mappings.length
      }));
    } catch (error) {
      console.error('[TMFEndpointList] Error adding mapping:', error);
      toast.error('Failed to add mapping');
    }
  };

  // Fetch available documentation when component mounts
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const response = await fetch('/api/list-documentation');
        if (response.ok) {
          const data = await response.json();
          
          // Check if the data contains documents array
          if (data && data.documents && Array.isArray(data.documents)) {
            // Use the logisenseService to ensure Logisense is in the documents list
            const docsWithLogisense = logisenseService.ensureLogisenseInDocuments(data.documents);
            setAvailableDocs(docsWithLogisense);
          } else {
            // If no documents or invalid format, at least add Logisense
            setAvailableDocs([logisenseService.LOGISENSE_DOC]);
          }
        } else {
          // If response not OK, ensure Logisense is available
          setAvailableDocs([logisenseService.LOGISENSE_DOC]);
        }
      } catch (err) {
        console.error('Error fetching documentation:', err);
        
        // Even if there's an error, ensure Logisense is available
        setAvailableDocs([logisenseService.LOGISENSE_DOC]);
      }
    };
    fetchDocs();
  }, []);

  // Fetch endpoints when a document is selected
  useEffect(() => {
    if (selectedDoc) {
      fetchEndpoints();
    } else {
      console.log('[TMFEndpointList] No document selected, clearing endpoints');
      setDocumentEndpoints([]);
    }
  }, [selectedDoc]);

  const countAllFields = () => {
    // Count fields that are actually rendered in the UI
    const countRenderedFields = (fields: TMFField[], path: string = ''): number => {
      let count = 0;
      fields.forEach(field => {
        // Count this field
        count++;
        
        // If this field has expanded subfields in the UI, count those too
        const fieldPath = path ? `${path}.${field.name}` : field.name;
        const subFields = expandedFields[fieldPath];
        if (subFields) {
          count += countRenderedFields(subFields, fieldPath);
        }
      });
      return count;
    };

    // Start counting from the fields rendered in the UI
    const renderedFields = endpoint.specification.fields;
    return countRenderedFields(renderedFields);
  };

  const handleCardExpand = async () => {
    console.log('Main card clicked - toggling expansion');
    
    // If we're expanding the card (not collapsing)
    if (!isExpanded) {
      // Get all fields that need schema lookup
      const fieldsNeedingSchema = endpoint.specification.fields.filter(field => {
        return field.schema && field.schema.$ref;
      });

      // Expand all fields that need schema lookup
      const expandPromises = fieldsNeedingSchema.map(field => handleFieldExpand(field, field.name));
      await Promise.all(expandPromises);

      // After ALL expansion is complete, count the total fields
      const total = countAllFields();
      console.log('Total rendered fields:', total);
      setMappingProgress(prev => ({
        ...prev,
        total
      }));
    }
    
    setIsExpanded(!isExpanded);
  };

  const handleFieldExpand = async (field: TMFField, fieldPath: string) => {
    try {
      if (!field?.schema?.$ref) {
        console.log(`No schema ref for field ${fieldPath}`);
        return;
      }

      console.log(`Expanding field ${fieldPath} with schema ref:`, field.schema.$ref);
      setLoadingFields(prev => new Set([...Array.from(prev), fieldPath]));
      
      let fieldType = field.type;
      const schemaRef = field.schema.$ref;
      
      if (schemaRef.includes('#/definitions/')) {
        fieldType = schemaRef.split('#/definitions/')[1];
      } else if (schemaRef.includes('#/components/schemas/')) {
        fieldType = schemaRef.split('#/components/schemas/')[1];
      } else if (schemaRef.includes('#')) {
        fieldType = schemaRef.split('#')[1];
      }
      
      console.log(`Looking up schema for ${fieldPath} using type: ${fieldType}`);
      
      const subFields = await tmfService.getFieldDetails(field.name, fieldType);
      console.log(`Received subfields for ${fieldPath}:`, subFields);

      if (subFields && subFields.length > 0) {
        console.log(`Setting expanded fields for ${fieldPath}`);
        setExpandedFields(prev => ({
          ...prev,
          [fieldPath]: subFields.map(subField => ({
            ...subField,
            expanded: false
          }))
        }));

        // Get all nested fields that need expansion
        const nestedFields = subFields.filter(subField => subField.schema?.$ref);
        
        // Expand all nested fields
        if (nestedFields.length > 0) {
          const nestedPromises = nestedFields.map(subField => {
            const nestedPath = `${fieldPath}.${subField.name}`;
            return handleFieldExpand(subField, nestedPath);
          });
          await Promise.all(nestedPromises);
        }
      }
    } catch (error) {
      console.error('Error expanding field:', fieldPath, error);
    } finally {
      setLoadingFields(prev => {
        const next = new Set(Array.from(prev));
        next.delete(fieldPath);
        return next;
      });
    }
  };

  const renderField = (field: TMFField, level: number = 0, parentPath: string = '') => {
    // Create a unique path for this field that includes its parent path
    const fieldPath = parentPath ? `${parentPath}.${field.name}` : field.name;
    
    const isExpandable = field.schema && field.schema.$ref;
    const isExpanded = expandedFields[fieldPath]?.length > 0;
    const isLoading = loadingFields.has(fieldPath);
    const subFields = expandedFields[fieldPath];

    // Check if this field is mapped
    const isFieldMapped = mappingResult?.field_mappings?.some(
      mapping => mapping.target === fieldPath
    );

    // Prevent infinite recursion by limiting depth
    if (level > 10) {
        console.log('Maximum nesting depth reached for field:', fieldPath);
        return null;
    }

    // Create a unique key for the field that includes its full path
    const fieldKey = fieldPath;

    return (
        <div key={fieldKey} style={{ marginLeft: `${level * 20}px` }}>
            <div 
                className="bg-pure-black/20 rounded-lg p-3 hover:bg-pure-black/30 cursor-pointer transition-colors"
                onClick={(e) => {
                    e.stopPropagation();
                    // When a field is clicked, store it as the target field for mapping
                    if (isAddingMapping) {
                        // If we're already adding a mapping, set this as the target field
                        setNewMapping(prev => ({ ...prev, target: fieldPath }));
                        toast.success(`Selected "${fieldPath}" as target field`);
                    } else {
                        // If we're not in mapping mode, start a new mapping with this as the target
                        setIsAddingMapping(true);
                        setNewMapping(prev => ({ ...prev, target: fieldPath }));
                        toast.success(`Selected "${fieldPath}" as target field. Now select a source field.`);
                    }
                }}
            >
                <div className="flex items-center gap-2 mb-1">
                    {isExpandable && (
                        <svg 
                            className={`h-4 w-4 text-gray-700 dark:text-pure-white/50 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleFieldExpand(field, fieldPath);
                            }}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    )}
                    <span className="text-gray-800 dark:text-pure-white font-medium">
                        {field.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-pure-white/10 text-gray-700 dark:text-pure-white/70">
                        {field.type}
                    </span>
                    {isFieldMapped && (
                        <span className="text-xs px-2 py-0.5 rounded bg-success/20 text-success">
                            Mapped
                        </span>
                    )}
                    {field.required && (
                        <span className="text-xs px-2 py-0.5 rounded bg-warning/20 text-warning">
                            Required
                        </span>
                    )}
                    {isLoading && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    )}
                </div>
                <p className="text-sm text-gray-700 dark:text-pure-white/70">
                    {field.description}
                </p>
            </div>

            {isExpanded && subFields && subFields.length > 0 && (
                <div className="mt-2 space-y-2">
                    {subFields.map(subField => {
                        // Skip rendering if it would create a circular reference
                        if (fieldPath.includes(subField.name)) {
                            console.log('Preventing circular reference for field:', subField.name, 'in path:', fieldPath);
                            return null;
                        }
                        return renderField(subField, level + 1, fieldPath);
                    })}
                </div>
            )}
        </div>
    );
  };

  const handleAddEndpoint = async () => {
    if (!selectedDoc || !selectedEndpoint) return;
    
    try {
      // Find the selected endpoint by index
      const endpointIndex = parseInt(selectedEndpoint);
      const endpoint = documentEndpoints[endpointIndex];
      
      if (!endpoint) {
        toast.error('Selected endpoint not found');
        return;
      }
      
      console.log('[TMFEndpointList] Selected endpoint for adding:', endpoint);
      
      const method = endpoint.method || 'GET';
      const description = endpoint.description || '';
      const path = endpoint.path;
      const isGraphQL = path.includes('/graphql');
      
      // Try different ways to access fields
      const fields = endpoint.fields || [];
      console.log('[TMFEndpointList] Fields for adding endpoint:', fields);
      
      // Extract GraphQL-specific data if applicable
      const operationId = endpoint.operationId || 
        (isGraphQL && path.includes('=') ? path.split('=')[1] : '');
      
      const graphqlType = endpoint.graphqlType || 
        (isGraphQL && path.includes('query=') ? 'query' : 
         isGraphQL && path.includes('mutation=') ? 'mutation' : '');
      
      console.log('[TMFEndpointList] Adding endpoint with details:', {
        docId: selectedDoc,
        path,
        method,
        description,
        isGraphQL,
        operationId,
        graphqlType,
        fields
      });
      
      // For GraphQL endpoints, include the operation ID in the request
      const requestData: any = {
        docId: selectedDoc,
        path,
        method,
        description
      };
      
      // Add GraphQL-specific data if applicable
      if (isGraphQL && operationId) {
        requestData.operationId = operationId;
        requestData.graphqlType = graphqlType;
        
        // For GraphQL endpoints, get fields directly from our API
        if (fields.length === 0) {
          try {
            // Use our new API endpoint to fetch fields
            const fieldsResponse = await fetch(`/api/get-graphql-fields?docId=${selectedDoc}&operationId=${operationId}`);
            
            if (fieldsResponse.ok) {
              const fieldsData = await fieldsResponse.json();
              if (fieldsData.success && fieldsData.fields) {
                console.log('[TMFEndpointList] Received GraphQL fields from API:', fieldsData.fields);
                requestData.fields = fieldsData.fields;
              }
            } else {
              console.error('[TMFEndpointList] Failed to fetch GraphQL fields:', await fieldsResponse.text());
            }
          } catch (error) {
            console.error('[TMFEndpointList] Error fetching GraphQL fields:', error);
          }
        } else {
          // Use the fields we already have
          requestData.fields = fields;
        }
      }
      
      const response = await fetch('/api/add-endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.details || 'Failed to add endpoint');
      }

      const responseData = await response.json();
      console.log('[TMFEndpointList] Endpoint added successfully:', responseData);
      
      toast.success('Endpoint added successfully');
      setIsAddingEndpoint(false);
      setNewEndpointPath('');
      
      // If we have the endpoint data, show it for mapping
      if (responseData.endpoint && responseData.endpoint.id) {
        // Get the fields from the endpoint specification
        const endpointFields = responseData.endpoint.specification?.fields || [];
        
        console.log('[TMFEndpointList] Endpoint fields from response:', endpointFields);
        
        // Try to get fields from the server response or from the original endpoint
        const fieldsToUse = requestData.fields && requestData.fields.length > 0 ? requestData.fields : 
                           (responseData.endpoint.fields || 
                            responseData.fields || 
                            endpointFields || 
                            []);
        
        console.log('[TMFEndpointList] Fields to use for mapping:', fieldsToUse);
        
        // Create a mapping result to display the endpoint properties
        const result = {
          field_mappings: [],
          confidence_score: 0,
          source_endpoint: {
            path,
            method,
            description
          },
          reasoning: 'Newly added endpoint. You can now map fields to this endpoint.',
          fields: fieldsToUse.map((field: any) => ({
            ...field,
            path: field.name // Add the path property using the field name
          }))
        };
        
        setMappingResult(result);
        
        // Expand the card to show the properties
        setIsExpanded(true);
        
        // Show a toast message guiding the user to map fields
        toast.success('Endpoint added. You can now map fields to this endpoint.', { duration: 5000 });
      }
      
      // Refresh the endpoint list to show the newly added endpoint
      fetchEndpoints();
      
      // Clear selections
      setSelectedDoc('');
      setSelectedEndpoint('');
    } catch (error) {
      console.error('Error adding endpoint:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add endpoint');
    }
  };

  // Function to render the confidence score
  const renderConfidenceScore = () => {
    return null
  };

  // Update the useEffect to handle multiple fields
  useEffect(() => {
    if (isAddingMapping) {
      // Check for a single field first
      const lastSelectedField = localStorage.getItem('lastSelectedField');
      if (lastSelectedField) {
        setNewMapping(prev => ({ ...prev, source: lastSelectedField }));
        // Clear the stored field name after using it
        localStorage.removeItem('lastSelectedField');
        return;
      }
      
      // Check for multiple fields
      const allSelectedFields = localStorage.getItem('allSelectedFields');
      if (allSelectedFields) {
        try {
          const fieldNames = JSON.parse(allSelectedFields);
          if (Array.isArray(fieldNames) && fieldNames.length > 0) {
            // Use the first field and remove it from the array
            const firstField = fieldNames.shift();
            setNewMapping(prev => ({ ...prev, source: firstField }));
            
            // Store the remaining fields back in localStorage
            if (fieldNames.length > 0) {
              localStorage.setItem('allSelectedFields', JSON.stringify(fieldNames));
            } else {
              localStorage.removeItem('allSelectedFields');
            }
          }
        } catch (error) {
          console.error('Error parsing selected fields:', error);
          localStorage.removeItem('allSelectedFields');
        }
      }
    }
  }, [isAddingMapping]);

  // Add a handler for when a mapping is added to automatically start adding the next field
  const handleAddMappingWithAutoNext = async () => {
    if (!newMapping.source || !newMapping.target) {
      toast.error('Both source and target fields are required');
      return;
    }
    
    console.log('[TMFEndpointList] Adding mapping with auto-next:', newMapping);
    
    // Call the regular add mapping function
    await handleAddMapping();
    
    // Check if there are more fields to map
    const allSelectedFields = localStorage.getItem('allSelectedFields');
    if (allSelectedFields) {
      try {
        const fieldNames = JSON.parse(allSelectedFields);
        if (Array.isArray(fieldNames) && fieldNames.length > 0) {
          console.log('[TMFEndpointList] More fields to map:', fieldNames);
          // Automatically start adding the next mapping
          setIsAddingMapping(true);
        } else {
          console.log('[TMFEndpointList] No more fields to map');
          toast.success('All fields have been mapped!');
          localStorage.removeItem('allSelectedFields');
        }
      } catch (error) {
        console.error('[TMFEndpointList] Error parsing selected fields:', error);
        localStorage.removeItem('allSelectedFields');
      }
    }
  };

  // Add this useEffect to fetch fields when an endpoint is selected
  useEffect(() => {
    if (selectedEndpoint) {
      const endpointIndex = parseInt(selectedEndpoint);
      const endpoint = documentEndpoints[endpointIndex];
      
      if (endpoint && endpoint.path.includes('/graphql')) {
        // Extract operation ID
        const operationId = endpoint.operationId || 
          (endpoint.path.includes('=') ? endpoint.path.split('=')[1] : '');
        
        // If fields are already available, no need to fetch
        if (endpoint.fields && endpoint.fields.length > 0) {
          console.log('[TMFEndpointList] GraphQL fields already available:', endpoint.fields);
          setFetchedEndpointFields(endpoint.fields);
          return;
        }
        
        if (operationId) {
          setLoadingEndpointFields(true);
          console.log('[TMFEndpointList] Fetching fields for GraphQL operation:', operationId);
          
          // Use our new API endpoint to fetch fields
          fetch(`/api/get-graphql-fields?docId=${selectedDoc}&operationId=${operationId}`)
            .then(response => {
              if (!response.ok) {
                throw new Error(`Failed to fetch fields: ${response.status}`);
              }
              return response.json();
            })
            .then(data => {
              if (data.success && data.fields) {
                console.log('[TMFEndpointList] Received GraphQL fields from API:', data.fields);
                setFetchedEndpointFields(data.fields);
                
                // Update the endpoint with the fields
                setDocumentEndpoints(prev => {
                  const updated = [...prev];
                  updated[endpointIndex] = {
                    ...updated[endpointIndex],
                    fields: data.fields
                  };
                  return updated;
                });
              } else {
                console.error('[TMFEndpointList] API returned error:', data.error);
                setFetchedEndpointFields([]);
              }
            })
            .catch(error => {
              console.error('[TMFEndpointList] Error fetching GraphQL fields:', error);
              setFetchedEndpointFields([]);
            })
            .finally(() => {
              setLoadingEndpointFields(false);
            });
        }
      }
    }
  }, [selectedEndpoint, selectedDoc, documentEndpoints]);

  // Function to process endpoint documentation through AI
  const processEndpointWithAI = async (endpoint: {
    id: string;
    path: string;
    method: string;
    description: string;
    fields?: Array<any>;
    operationId?: string;
    graphqlType?: string;
    specification?: any;
    schema?: any;
    parameters?: any;
    responses?: any;
  }) => {
    setProcessingEndpointWithAI(true);
    setAiProcessedFields([]);
    
    console.log('[TMFEndpointList] Processing endpoint with AI:', endpoint.path);
    
    try {
      // First fetch the complete endpoint data with config from database
      console.log('[TMFEndpointList] Fetching complete endpoint data from database...');
      
      const completeEndpointResponse = await fetch(`/api/get-complete-endpoint?docId=${docId}&endpointId=${endpoint.id}&method=${endpoint.method}`);
      
      if (!completeEndpointResponse.ok) {
        const errorData = await completeEndpointResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[TMFEndpointList] Failed to fetch complete endpoint data:', 
          completeEndpointResponse.status, errorData);
        throw new Error(errorData.error || completeEndpointResponse.statusText);
      }
      
      const completeEndpointData = await completeEndpointResponse.json();
      
      if (!completeEndpointData.success || !completeEndpointData.endpoint) {
        console.error('[TMFEndpointList] Invalid response from get-complete-endpoint API:', completeEndpointData);
        throw new Error('Failed to get complete endpoint data');
      }
      
      console.log('[TMFEndpointList] Retrieved complete endpoint with config. Keys:', 
        Object.keys(completeEndpointData.endpoint));
      
      if (completeEndpointData.endpoint.rawConfig) {
        console.log('[TMFEndpointList] Found rawConfig in endpoint data!');
      } else {
        console.warn('[TMFEndpointList] No rawConfig found in endpoint data');
      }
      
      // Now process the endpoint with AI using the complete data including config
      const processedData = await processWithAI(completeEndpointData.endpoint);
      
      if (!processedData.fields || !Array.isArray(processedData.fields) || processedData.fields.length === 0) {
        console.warn('[TMFEndpointList] No fields returned from AI processing');
        toast.error('No fields found in AI processing results');
        return;
      }
      
      // Normalize fields from AI
      const normalizedFields = processedData.fields.map((field: any) => ({
        name: field.name,
        type: field.type || 'string',
        description: field.description || '',
        required: !!field.required,
      }));
      
      console.log('[TMFEndpointList] Normalized fields from AI:', normalizedFields);
      setAiProcessedFields(normalizedFields);
      
      // Find the original endpoint in our state
      const originalEndpoint = documentEndpoints.find(e => e.id === endpoint.id);
      
      if (!originalEndpoint) {
        console.error('[TMFEndpointList] Could not find original endpoint in state:', endpoint.id);
        toast.error('Failed to update endpoint: Original endpoint not found');
        return;
      }
      
      // Update the endpoint with the normalized fields
      const updatedEndpoint = {
        ...originalEndpoint,
        fields: normalizedFields,
      };
      
      // Update the endpoint in the documentEndpoints state
      setDocumentEndpoints((prev) =>
        prev.map((e) => (e.id === endpoint.id ? updatedEndpoint : e))
      );
      
      toast.success(`Successfully processed ${normalizedFields.length} fields for endpoint ${endpoint.path}`);
    } catch (error) {
      console.error('[TMFEndpointList] Error processing endpoint with AI:', error);
      toast.error(`Failed to process endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessingEndpointWithAI(false);
    }
  };

  // Helper function to process the endpoint with AI
  const processWithAI = async (endpointData: any) => {
    console.log('[TMFEndpointList] Processing with AI:', endpointData.path);
    
    // Check if we have the configData property from the database
    if (endpointData.configData) {
      console.log('[TMFEndpointList] Found configData in endpoint object:', 
        Object.keys(endpointData.configData).join(', '));
    } else {
      console.log('[TMFEndpointList] No configData in endpoint object');
    }
    
    try {
      const response = await fetch('/api/process-endpoint-with-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: endpointData,
          includeConfigData: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[TMFEndpointList] AI processing failed:', response.status, errorData);
        throw new Error(errorData.error || response.statusText);
      }

      const data = await response.json();
      console.log('[TMFEndpointList] AI processing successful, response:', data);
      return data;
    } catch (error) {
      console.error('[TMFEndpointList] Error in AI processing:', error);
      throw error;
    }
  };

  // Add handler for endpoint selection
  const handleEndpointSelection = async (endpointId: string) => {
    setSelectedEndpoint(endpointId);
    
    // Find the selected endpoint
    const selectedEndpointIndex = parseInt(endpointId);
    if (!isNaN(selectedEndpointIndex) && documentEndpoints[selectedEndpointIndex]) {
      const selectedEndpoint = documentEndpoints[selectedEndpointIndex];
      
      // Log the full endpoint being selected
      console.log('[TMFEndpointList] SELECTED ENDPOINT DATA:');
      console.log(JSON.stringify(selectedEndpoint, null, 2));
      
      // Process the endpoint with AI
      await processEndpointWithAI(selectedEndpoint);
    }
  };

  return (
    <>
      <div className="glass-card p-4 hover:scale-[1.01] transition-all duration-300">
        <div 
          className="flex items-start justify-between gap-4 cursor-pointer"
          onClick={handleCardExpand}
        >
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2 py-1 rounded text-xs font-medium
                ${endpoint.method === 'GET' ? 'bg-success/20 text-success' :
                  endpoint.method === 'POST' ? 'bg-info/20 text-info' :
                  endpoint.method === 'PATCH' ? 'bg-warning/20 text-warning' :
                  'bg-error/20 text-error'}`}
              >
                {endpoint.method}
              </span>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-pure-white">
                {endpoint.name}
              </h3>
              {renderMappingIndicator()}
              <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-pure-white/10 text-gray-700 dark:text-pure-white/70">
                {endpoint.specification.category || 'Uncategorized'}
              </span>
              <svg 
                className={`h-5 w-5 text-pure-white/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-gray-700 dark:text-pure-white/70 text-sm mb-2">
              {endpoint.specification.description}
            </p>
            <code className="text-xs bg-gray-100 dark:bg-pure-black/30 px-2 py-1 rounded text-gray-800 dark:text-pure-white">
              {endpoint.path}
            </code>
          </div>
          <div className="text-sm text-gray-600 dark:text-pure-white/50">
            {endpoint.specification.name}
          </div>
        </div>

        {/* Expanded properties view */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-pure-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h4 className="text-gray-800 dark:text-pure-white font-medium">Properties</h4>
                {mappingError && (
                  <p className="text-error text-sm">{mappingError}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                {isMapping && (
                  <span className="text-gray-700 dark:text-pure-white/70 text-sm">
                    This process takes about 1 minute. {mappingStages.find(stage => stage.status === 'in-progress')?.description || 'Processing...'}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <button
                    className="btn-primary flex items-center gap-2"
                    onClick={handleMapEndpoint}
                    disabled={isMapping}
                  >
                    {isMapping ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Mapping...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span>Map Endpoint</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleTestEndpoint}
                    className="btn-secondary flex items-center gap-2 mr-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Test Endpoint</span>
                  </button>
                  <button
                    onClick={handleFastAPI}
                    className="btn-secondary flex items-center gap-2 mr-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>FastAPI</span>
                  </button>
                  <button
                    onClick={() => setShowAIChat(true)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span>Add Context</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {/* Documentation Properties (Left Column) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-pure-white/70">Documentation Properties</h5>
                  <button
                    onClick={() => setIsAddingEndpoint(true)}
                    className="text-xs bg-success/20 text-success px-2 py-1 rounded hover:bg-success/30 transition-colors"
                  >
                    Add Mapping
                  </button>
                </div>
                <div className="space-y-2">
                  {isAddingEndpoint && (
                    <div className="bg-gray-100 dark:bg-pure-black/20 rounded-lg p-3 space-y-3 border border-gray-300 dark:border-pure-white/10 shadow-sm">
                      <div className="space-y-2">
                        <select
                          value={selectedDoc}
                          onChange={(e) => {
                            console.log('[TMFEndpointList] Document selected:', e.target.value);
                            setSelectedDoc(e.target.value);
                          }}
                          className="w-full bg-white border border-gray-300 dark:border-pure-white/10 rounded px-2 py-1 text-gray-800 dark:text-pure-white placeholder-gray-500 dark:placeholder-pure-white/30 focus:outline-none focus:border-totogi-purple shadow-sm"
                        >
                          <option value="">Select Documentation</option>
                          {availableDocs.map(doc => (
                            <option key={doc.id} value={doc.id}>{doc.name}</option>
                          ))}
                        </select>
                        
                        {selectedDoc && (
                          <>
                            <div className="text-xs text-pure-white/70 mb-1">
                              {documentEndpoints.length > 0 
                                ? currentMethod 
                                  ? `${documentEndpoints.filter(e => e.method === currentMethod).length} ${currentMethod} endpoints available` 
                                  : `${documentEndpoints.length} endpoints available`
                                : 'No endpoints found for this document'}
                            </div>
                            <select
                              value={selectedEndpoint}
                              onChange={e => handleEndpointSelection(e.target.value)}
                              className="w-full bg-white border border-gray-300 dark:border-pure-white/10 rounded px-2 py-1 text-gray-800 dark:text-pure-white placeholder-gray-500 dark:placeholder-pure-white/30 focus:outline-none focus:border-totogi-purple shadow-sm"
                              disabled={documentEndpoints.length === 0}
                            >
                              <option value="">Select Endpoint</option>
                              {documentEndpoints.map((endpoint, index) => {
                                // If we're on a specific tile method, only show endpoints with matching method
                                if (currentMethod && endpoint.method !== currentMethod) {
                                  return null; // Skip endpoints with non-matching methods
                                }
                                
                                // Check if this is a GraphQL endpoint
                                const isGraphQL = endpoint.path?.includes('/graphql');
                                
                                // Extract operationId and graphqlType if available
                                // Use type assertion with optional chaining for safety
                                const operationId = endpoint.operationId || 
                                  (isGraphQL && endpoint.path.includes('=') ? endpoint.path.split('=')[1] : '');
                                  
                                const graphqlType = endpoint.graphqlType || 
                                  (isGraphQL && endpoint.path.includes('query=') ? 'query' : 
                                   isGraphQL && endpoint.path.includes('mutation=') ? 'mutation' : '');
                                
                                // Create a display name based on the endpoint type
                                let displayName;
                                if (isGraphQL && operationId) {
                                  displayName = `${graphqlType}: ${operationId}`;
                                } else {
                                  displayName = `${endpoint.method} ${endpoint.path}`;
                                }
                                
                                return (
                                  <option key={index} value={index}>
                                    {displayName}
                                  </option>
                                );
                              })}
                            </select>
                            {documentEndpoints.length === 0 && (
                              <div className="text-xs text-warning mt-1">
                                No endpoints found. The documentation may not contain any endpoints or they may be in an unsupported format.
                              </div>
                            )}
                            
                            {/* New dropdown for endpoint fields */}
                            {selectedEndpoint && (
                              <>
                                {/* AI processing indicator and results */}
                                {processingEndpointWithAI ? (
                                  <div className="mt-4 flex items-center space-x-2 text-gray-600 dark:text-pure-white/70">
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Processing endpoint with AI...</span>
                                  </div>
                                ) : aiProcessedFields.length > 0 ? (
                                  <div className="mt-4 space-y-4">
                                    <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 rounded-r">
                                      <div className="flex">
                                        <div className="flex-shrink-0">
                                          <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                          </svg>
                                        </div>
                                        <div className="ml-3">
                                          <p className="text-sm text-green-700 dark:text-green-300">
                                            AI processing complete! {aiProcessedFields.length} fields identified.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Display the AI processed fields */}
                                    <div className="bg-white dark:bg-pure-black/30 shadow overflow-hidden rounded-md">
                                      <div className="px-4 py-3 border-b border-gray-200 dark:border-pure-white/10">
                                        <h3 className="text-sm font-medium text-gray-900 dark:text-pure-white">
                                          AI-Processed Fields 
                                          <span className="ml-2 text-xs text-gray-500 dark:text-pure-white/50">
                                            (Click a field to use as source in mapping)
                                          </span>
                                        </h3>
                                      </div>
                                      <ul className="divide-y divide-gray-200 dark:divide-pure-white/10 max-h-60 overflow-y-auto">
                                        {aiProcessedFields.map((field, index) => (
                                          <li 
                                            key={index} 
                                            className={`px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-pure-black/50 transition-colors
                                              ${newMapping.source === field.name ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' : ''}`}
                                            onClick={() => handleAIFieldClick(field.name)}
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center">
                                                <span className="font-medium text-gray-900 dark:text-pure-white">{field.name}</span>
                                                <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                                  {field.type}
                                                </span>
                                               
                                                {newMapping.source === field.name && (
                                                  <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                                    Selected
                                                  </span>
                                                )}
                                              </div>
                                              {newMapping.source === field.name && !newMapping.target && (
                                                <span className="text-xs text-blue-600 dark:text-blue-400">
                                                  Now select a target field from TMF Properties →
                                                </span>
                                              )}
                                            </div>
                                            {field.description && (
                                              <p className="mt-1 text-sm text-gray-500 dark:text-pure-white/60">{field.description}</p>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    
                                    {/* Show a button to quickly add mapping if both source and target are selected */}
                                    {newMapping.source && newMapping.target && !isAddingMapping && (
                                      <div className="mt-3 flex justify-center">
                                        <button
                                          onClick={() => setIsAddingMapping(true)}
                                          className="bg-success text-white px-4 py-2 rounded hover:bg-success/90 transition-colors flex items-center gap-2"
                                        >
                                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                          </svg>
                                          Create Mapping with Selected Fields
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                                {/* Commented out second list of fields
                                <div className="max-h-40 overflow-y-auto bg-pure-black/20 rounded p-2">
                                  {(() => {
                                    // Find the selected endpoint by index
                                    const endpointIndex = parseInt(selectedEndpoint);
                                    const endpoint = documentEndpoints[endpointIndex];
                                    
                                    if (!endpoint) {
                                      console.error('[TMFEndpointList] Selected endpoint not found:', selectedEndpoint);
                                      return <div className="text-xs text-warning">No fields found</div>;
                                    }
                                    
                                    // Add debugging to see the endpoint structure
                                    console.log('[TMFEndpointList] Selected endpoint:', endpoint);
                                    
                                    // Check if this is a GraphQL endpoint
                                    const isGraphQL = endpoint.path.includes('/graphql');
                                    const operationId = endpoint.operationId || 
                                      (isGraphQL && endpoint.path.includes('=') ? endpoint.path.split('=')[1] : '');
                                    
                                    // Get fields from the endpoint - try different ways to access fields
                                    const fields = endpoint.fields || [];
                                    
                                    // Add more detailed logging to understand the fields structure
                                    console.log('[TMFEndpointList] Fields found:', fields);
                                    console.log('[TMFEndpointList] Fields type:', typeof fields);
                                    console.log('[TMFEndpointList] Is fields array?', Array.isArray(fields));
                                    
                                    // Try to get fields from the server response directly
                                    const serverFields = documentEndpoints.find(e => 
                                      e.path === endpoint.path && e.method === endpoint.method)?.fields || [];
                                    
                                    console.log('[TMFEndpointList] Server fields:', serverFields);
                                    
                                    // Use either the endpoint fields or server fields, whichever is available
                                    const displayFields = fields.length > 0 ? fields : 
                                                         serverFields.length > 0 ? serverFields : 
                                                         fetchedEndpointFields;
                                    
                                    if (loadingEndpointFields) {
                                      return <div className="text-xs text-info">Loading fields...</div>;
                                    }
                                    
                                    if (displayFields.length === 0) {
                                      return <div className="text-xs text-warning">No fields found for this endpoint</div>;
                                    }
                                    
                                    return (
                                      <div className="space-y-2">
                                        {displayFields.map((field: any, index: number) => (
                                          <div 
                                            key={index} 
                                            className="bg-pure-black/30 p-2 rounded hover:bg-pure-black/40 cursor-pointer transition-colors"
                                            onClick={() => {
                                              // When a field is clicked, store it as the source field for mapping
                                              if (isAddingMapping) {
                                                // If we're already adding a mapping, set this as the source field
                                                setNewMapping(prev => ({ ...prev, source: field.name }));
                                                toast.success(`Selected "${field.name}" as source field`);
                                              } else {
                                                // If we're not in mapping mode, start a new mapping with this as the source
                                                setIsAddingMapping(true);
                                                setNewMapping(prev => ({ ...prev, source: field.name }));
                                                toast.success(`Selected "${field.name}" as source field. Now select a target field.`);
                                              }
                                            }}
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2">
                                                <span className="text-gray-800 dark:text-pure-white font-medium">
                                                  {field.name}
                                                </span>
                                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-pure-white/10 text-gray-700 dark:text-pure-white/70">
                                                  {field.type}
                                                </span>
                                                {field.required && (
                                                  <span className="text-xs px-2 py-0.5 rounded bg-warning/20 text-warning">
                                                    Required
                                                  </span>
                                                )}
                                              </div>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation(); // Prevent the parent onClick from firing
                                                  // Store the field name to use for mapping later
                                                  localStorage.setItem('lastSelectedField', field.name);
                                                  toast.success(`Selected ${field.name} for mapping`);
                                                }}
                                                className="text-xs bg-info/20 text-info px-2 py-1 rounded hover:bg-info/30 transition-colors"
                                              >
                                                Quick Map
                                              </button>
                                            </div>
                                            {field.description && (
                                              <p className="text-xs text-gray-700 dark:text-pure-white/70 mt-1">
                                                {field.description}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                                */}
                                
                                {/* New Mapping Box */}
                                <div className="mt-4 bg-pure-black/30 p-3 rounded border border-info/30">
                                  <h4 className="text-sm font-medium text-gray-800 dark:text-pure-white mb-3">Add New Mapping</h4>
                                  <div className="space-y-3">
                                    <div>
                                      <label className="block text-xs text-gray-700 dark:text-pure-white/70 mb-1">
                                        Source Field:
                                      </label>
                                      <input
                                        type="text"
                                        value={newMapping.source}
                                        onChange={(e) => setNewMapping(prev => ({ ...prev, source: e.target.value }))}
                                        placeholder="Enter or select source field"
                                        className="w-full bg-white border border-pure-white/10 rounded px-2 py-1 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-totogi-purple text-sm"
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="block text-xs text-gray-700 dark:text-pure-white/70 mb-1">
                                        Target Field:
                                      </label>
                                      <input
                                        type="text"
                                        value={newMapping.target}
                                        onChange={(e) => setNewMapping(prev => ({ ...prev, target: e.target.value }))}
                                        placeholder="Enter or select target field"
                                        className="w-full bg-white border border-pure-white/10 rounded px-2 py-1 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-totogi-purple text-sm"
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="block text-xs text-gray-700 dark:text-pure-white/70 mb-1">
                                        Transform (Optional):
                                      </label>
                                      <input
                                        type="text"
                                        value={newMapping.transform}
                                        onChange={(e) => setNewMapping(prev => ({ ...prev, transform: e.target.value }))}
                                        placeholder="Enter transform expression"
                                        className="w-full bg-white border border-pure-white/10 rounded px-2 py-1 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-totogi-purple text-sm"
                                      />
                                    </div>
                                    
                                    <div className="flex justify-end">
                                      <button
                                        onClick={async () => {
                                          // Call existing add mapping function
                                          await handleAddMapping();
                                          
                                          // Clear the form fields after adding
                                          setNewMapping({ source: '', target: '', transform: '' });
                                          
                                          // Refresh the tile/card
                                          setIsExpanded(true); // Ensure the card is expanded
                                          
                                          // Force refresh of mapping progress
                                          if (mappingResult && mappingResult.field_mappings) {
                                            const mapped = mappingResult.field_mappings.length;
                                            const total = countAllFields();
                                            setMappingProgress({
                                              mapped,
                                              total
                                            });
                                          }
                                          
                                          toast.success('Mapping added successfully');
                                        }}
                                        disabled={!newMapping.source || !newMapping.target}
                                        className="bg-success text-white px-3 py-1.5 rounded hover:bg-success/90 transition-colors disabled:opacity-50 disabled:bg-gray-400 text-sm flex items-center gap-1"
                                      >
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Mapping
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                        
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setIsAddingEndpoint(false)}
                            className="text-gray-700 dark:text-pure-white/70 hover:text-gray-900 dark:hover:text-pure-white px-2 py-1"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {mappingResult ? (
                    <div className="bg-pure-black/20 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        
                        {renderConfidenceScore()}
                      </div>
                      
                      
                      {mappingResult.field_mappings && mappingResult.field_mappings.length > 0 ? (
                        <div className="text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-gray-700 dark:text-pure-white/70">
                              Field Mappings: <span className="text-success">{mappingResult.field_mappings.length}</span>
                            </p>
                          </div>
                          <div className="space-y-2">
                            
                            {/* Display existing mappings */}
                            <div className="w-full">
                              {mappingResult.field_mappings.map((mapping: any, idx: number) => (
                                <div key={idx} className="text-xs bg-pure-black/30 p-3 rounded mb-2 hover:bg-pure-black/40 transition-colors">
                                  {editingMapping?.index === idx ? (
                                    <div className="space-y-2">
                                      <input
                                        type="text"
                                        value={editingMapping.mapping.source}
                                        onChange={(e) => setEditingMapping(prev => {
                                          if (!prev) return null;
                                          return {
                                            index: prev.index,
                                            mapping: { ...prev.mapping, source: e.target.value }
                                          };
                                        })}
                                        placeholder="Source field"
                                        className="w-full bg-white border border-pure-white/10 rounded px-2 py-1 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-totogi-purple"
                                      />
                                      <input
                                        type="text"
                                        value={editingMapping.mapping.target}
                                        onChange={(e) => setEditingMapping(prev => {
                                          if (!prev) return null;
                                          return {
                                            index: prev.index,
                                            mapping: { ...prev.mapping, target: e.target.value }
                                          };
                                        })}
                                        placeholder="Target field"
                                        className="w-full bg-white border border-pure-white/10 rounded px-2 py-1 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-totogi-purple"
                                      />
                                      <input
                                        type="text"
                                        value={editingMapping.mapping.transform || ''}
                                        onChange={(e) => setEditingMapping(prev => {
                                          if (!prev) return null;
                                          return {
                                            index: prev.index,
                                            mapping: { ...prev.mapping, transform: e.target.value }
                                          };
                                        })}
                                        placeholder="Transform expression (optional)"
                                        className="w-full bg-white border border-pure-white/10 rounded px-2 py-1 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-totogi-purple"
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={() => setEditingMapping(null)}
                                          className="text-pure-white/70 hover:text-pure-white px-2 py-1"
                                        >
                                          Close
                                        </button>
                                        <button
                                          onClick={handleSaveEdit}
                                          disabled={!editingMapping.mapping.source || !editingMapping.mapping.target}
                                          className="bg-success/20 text-success px-2 py-1 rounded hover:bg-success/30 transition-colors disabled:opacity-50"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-gray-800 dark:text-pure-white font-medium">
                                            {mapping.source}
                                          </span>
                                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-pure-white/10 text-gray-700 dark:text-pure-white/70">
                                            Source
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-gray-800 dark:text-pure-white font-medium">
                                            {mapping.target}
                                          </span>
                                          <span className="text-xs px-2 py-0.5 rounded bg-success/20 text-success">
                                            Target
                                          </span>
                                        </div>
                                        {mapping.transform && (
                                          <div className="mt-1 text-gray-600 dark:text-pure-white/50">
                                            Transform: {mapping.transform}
                                          </div>
                                        )}
                                        {mapping.endpoint_info && (
                                          <div className="mt-1 text-gray-600 dark:text-pure-white/50">
                                            From: {mapping.endpoint_info.method} {mapping.endpoint_info.path}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleEditMapping(idx, mapping)}
                                          className="text-gray-600 dark:text-pure-white/50 hover:text-gray-800 dark:hover:text-pure-white"
                                        >
                                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteMapping(idx)}
                                          className="text-error/50 hover:text-error"
                                        >
                                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-gray-700 dark:text-pure-white/70">
                              Field Mappings: <span className="text-success">{mappingResult.field_mappings?.length || 0}</span>
                            </p>
                          </div>
                          
                          
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm bg-pure-black/30 p-2 rounded">
                      <p className="text-sm text-gray-700 dark:text-pure-white/70">
                        Documentation properties will be displayed here after mapping.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* TMF Properties (Right Column) */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 dark:text-pure-white/70 mb-3">
                  TMF Properties
                  <span className="ml-2 text-xs text-gray-500 dark:text-pure-white/50">
                    (Click a field to use as target in mapping)
                  </span>
                </h5>
                
                {/* Parameters Section */}
                <div className="mb-4">
                  <h6 className="text-sm font-medium text-gray-700 dark:text-pure-white/70 mb-2">
                    Parameters
                  </h6>
                  <div className="space-y-2">
                    {endpoint.specification.fields.map((field: TMFField) => renderField(field))}
                  </div>
                </div>
                
                {/* Responses Section */}
                <div>
                  <h6 className="text-sm font-medium text-gray-700 dark:text-pure-white/70 mb-2">
                    Responses
                  </h6>
                  <div className="space-y-2">
                    {endpoint.path.includes('customer') ? (
                      // Hardcoded responses for Customer API
                      <>
                        <div className="bg-pure-black/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-success/20 text-success">
                              200
                            </span>
                            <span className="text-gray-800 dark:text-pure-white font-medium">
                              Success
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-pure-white/70 mt-1">
                            Schema: Customer
                          </p>
                        </div>
                        <div className="bg-pure-black/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-warning/20 text-warning">
                              400
                            </span>
                            <span className="text-gray-800 dark:text-pure-white font-medium">
                              Bad Request
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-pure-white/70 mt-1">
                            Schema: Error
                          </p>
                        </div>
                        <div className="bg-pure-black/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-warning/20 text-warning">
                              404
                            </span>
                            <span className="text-gray-800 dark:text-pure-white font-medium">
                              Not Found
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-pure-white/70 mt-1">
                            Schema: Error
                          </p>
                        </div>
                        <div className="bg-pure-black/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-error/20 text-error">
                              500
                            </span>
                            <span className="text-gray-800 dark:text-pure-white font-medium">
                              Internal Server Error
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-pure-white/70 mt-1">
                            Schema: Error
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm bg-pure-black/30 p-2 rounded">
                        <p className="text-sm text-gray-700 dark:text-pure-white/70">
                          No response information available.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <MappingProgressModal
        isOpen={showMappingModal}
        stages={mappingStages}
        onClose={handleModalClose}
      />

      <AIChatModal
        isOpen={showAIChat}
        onClose={() => setShowAIChat(false)}
        endpointId={endpoint.id}
        docId={docId}
        endpoint={endpoint}
      />
    </>
  );
};

const TMFEndpointList: React.FC<{ docId: string }> = ({ docId }) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [selectedApi, setSelectedApi] = useState<string>('TMF666_Account');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddingEndpoint, setIsAddingEndpoint] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState<NewEndpoint>({
    path: '',
    method: 'GET',
    description: ''
  });

  // Results state
  const [endpoints, setEndpoints] = useState<TMFEndpoint[]>([]);
  const [metadata, setMetadata] = useState<SearchMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableApis, setAvailableApis] = useState<Array<{ id: string; name: string }>>([]);
  
  const handleAddEndpoint = async () => {
    if (!newEndpoint.path) return;
    
    try {
      // Since we're using local TMF files, we'll just show a message
      toast.error('Adding endpoints is not supported when using local TMF files');
      setIsAddingEndpoint(false);
    } catch (error) {
      console.error('Error adding endpoint:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add endpoint';
      toast.error(errorMessage);
    }
  };

  // Fetch available TMF files when component mounts
  useEffect(() => {
    const fetchTMFFiles = async () => {
      try {
        const files = await tmfService.listTMFFiles();
        setAvailableApis(files);
      } catch (error) {
        console.error('Error fetching TMF files:', error);
        toast.error('Failed to fetch TMF files');
      }
    };

    fetchTMFFiles();
  }, []);

  // Fetch endpoints when search params change
  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await tmfService.searchEndpoints({
        query: debouncedQuery,
        docId: docId,
        tmfApi: selectedApi,
        method: selectedMethod,
        page: currentPage,
        limit: 10
      });

      setEndpoints(result.endpoints);
      setMetadata({
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        filters: result.filters
      });
    } catch (error) {
      console.error('Error fetching endpoints:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch endpoints');
      setEndpoints([]);
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, [debouncedQuery, selectedMethod, selectedApi, currentPage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <div className="space-y-6">
      {/* Header and Update button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search endpoints..."
            className="w-full bg-white border border-gray-300 rounded-lg py-2 pl-10 pr-4 
              text-gray-900 placeholder-gray-500 focus:outline-none focus:border-totogi-purple
              transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-4">
          <div className="relative min-w-[140px]">
            <select
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg py-2 px-4 pr-8
                text-gray-900 focus:outline-none focus:border-totogi-purple transition-colors [&>option]:text-gray-900"
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
            >
              <option value="" className="text-gray-900">All Methods</option>
              {metadata?.filters.methods.map((method) => (
                <option key={method} value={method} className="text-gray-900">
                  {method}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative min-w-[200px]">
            <select
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg py-2 px-4 pr-8
                text-gray-900 focus:outline-none focus:border-totogi-purple transition-colors [&>option]:text-gray-900"
              value={selectedApi}
              onChange={(e) => {
                setSelectedApi(e.target.value);
                setCurrentPage(1); // Reset to first page when changing filter
              }}
            >
              {availableApis.map((api) => (
                <option key={api.id} value={api.id} className="text-gray-900">
                  {api.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 text-error bg-error/10 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Results */}
      {!loading && endpoints.length > 0 && (
        <div className="space-y-4">
          {endpoints.map((endpoint) => (
            <EndpointCard key={endpoint.id} endpoint={endpoint} docId={docId} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && endpoints.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-700 dark:text-pure-white/70">No endpoints found</p>
        </div>
      )}

      {/* Pagination */}
      {metadata && metadata.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-pure-black/20 border border-gray-300 dark:border-pure-white/10 text-gray-800 dark:text-pure-white
              hover:border-totogi-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-700 dark:text-pure-white/70">
            Page {currentPage} of {metadata.totalPages}
          </span>
          <button
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-pure-black/20 border border-gray-300 dark:border-pure-white/10 text-gray-800 dark:text-pure-white
              hover:border-totogi-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={currentPage === metadata.totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Add Endpoint Modal */}
      {isAddingEndpoint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-pure-black/90 rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-pure-white">Add New Endpoint</h3>
              <button
                onClick={() => setIsAddingEndpoint(false)}
                className="text-pure-white/50 hover:text-pure-white"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-pure-white/70 mb-1">
                  Path
                </label>
                <input
                  type="text"
                  value={newEndpoint.path}
                  onChange={(e) => setNewEndpoint(prev => ({ ...prev, path: e.target.value }))}
                  placeholder="/api/v1/example"
                  className="w-full bg-white dark:bg-pure-black/50 border border-gray-300 dark:border-pure-white/10 rounded-lg px-4 py-2 text-gray-800 dark:text-pure-white placeholder-gray-500 dark:placeholder-pure-white/30 focus:outline-none focus:border-totogi-purple"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-pure-white/70 mb-1">
                  Method
                </label>
                <select
                  value={newEndpoint.method}
                  onChange={(e) => setNewEndpoint(prev => ({ ...prev, method: e.target.value }))}
                  className="w-full bg-white dark:bg-pure-black/50 border border-gray-300 dark:border-pure-white/10 rounded-lg px-4 py-2 text-gray-800 dark:text-pure-white placeholder-gray-500 dark:placeholder-pure-white/30 focus:outline-none focus:border-totogi-purple"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-pure-white/70 mb-1">
                  Description
                </label>
                <textarea
                  value={newEndpoint.description}
                  onChange={(e) => setNewEndpoint(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter endpoint description..."
                  rows={3}
                  className="w-full bg-white dark:bg-pure-black/50 border border-gray-300 dark:border-pure-white/10 rounded-lg px-4 py-2 text-gray-800 dark:text-pure-white placeholder-gray-500 dark:placeholder-pure-white/30 focus:outline-none focus:border-totogi-purple"
                />
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={() => setIsAddingEndpoint(false)}
                  className="px-4 py-2 text-pure-white/70 hover:text-pure-white"
                >
                  Close
                </button>
                <button
                  onClick={handleAddEndpoint}
                  disabled={!newEndpoint.path}
                  className="bg-gradient-to-r from-[#10B981] to-[#059669] text-white px-6 py-2 rounded-lg
                    hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Mapping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TMFEndpointList; 