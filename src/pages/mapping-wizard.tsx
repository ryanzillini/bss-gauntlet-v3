import React, { useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { DocumentationMappingService } from '../mapping/services/DocumentationMappingService';
import { apiMappingService } from '../mapping/services/ApiMappingService';
import { tmfService } from '../mapping/services/TMFService';

const documentationService = new DocumentationMappingService(process.env.NEXT_PUBLIC_OPENAI_API_KEY);

const MappingWizard: React.FC = () => {
  const [step, setStep] = useState<'input' | 'review' | 'test'>('input');
  const [apiDoc, setApiDoc] = useState('');
  const [mappingSuggestions, setMappingSuggestions] = useState<any[]>([]);
  const [approvedMappings, setApprovedMappings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingTMF, setIsUpdatingTMF] = useState(false);

  const handleUpdateTMFEndpoints = async () => {
    setIsUpdatingTMF(true);
    try {
      await tmfService.updateEndpoints();
      alert('TMF endpoints updated successfully!');
    } catch (error) {
      console.error('Error updating TMF endpoints:', error);
      alert('Failed to update TMF endpoints. Please try again.');
    } finally {
      setIsUpdatingTMF(false);
    }
  };

  const handleAnalyze = async () => {
    console.log('[MappingWizard] Analyzing documentation');
    setIsLoading(true);
    try {
      // Parse the API documentation
      const parsedDoc = JSON.parse(apiDoc);
      
      // Create a TMFEndpoint object from the parsed doc
      const tmfEndpoint = {
        path: parsedDoc.path || '',
        method: parsedDoc.method || 'GET',
        specification: {
          fields: parsedDoc.fields || []
        }
      };
      
      // Generate a unique doc ID (you might want to get this from your backend)
      const docId = Date.now().toString();
      
      const suggestions = await documentationService.analyzeDocumentation(tmfEndpoint, docId);
      setMappingSuggestions(suggestions);
      setStep('review');
    } catch (error) {
      console.error('[MappingWizard] Error analyzing documentation:', error);
      alert('Error analyzing documentation. Please ensure the input is valid JSON and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveMapping = (mapping: any) => {
    console.log('[MappingWizard] Approving mapping:', mapping);
    setApprovedMappings([...approvedMappings, mapping]);
  };

  const handleGenerateConfig = () => {
    console.log('[MappingWizard] Generating configuration');
    const config = documentationService.generateMappingConfig(approvedMappings);
    // Update the ApiMappingService with the new configuration
    Object.assign(apiMappingService, { mappingConfigs: config });
    setStep('test');
  };

  return (
    <MainLayout>
      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">API Mapping Wizard</h1>
          <button
            onClick={handleUpdateTMFEndpoints}
            disabled={isUpdatingTMF}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            {isUpdatingTMF ? 'Updating TMF Endpoints...' : 'Update TMF Endpoints'}
          </button>
        </div>

        {step === 'input' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">API Documentation</h2>
            <div className="space-y-4">
              <textarea
                value={apiDoc}
                onChange={(e) => setApiDoc(e.target.value)}
                rows={15}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                placeholder="Paste your API documentation here (OpenAPI/Swagger, etc.)"
              />
              <button
                onClick={handleAnalyze}
                disabled={isLoading || !apiDoc.trim()}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? 'Analyzing...' : 'Analyze Documentation'}
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Review Mappings</h2>
            <div className="space-y-6">
              {mappingSuggestions.map((mapping, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="font-medium text-gray-700">Source Endpoint</h3>
                      <pre className="mt-2 bg-gray-50 p-2 rounded text-sm">
                        {JSON.stringify(mapping.sourceEndpoint, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-700">TMF Endpoint</h3>
                      <pre className="mt-2 bg-gray-50 p-2 rounded text-sm">
                        {JSON.stringify(mapping.tmfEndpoint, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <button
                    onClick={() => handleApproveMapping(mapping)}
                    disabled={approvedMappings.includes(mapping)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {approvedMappings.includes(mapping) ? 'Approved' : 'Approve Mapping'}
                  </button>
                </div>
              ))}
              {approvedMappings.length > 0 && (
                <button
                  onClick={handleGenerateConfig}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Generate Configuration & Continue to Testing
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'test' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Mappings</h2>
            <p className="mb-4">Your mappings have been configured! You can now test them using the API Test page.</p>
            <a
              href="/test-api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Open API Test Page
            </a>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default MappingWizard; 