import React, { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import { toast } from 'react-hot-toast';
import { tmfService, TMFEndpoint } from '../../services/TMFService';
import { tmfContextService } from '../../services/TMFContextService';
import { MappingContext } from '../../types/TMFTypes';
import MappingProgressModal from '../MappingProgressModal';
import { flushSync } from 'react-dom';

// Temporary type definitions until we extract them
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

interface NewEndpoint {
  path: string;
  method: string;
  description: string;
}

// This is the component that will be the direct replacement for the current TMFEndpointList.tsx
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
        page: currentPage,
        limit: 10
      });

      setEndpoints(result.endpoints);
      setMetadata({
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        filters: {
          methods: ['GET', 'POST', 'PUT', 'DELETE'],
          apis: ['TMF666_Account', 'TMF620_ProductCatalog']
        }
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
      {/* This is a placeholder for the refactored component structure */}
      {/* During the refactoring process, we will migrate the functionality piece by piece */}
      {/* For now, this renders a basic version of the UI to ensure backward compatibility */}
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-pure-white">TMF API Endpoints</h2>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg py-2 px-4 text-gray-900 focus:outline-none focus:border-totogi-purple transition-colors"
          />
        </div>
        
        {/* Method and API filter selectors will go here */}
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

      {/* Results - will be replaced with EndpointCard components later */}
      {!loading && endpoints.length > 0 && (
        <div className="space-y-4">
          {endpoints.map((endpoint) => (
            <div 
              key={endpoint.id} 
              className="p-4 bg-pure-black/20 border border-pure-white/10 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span className={`
                  text-xs font-semibold px-2 py-1 rounded
                  ${endpoint.method === 'GET' ? 'bg-green-500/20 text-green-500' : ''}
                  ${endpoint.method === 'POST' ? 'bg-blue-500/20 text-blue-500' : ''}
                  ${endpoint.method === 'PUT' ? 'bg-amber-500/20 text-amber-500' : ''}
                  ${endpoint.method === 'DELETE' ? 'bg-red-500/20 text-red-500' : ''}
                  ${endpoint.method === 'PATCH' ? 'bg-purple-500/20 text-purple-500' : ''}
                `}>
                  {endpoint.method}
                </span>
                <span className="text-sm font-mono text-pure-white">{endpoint.path}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && endpoints.length === 0 && (
        <div className="text-center py-8">
          <p className="text-pure-white/70">No endpoints found</p>
        </div>
      )}

      {/* Pagination */}
      {metadata && metadata.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            className="px-4 py-2 rounded-lg bg-pure-black/20 border border-pure-white/10 text-pure-white
              hover:border-totogi-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </button>
          <span className="px-4 py-2 text-pure-white/70">
            Page {currentPage} of {metadata.totalPages}
          </span>
          <button
            className="px-4 py-2 rounded-lg bg-pure-black/20 border border-pure-white/10 text-pure-white
              hover:border-totogi-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={currentPage === metadata.totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Add Endpoint Modal - simplified version */}
      {isAddingEndpoint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-pure-black/90 rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-pure-white">Add New Endpoint</h3>
              <button
                onClick={() => setIsAddingEndpoint(false)}
                className="text-pure-white/50 hover:text-pure-white"
              >
                ✕
              </button>
            </div>
            {/* Form content will go here */}
            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={() => setIsAddingEndpoint(false)}
                className="px-4 py-2 text-pure-white/70 hover:text-pure-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEndpoint}
                disabled={!newEndpoint.path}
                className="bg-gradient-to-r from-[#10B981] to-[#059669] text-white px-6 py-2 rounded-lg
                  hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Endpoint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TMFEndpointList; 