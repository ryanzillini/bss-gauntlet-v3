import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '../../components/layout/MainLayout';
import { toast } from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { getSchemaMappings, getDatabaseConnections, addDatabaseConnection, testDatabaseConnection, extractDatabaseSchema } from '../../services/schema-service';

// Interface for schema mapping list items
interface SchemaMapping {
    id: string;
    name: string;
    source_database: string;
    target_database: string;
    created_at: string;
    updated_at: string;
}

// Interface for database connections
interface DatabaseConnection {
    id: string;
    name: string;
    connection_string: string;
    created_at: string;
    dialect?: string; // Add detected dialect
}

const SchemaPage: React.FC = () => {
    const router = useRouter();
    // Mapping states
    const [showMappingModal, setShowMappingModal] = useState(false);
    const [mappingName, setMappingName] = useState('');
    const [mappings, setMappings] = useState<SchemaMapping[]>([]);

    // Database states
    const [databases, setDatabases] = useState<DatabaseConnection[]>([]);
    const [showDatabaseModal, setShowDatabaseModal] = useState(false);
    const [databaseName, setDatabaseName] = useState('');
    const [connectionString, setConnectionString] = useState('');
    const [isAddingDatabase, setIsAddingDatabase] = useState(false);

    // Add new state variables for database connection
    const [connectionDialect, setConnectionDialect] = useState<string | null>(null);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // Add state for schema extraction
    const [isExtractingSchema, setIsExtractingSchema] = useState(false);

    // UI states
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load existing schema mappings and databases on component mount
    useEffect(() => {
        loadMappings();
        loadDatabases();
    }, []);

    // Load schema mappings from the API
    const loadMappings = async () => {
        try {
            setLoading(true);
            setError(null);

            const mappingsData = await getSchemaMappings();
            setMappings(mappingsData);
        } catch (err) {
            console.error('Error loading schema mappings:', err);
            setError('Failed to load schema mappings');
            toast.error('Failed to load schema mappings');
        } finally {
            setLoading(false);
        }
    };

    // Load database connections from the API
    const loadDatabases = async () => {
        try {
            const databasesData = await getDatabaseConnections();
            setDatabases(databasesData);
        } catch (err) {
            console.error('Error loading database connections:', err);
            toast.error('Failed to load database connections');
        }
    };

    // Format date for display
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Handle creating a new mapping
    const handleCreateMapping = () => {
        if (!mappingName.trim()) {
            toast.error('Please enter a mapping name');
            return;
        }

        // Close the modal
        setShowMappingModal(false);

        // Navigate to the schema mapping page with the name parameter
        router.push(`/schema/schema-mapping?name=${encodeURIComponent(mappingName)}`);
    };

    // Detect dialect from connection string
    const detectDialect = (connectionString: string) => {
        let dialect = null;

        if (connectionString.startsWith('postgres') || connectionString.startsWith('postgresql')) {
            dialect = 'PostgreSQL';
        } else if (connectionString.toLowerCase().includes('sqlserver') ||
            connectionString.toLowerCase().includes('mssql') ||
            connectionString.toLowerCase().includes('server=')) {
            dialect = 'SQL Server';
        } else if (connectionString.toLowerCase().includes('mysql')) {
            dialect = 'MySQL (not yet supported)';
        } else if (connectionString.trim()) {
            dialect = 'Unknown database type';
        }

        setConnectionDialect(dialect);
        return dialect;
    };

    // Test connection
    const testConnection = async () => {
        if (!connectionString.trim()) {
            toast.error('Please enter a connection string');
            return;
        }

        try {
            setIsTestingConnection(true);
            setConnectionTestResult(null);

            // Call the actual test connection API
            const result = await testDatabaseConnection(connectionString);

            if (result.success) {
                setConnectionDialect(result.dialect || null);
                setConnectionTestResult({
                    success: true,
                    message: result.message
                });
            } else {
                setConnectionTestResult({
                    success: false,
                    message: result.message
                });
            }
        } catch (error: any) {
            console.error('Error testing connection:', error);
            setConnectionTestResult({
                success: false,
                message: error.message || 'An unexpected error occurred'
            });
        } finally {
            setIsTestingConnection(false);
        }
    };

    // Test existing database connection
    const testExistingConnection = async (db: DatabaseConnection) => {
        try {
            toast.loading(`Testing connection to ${db.name}...`);

            // Call the actual test connection API
            const result = await testDatabaseConnection(db.connection_string);

            toast.dismiss();
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            toast.dismiss();
            toast.error(`Connection test failed: ${error.message || 'Unknown error'}`);
        }
    };

    // Update the handleAddDatabase function to not extract schema
    const handleAddDatabase = async () => {
        if (!databaseName.trim()) {
            toast.error('Please enter a database name');
            return;
        }

        if (!connectionString.trim()) {
            toast.error('Please enter a connection string');
            return;
        }

        // Ensure dialect is detected and supported
        const dialect = detectDialect(connectionString);
        if (dialect && (dialect.includes('not yet supported') || dialect === 'Unknown database type')) {
            toast.error(`${dialect}. Currently only PostgreSQL and SQL Server are supported.`);
            return;
        }

        try {
            setIsAddingDatabase(true);

            // Test connection before adding if not already tested
            if (!connectionTestResult || !connectionTestResult.success) {
                const shouldProceed = window.confirm(
                    'The connection has not been successfully tested. Do you want to proceed anyway?'
                );
                if (!shouldProceed) {
                    setIsAddingDatabase(false);
                    return;
                }
            }

            // Call the API to add the database (without schema extraction)
            const newDatabase = await addDatabaseConnection(databaseName, connectionString);

            // Add the new database to the list with the detected dialect
            setDatabases([...databases, {
                ...newDatabase,
                dialect: connectionDialect || undefined
            }]);

            // Clear form and close modal
            setDatabaseName('');
            setConnectionString('');
            setConnectionDialect(null);
            setConnectionTestResult(null);
            setShowDatabaseModal(false);

            toast.success('Database connection added successfully.');
        } catch (err: any) {
            console.error('Error adding database connection:', err);
            toast.error(`Failed to add database connection: ${err.message || 'Unknown error'}`);
        } finally {
            setIsAddingDatabase(false);
        }
    };

    // Update handleExtractSchema to include the database name
    const handleExtractSchema = async () => {
        if (!connectionString.trim()) {
            toast.error('Please enter a connection string');
            return;
        }

        if (!databaseName.trim()) {
            toast.error('Please enter a database name');
            return;
        }

        try {
            setIsExtractingSchema(true);

            // Test connection first if not already tested
            if (!connectionTestResult || !connectionTestResult.success) {
                const testResult = await testDatabaseConnection(connectionString);
                if (!testResult.success) {
                    toast.error(`Cannot extract schema: ${testResult.message}`);
                    setIsExtractingSchema(false);
                    return;
                }
            }

            // Call addDatabaseConnection first if we don't have a database ID
            const newDatabase = await addDatabaseConnection(databaseName, connectionString);
            const databaseId = newDatabase.id;

            // Extract schema
            await extractDatabaseSchema(databaseId, databaseName, connectionString);

            // Clear form and close modal
            setDatabaseName('');
            setConnectionString('');
            setConnectionDialect(null);
            setConnectionTestResult(null);
            setShowDatabaseModal(false);

            // Refresh database list
            await loadDatabases();

            toast.success('Database schema extracted successfully.');
        } catch (err: any) {
            console.error('Error extracting schema:', err);
            toast.error(`Failed to extract schema: ${err.message || 'Unknown error'}`);
        } finally {
            setIsExtractingSchema(false);
        }
    };

    // Update extractExistingDatabaseSchema to include the database name
    const extractExistingDatabaseSchema = async (db: DatabaseConnection) => {
        try {
            setIsExtractingSchema(true);

            // First test the connection
            const testResult = await testDatabaseConnection(db.connection_string);
            if (!testResult.success) {
                toast.error(`Cannot extract schema: ${testResult.message}`);
                return;
            }

            // Extract schema
            await extractDatabaseSchema(db.id, db.name, db.connection_string);

            // Refresh database list
            await loadDatabases();

            toast.success(`Schema extracted successfully for ${db.name}`);
        } catch (error: any) {
            console.error('Error extracting schema:', error);
            toast.error(`Failed to extract schema: ${error.message || 'Unknown error'}`);
        } finally {
            setIsExtractingSchema(false);
        }
    };

    return (
        <MainLayout>
            <div className="container mx-auto px-4 py-8">
                {/* Section: Schema Mappings */}
                <div className="mb-12">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold text-white">Schema Mappings</h1>
                        <button
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            onClick={() => setShowMappingModal(true)}
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            New Mapping
                        </button>
                    </div>

                    {/* Error display */}
                    {error && (
                        <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6">
                            <div className="flex items-center">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        </div>
                    )}

                    {/* Loading state */}
                    {loading && (
                        <div className="text-center py-10">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                            <p className="mt-4 text-gray-300">Loading schema mappings...</p>
                        </div>
                    )}

                    {/* Mappings list */}
                    {!loading && mappings.length === 0 && (
                        <div className="text-center py-10 bg-gray-800 border border-gray-700 rounded-md">
                            <p className="text-gray-400 mb-4">No schema mappings found</p>
                            <button
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                onClick={() => setShowMappingModal(true)}
                            >
                                Create Your First Mapping
                            </button>
                        </div>
                    )}

                    {!loading && mappings.length > 0 && (
                        <div className="bg-gray-800 border border-gray-700 rounded-md overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Source
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Target
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Created
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Updated
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {mappings.map((mapping) => (
                                        <tr key={mapping.id} className="hover:bg-gray-700">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white cursor-pointer" onClick={() => router.push(`/schema/schema-mapping?id=${mapping.id}`)}>
                                                {mapping.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                {mapping.source_database || "-"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                {mapping.target_database || "-"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                {formatDate(mapping.created_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                {formatDate(mapping.updated_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    className="text-blue-400 hover:text-blue-300 mr-3"
                                                    onClick={() => router.push(`/schema/schema-mapping?id=${mapping.id}`)}
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Section: Database Connections */}
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold text-white">Database Connections</h1>
                        <button
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                            onClick={() => setShowDatabaseModal(true)}
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            Add Database
                        </button>
                    </div>

                    {/* Database list */}
                    {databases.length === 0 ? (
                        <div className="text-center py-10 bg-gray-800 border border-gray-700 rounded-md">
                            <p className="text-gray-400 mb-4">No database connections found</p>
                            <button
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                                onClick={() => setShowDatabaseModal(true)}
                            >
                                Add Your First Database
                            </button>
                        </div>
                    ) : (
                        <div className="bg-gray-800 border border-gray-700 rounded-md overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Connection String
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Type
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Created
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {databases.map((db) => (
                                        <tr key={db.id} className="hover:bg-gray-700">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                                {db.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono">
                                                {/* Show only part of the connection string for security */}
                                                {db.connection_string.substring(0, 25)}...
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                {db.dialect || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                {formatDate(db.created_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end">
                                                <button
                                                    className="text-blue-400 hover:text-blue-300 mr-3"
                                                    onClick={() => testExistingConnection(db)}
                                                    disabled={isExtractingSchema}
                                                >
                                                    Test Connection
                                                </button>
                                                <button
                                                    className="text-indigo-400 hover:text-indigo-300"
                                                    onClick={() => extractExistingDatabaseSchema(db)}
                                                    disabled={isExtractingSchema}
                                                >
                                                    {isExtractingSchema ? 'Extracting...' : 'Extract Schema'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Create Mapping Modal */}
                {showMappingModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 w-full max-w-md">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-white">
                                    Create New Schema Mapping
                                </h3>
                                <button
                                    className="text-gray-400 hover:text-white"
                                    onClick={() => setShowMappingModal(false)}
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="mb-4">
                                <label htmlFor="mapping-name" className="block text-sm font-medium text-gray-300 mb-2">
                                    Mapping Name
                                </label>
                                <input
                                    type="text"
                                    id="mapping-name"
                                    className="w-full p-2 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
                                    placeholder="Enter mapping name"
                                    value={mappingName}
                                    onChange={(e) => setMappingName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-end mt-6">
                                <button
                                    className="mr-3 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                                    onClick={() => setShowMappingModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                    onClick={handleCreateMapping}
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Database Modal */}
                {showDatabaseModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 w-full max-w-md">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-white">
                                    Add Database Connection
                                </h3>
                                <button
                                    className="text-gray-400 hover:text-white"
                                    onClick={() => setShowDatabaseModal(false)}
                                    disabled={isAddingDatabase || isTestingConnection || isExtractingSchema}
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="mb-4">
                                <label htmlFor="db-name" className="block text-sm font-medium text-gray-300 mb-2">
                                    Database Name
                                </label>
                                <input
                                    type="text"
                                    id="db-name"
                                    className="w-full p-2 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-700 text-white"
                                    placeholder="e.g., Production Customer Database"
                                    value={databaseName}
                                    onChange={(e) => setDatabaseName(e.target.value)}
                                    disabled={isAddingDatabase || isTestingConnection || isExtractingSchema}
                                    autoFocus
                                />
                            </div>

                            <div className="mb-4">
                                <label htmlFor="connection-string" className="block text-sm font-medium text-gray-300 mb-2">
                                    Connection String
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        id="connection-string"
                                        className="w-full p-2 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-700 text-white font-mono"
                                        placeholder="postgresql://user:password@localhost:5432/dbname or mssql://user:password@localhost:1433/dbname"
                                        value={connectionString}
                                        onChange={(e) => {
                                            setConnectionString(e.target.value);
                                            detectDialect(e.target.value);
                                            setConnectionTestResult(null);
                                        }}
                                        disabled={isAddingDatabase || isTestingConnection || isExtractingSchema}
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-400">
                                    Format: postgresql://username:password@hostname:port/database or mssql://username:password@hostname:port/database
                                </p>
                            </div>

                            {/* Show detected database type */}
                            {connectionDialect && (
                                <div className={`mt-2 text-sm ${connectionDialect.includes('not yet supported') || connectionDialect === 'Unknown database type'
                                    ? 'text-yellow-400'
                                    : 'text-green-400'
                                    }`}>
                                    Detected: {connectionDialect}
                                </div>
                            )}

                            {/* Update the buttons in the modal */}
                            <div className="mt-6 flex justify-end space-x-3">
                                <button
                                    onClick={testConnection}
                                    disabled={isTestingConnection || isAddingDatabase || isExtractingSchema || !connectionString.trim()}
                                    className={`px-3 py-1 text-sm rounded focus:outline-none ${isTestingConnection ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                                        } transition-colors flex items-center`}
                                >
                                    {isTestingConnection && (
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {isTestingConnection ? 'Testing...' : 'Test Connection'}
                                </button>

                                <button
                                    onClick={handleAddDatabase}
                                    disabled={isAddingDatabase || isTestingConnection || isExtractingSchema || !databaseName.trim() || !connectionString.trim()}
                                    className={`px-3 py-1 text-sm rounded focus:outline-none ${isAddingDatabase ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                                        } transition-colors flex items-center`}
                                >
                                    {isAddingDatabase && (
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {isAddingDatabase ? 'Adding...' : 'Add Connection'}
                                </button>

                                <button
                                    onClick={handleExtractSchema}
                                    disabled={isExtractingSchema || isTestingConnection || isAddingDatabase || !databaseName.trim() || !connectionString.trim()}
                                    className={`px-3 py-1 text-sm rounded focus:outline-none ${isExtractingSchema ? 'bg-gray-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                                        } transition-colors flex items-center`}
                                >
                                    {isExtractingSchema && (
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {isExtractingSchema ? 'Extracting...' : 'Extract Schema'}
                                </button>
                            </div>

                            {/* Test connection result */}
                            {connectionTestResult && (
                                <div className={`mt-2 p-2 text-sm rounded ${connectionTestResult.success
                                    ? 'bg-green-900/30 border border-green-800 text-green-400'
                                    : 'bg-red-900/30 border border-red-800 text-red-400'
                                    }`}>
                                    {connectionTestResult.message}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default SchemaPage; 