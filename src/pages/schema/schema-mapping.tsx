import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import { tmfService } from '../../services/TMFService';
import { supabase } from '../../utils/supabase-client';
import { toast } from 'react-hot-toast';

interface DatabaseSchema {
  id: string;
  name: string;
  tables: DatabaseTable[];
  content: any;
  created_at: string;
}

interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
}

interface DatabaseColumn {
  name: string;
  type: string;
  description?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

interface TMFClass {
  id: string;
  name: string;
  description?: string;
  attributes: TMFAttribute[];
}

interface TMFAttribute {
  name: string;
  type: string;
  description?: string;
  isRequired?: boolean;
}

interface SchemaMapping {
  id?: string;
  databaseSchemaId: string;
  tmfClassId: string;
  mappings: ColumnMapping[];
  created_at?: string;
}

interface ColumnMapping {
  databaseTable: string;
  databaseColumn: string;
  tmfAttribute: string;
  transformationType?: 'direct' | 'custom';
  transformationRule?: string;
}

const SchemaMapping: React.FC = () => {
  // State for database schemas
  const [uploadedSchemas, setUploadedSchemas] = useState<DatabaseSchema[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('');
  const [schemaFile, setSchemaFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // State for TMF SID
  const [tmfClasses, setTmfClasses] = useState<TMFClass[]>([]);
  const [selectedTmfClassId, setSelectedTmfClassId] = useState<string>('');
  
  // State for mappings
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [savedMappings, setSavedMappings] = useState<SchemaMapping[]>([]);
  
  // Selected items for mapping
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedAttribute, setSelectedAttribute] = useState<string>('');

  // Load TMF classes and saved schemas on component mount
  useEffect(() => {
    fetchTMFClasses();
    fetchUploadedSchemas();
    fetchSavedMappings();
  }, []);

  // Fetch TMF classes
  const fetchTMFClasses = async () => {
    try {
      const tmfFiles = await tmfService.listTMFFiles();
      const processedClasses: TMFClass[] = [];
      
      for (const file of tmfFiles) {
        const tmfFile = await tmfService.loadTMFFile(file.id);
        
        tmfFile.endpoints.forEach(endpoint => {
          // Extract class information from endpoints
          if (endpoint.specification && endpoint.specification.fields) {
            const className = endpoint.path.split('/').pop() || endpoint.path;
            
            // Check if we already processed this class
            if (!processedClasses.find(c => c.name === className)) {
              processedClasses.push({
                id: endpoint.id || Math.random().toString(36).substring(2),
                name: className,
                attributes: endpoint.specification.fields.map(field => ({
                  name: field.name,
                  type: field.type,
                  description: field.description || '',
                  isRequired: field.required
                }))
              });
            }
          }
        });
      }
      
      setTmfClasses(processedClasses);
    } catch (error) {
      console.error('Error fetching TMF classes:', error);
      toast.error('Failed to fetch TMF classes');
    }
  };

  // Fetch uploaded schemas
  const fetchUploadedSchemas = async () => {
    try {
      const { data, error } = await supabase
        .from('database_schemas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        setUploadedSchemas(data);
      }
    } catch (error) {
      console.error('Error fetching schemas:', error);
      toast.error('Failed to fetch uploaded schemas');
    }
  };

  // Fetch saved mappings
  const fetchSavedMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('schema_mappings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        setSavedMappings(data);
      }
    } catch (error) {
      console.error('Error fetching mappings:', error);
      toast.error('Failed to fetch saved mappings');
    }
  };

  // Handle schema file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSchemaFile(e.target.files[0]);
    }
  };

  // Upload and process schema
  const uploadSchema = async () => {
    if (!schemaFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsUploading(true);

    try {
      // Read the file
      const fileReader = new FileReader();
      
      fileReader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const schemaData = JSON.parse(content);
          
          // Validate schema structure
          if (!schemaData.name || !Array.isArray(schemaData.tables)) {
            toast.error('Invalid schema format. Expected { name, tables[] }');
            setIsUploading(false);
            return;
          }
          
          // Save to Supabase
          const { data, error } = await supabase
            .from('database_schemas')
            .insert({
              name: schemaData.name,
              content: schemaData
            })
            .select()
            .single();
            
          if (error) throw error;
          
          toast.success('Schema uploaded successfully');
          setSchemaFile(null);
          
          // Update the list of schemas
          await fetchUploadedSchemas();
          
          // Reset file input if there's a form
          const fileInput = document.getElementById('schema-file-input') as HTMLInputElement;
          if (fileInput) {
            fileInput.value = '';
          }
        } catch (error) {
          console.error('Error processing schema file:', error);
          toast.error('Failed to process schema file');
        } finally {
          setIsUploading(false);
        }
      };
      
      fileReader.onerror = () => {
        toast.error('Error reading file');
        setIsUploading(false);
      };
      
      fileReader.readAsText(schemaFile);
    } catch (error) {
      console.error('Error uploading schema:', error);
      toast.error('Failed to upload schema');
      setIsUploading(false);
    }
  };

  // Get selected schema
  const getSelectedSchema = (): DatabaseSchema | undefined => {
    return uploadedSchemas.find(s => s.id === selectedSchemaId);
  };

  // Get selected TMF class
  const getSelectedTmfClass = (): TMFClass | undefined => {
    return tmfClasses.find(c => c.id === selectedTmfClassId);
  };

  // Add a new mapping
  const addMapping = () => {
    if (!selectedTable || !selectedColumn || !selectedAttribute) {
      toast.error('Please select a table column and TMF attribute to map');
      return;
    }

    const newMapping: ColumnMapping = {
      databaseTable: selectedTable,
      databaseColumn: selectedColumn,
      tmfAttribute: selectedAttribute,
      transformationType: 'direct'
    };

    setMappings([...mappings, newMapping]);
    
    // Reset selections
    setSelectedColumn('');
    setSelectedAttribute('');
  };

  // Remove a mapping
  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  // Save mappings
  const saveMappings = async () => {
    if (!selectedSchemaId || !selectedTmfClassId || mappings.length === 0) {
      toast.error('Please select a schema, TMF class, and create at least one mapping');
      return;
    }

    try {
      const mappingData: SchemaMapping = {
        databaseSchemaId: selectedSchemaId,
        tmfClassId: selectedTmfClassId,
        mappings: mappings
      };

      const { data, error } = await supabase
        .from('schema_mappings')
        .insert(mappingData)
        .select()
        .single();

      if (error) throw error;

      toast.success('Mappings saved successfully');
      
      // Update the list of saved mappings
      await fetchSavedMappings();
      
      // Reset form
      setMappings([]);
      setSelectedSchemaId('');
      setSelectedTmfClassId('');
      setSelectedTable('');
      setSelectedColumn('');
      setSelectedAttribute('');
    } catch (error) {
      console.error('Error saving mappings:', error);
      toast.error('Failed to save mappings');
    }
  };

  // Delete a saved mapping
  const deleteSavedMapping = async (mappingId: string) => {
    try {
      const { error } = await supabase
        .from('schema_mappings')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;

      toast.success('Mapping deleted successfully');
      
      // Update the list of saved mappings
      await fetchSavedMappings();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast.error('Failed to delete mapping');
    }
  };

  // Get tables from selected schema
  const getTables = (): DatabaseTable[] => {
    const schema = getSelectedSchema();
    return schema?.tables || [];
  };

  // Get columns from selected table
  const getColumns = (): DatabaseColumn[] => {
    const tables = getTables();
    const table = tables.find(t => t.name === selectedTable);
    return table?.columns || [];
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-pure-white mb-8">
          Database Schema to TMF SID Mapping
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Database Schema */}
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-pure-white mb-4">Database Schema</h2>
            
            {/* Schema Upload */}
            <div className="mb-6 p-4 border border-dashed border-gray-500 rounded-lg">
              <h3 className="text-lg font-medium text-pure-white mb-2">Upload Schema</h3>
              <div className="flex flex-col space-y-4">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="schema-file-input"
                />
                <label
                  htmlFor="schema-file-input"
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
                >
                  ⬆️ {schemaFile ? schemaFile.name : 'Select File'}
                </label>
                <button
                  onClick={uploadSchema}
                  disabled={!schemaFile || isUploading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Upload Schema'}
                </button>
              </div>
            </div>
            
            {/* Schema Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-pure-white mb-2">Select Schema</h3>
              <select
                value={selectedSchemaId}
                onChange={(e) => setSelectedSchemaId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-pure-white"
              >
                <option value="">-- Select a schema --</option>
                {uploadedSchemas.map(schema => (
                  <option key={schema.id} value={schema.id}>
                    {schema.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Table Selection */}
            {selectedSchemaId && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-pure-white mb-2">Select Table</h3>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setSelectedColumn('');
                  }}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-pure-white"
                >
                  <option value="">-- Select a table --</option>
                  {getTables().map(table => (
                    <option key={table.name} value={table.name}>
                      {table.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Column Selection */}
            {selectedTable && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-pure-white mb-2">Select Column</h3>
                <select
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-pure-white"
                >
                  <option value="">-- Select a column --</option>
                  {getColumns().map(column => (
                    <option key={column.name} value={column.name}>
                      {column.name} ({column.type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          {/* Right Column - TMF SID */}
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-pure-white mb-4">TMF SID</h2>
            
            {/* TMF Class Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-pure-white mb-2">Select TMF Class</h3>
              <select
                value={selectedTmfClassId}
                onChange={(e) => {
                  setSelectedTmfClassId(e.target.value);
                  setSelectedAttribute('');
                }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-pure-white"
              >
                <option value="">-- Select a TMF class --</option>
                {tmfClasses.map(tmfClass => (
                  <option key={tmfClass.id} value={tmfClass.id}>
                    {tmfClass.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* TMF Attribute Selection */}
            {selectedTmfClassId && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-pure-white mb-2">Select Attribute</h3>
                <select
                  value={selectedAttribute}
                  onChange={(e) => setSelectedAttribute(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-pure-white"
                >
                  <option value="">-- Select an attribute --</option>
                  {getSelectedTmfClass()?.attributes.map(attr => (
                    <option key={attr.name} value={attr.name}>
                      {attr.name} ({attr.type}) {attr.isRequired ? '*' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        
        {/* Mapping Controls */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={addMapping}
            disabled={!selectedColumn || !selectedAttribute}
            className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          >
            ➕ Add Mapping
          </button>
        </div>

        {/* Mappings Table */}
        {mappings.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-pure-white mb-4">Current Mappings</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Database Table</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Database Column</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Mapping</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">TMF Attribute</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {mappings.map((mapping, index) => (
                    <tr key={index} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{mapping.databaseTable}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{mapping.databaseColumn}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="mx-auto text-gray-300">➡️</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{mapping.tmfAttribute}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                        <button
                          onClick={() => removeMapping(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ❌
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={saveMappings}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Save Mappings
              </button>
            </div>
          </div>
        )}

        {/* Saved Mappings */}
        {savedMappings.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-pure-white mb-4">Saved Mappings</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Database Schema</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">TMF Class</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Mappings Count</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Created At</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {savedMappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {uploadedSchemas.find(s => s.id === mapping.databaseSchemaId)?.name || mapping.databaseSchemaId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {tmfClasses.find(c => c.id === mapping.tmfClassId)?.name || mapping.tmfClassId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-300">
                        {mapping.mappings.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-300">
                        {mapping.created_at ? new Date(mapping.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-300">
                        <button
                          onClick={() => deleteSavedMapping(mapping.id!)}
                          className="text-red-500 hover:text-red-700"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default SchemaMapping; 