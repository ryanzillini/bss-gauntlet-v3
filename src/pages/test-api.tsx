import React, { useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { apiMappingService } from '../mapping/services/ApiMappingService';

const TestAPI: React.FC = () => {
  const [tmfEndpoint, setTmfEndpoint] = useState('/accountManagement/v5/partyAccount/{id}');
  const [tmfMethod, setTmfMethod] = useState('GET');
  const [tmfParams, setTmfParams] = useState('{"id": "123"}');
  const [tmfBody, setTmfBody] = useState('{}');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTest = async () => {
    console.log('[TestAPI] Starting API test');
    setIsLoading(true);
    try {
      // Parse parameters and body
      const params = JSON.parse(tmfParams);
      const body = JSON.parse(tmfBody);

      console.log('[TestAPI] TMF Request:', {
        method: tmfMethod,
        endpoint: tmfEndpoint,
        params,
        body
      });

      // Execute the mapped request using the ApiMappingService
      const mappedResponse = await apiMappingService.executeMapping(
        tmfMethod,
        tmfEndpoint,
        params,
        body
      );
      
      console.log('[TestAPI] Mapped response:', mappedResponse);
      setResult(mappedResponse);
    } catch (error) {
      console.error('[TestAPI] Error:', error);
      setResult({ error: 'Failed to execute request' });
    } finally {
      setIsLoading(false);
    }
  };

  const executeMappedRequest = async (method: string, endpoint: string, params: any, body: any) => {
    // This is where we'll implement the actual mapping logic
    // For now, let's simulate a Totogi response
    const totogiResponse = {
      id: params.id,
      msisdn: "1234567890",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Transform to TMF format
    return {
      id: totogiResponse.id,
      href: `/accountManagement/v5/partyAccount/${totogiResponse.id}`,
      accountType: "individual",
      description: "Subscriber Account",
      lastModified: totogiResponse.updated_at,
      name: `Account ${totogiResponse.msisdn}`,
      state: totogiResponse.status,
      "@type": "PartyAccount",
      "@baseType": "Resource",
      "@schemaLocation": "https://tmforum.org/schemas/v5/PartyAccount.schema.json"
    };
  };

  return (
    <MainLayout>
      <div className="px-4 py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Test TMF API Mapping</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request Panel */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">TMF API Request</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endpoint
                </label>
                <input
                  type="text"
                  value={tmfEndpoint}
                  onChange={(e) => setTmfEndpoint(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Method
                </label>
                <select
                  value={tmfMethod}
                  onChange={(e) => setTmfMethod(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parameters (JSON)
                </label>
                <textarea
                  value={tmfParams}
                  onChange={(e) => setTmfParams(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Body (JSON)
                </label>
                <textarea
                  value={tmfBody}
                  onChange={(e) => setTmfBody(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                />
              </div>

              <button
                onClick={handleTest}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? 'Testing...' : 'Test Request'}
              </button>
            </div>
          </div>

          {/* Response Panel */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">TMF API Response</h2>
            <pre className="bg-gray-50 p-4 rounded-md h-[600px] overflow-auto font-mono text-sm">
              {result ? JSON.stringify(result, null, 2) : 'No response yet...'}
            </pre>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default TestAPI; 