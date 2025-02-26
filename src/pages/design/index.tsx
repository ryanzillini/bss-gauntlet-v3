import { useState } from 'react';
import { OntologyMapping } from '@/types/mapping';

export default function DesignPage() {
  const [sourceSchema, setSourceSchema] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [mapping, setMapping] = useState<OntologyMapping | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/design/suggest-mapping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceSchema, documentation }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate mapping');
      }

      const result = await response.json();
      setMapping(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">BSS Magic - Design Time</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-2">
            Source API Schema (JSON):
            <textarea
              value={sourceSchema}
              onChange={(e) => setSourceSchema(e.target.value)}
              className="w-full h-48 p-2 border rounded"
              required
            />
          </label>
        </div>

        <div>
          <label className="block mb-2">
            API Documentation:
            <textarea
              value={documentation}
              onChange={(e) => setDocumentation(e.target.value)}
              className="w-full h-48 p-2 border rounded"
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Mapping'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {mapping && (
        <div className="mt-4">
          <h2 className="text-xl font-bold mb-2">Generated Mapping:</h2>
          <pre className="p-4 bg-gray-100 rounded overflow-auto">
            {JSON.stringify(mapping, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 