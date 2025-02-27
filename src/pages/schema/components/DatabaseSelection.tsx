import React from 'react';
import { ChevronDown } from 'lucide-react';
import { MappingStats } from '../types';

interface DatabaseSelectionProps {
    databases: any[];
    targetDatabaseId: string | null;
    sourceDatabaseIds: string[];
    onTargetChange: (id: string) => void;
    onSourceChange: (id: string, selected: boolean) => void;
    validationErrors: { [key: string]: string };
    loading: boolean;
    targetDbStats: MappingStats;
    sourceDbStats: Map<string, MappingStats>;
}

const DatabaseSelection: React.FC<DatabaseSelectionProps> = ({
    databases,
    targetDatabaseId,
    sourceDatabaseIds,
    onTargetChange,
    onSourceChange,
    validationErrors,
    loading,
    targetDbStats,
    sourceDbStats,
}) => {
    return (
        <div className="mb-8 space-y-6" >
            {/* Target Database Selection */}
            < div >
                <h2 className="text-lg font-semibold mb-2 text-white" > Target Database </h2>
                < div className="relative w-full md:w-1/2" >
                    <select
                        className={
                            `w-full p-2 border rounded appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-800 text-white
              ${validationErrors['target'] ? 'border-red-400' : 'border-gray-700'}`
                        }
                        value={targetDatabaseId || ''
                        }
                        onChange={(e) => onTargetChange(e.target.value)}
                        disabled={loading}
                    >
                        <option value="" > Select a target database </option>
                        {
                            databases.map(db => (
                                <option key={db.id} value={db.id} >
                                    {db.name}
                                </option>
                            ))
                        }
                    </select>
                    < div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" >
                        <ChevronDown className="h-5 w-5 text-gray-300" />
                    </div>
                    {
                        validationErrors['target'] && (
                            <p className="text-red-400 text-sm mt-1" > {validationErrors['target']} </p>
                        )
                    }
                    {
                        targetDatabaseId && !loading && (
                            <div className="mt-2 flex items-center" >
                                <div className="w-full bg-gray-700 rounded-full h-2.5" >
                                    <div
                                        className="bg-blue-500 h-2.5 rounded-full"
                                        style={{ width: `${targetDbStats.percentMapped}%` }
                                        }
                                    > </div>
                                </div>
                                < span className="ml-2 text-sm text-gray-300" >
                                    {targetDbStats.percentMapped} % mapped({targetDbStats.mappedColumns} / {targetDbStats.totalColumns} columns)
                                </span>
                            </div>
                        )}
                </div>
            </div>

            {/* Source Databases Selection */}
            <div>
                <h2 className="text-lg font-semibold mb-2 text-white" > Source Databases </h2>
                < div className="space-y-2" >
                    {
                        databases.map(db => {
                            const dbStats = sourceDbStats.get(db.id);
                            return (
                                <div key={db.id} className="flex flex-col" >
                                    <div className="flex items-center" >
                                        <input
                                            type="checkbox"
                                            id={`source-${db.id}`
                                            }
                                            checked={sourceDatabaseIds.includes(db.id)}
                                            onChange={(e) => onSourceChange(db.id, e.target.checked)}
                                            disabled={loading || db.id === targetDatabaseId}
                                            className="mr-2 h-4 w-4 text-blue-600 border-gray-700 rounded focus:ring-blue-500 bg-gray-800"
                                        />
                                        <label
                                            htmlFor={`source-${db.id}`}
                                            className={`text-white ${db.id === targetDatabaseId ? 'text-gray-500' : ''}`}
                                        >
                                            {db.name}
                                            {db.id === targetDatabaseId && " (selected as target)"}
                                        </label>
                                    </div>
                                    {
                                        sourceDatabaseIds.includes(db.id) && dbStats && !loading && (
                                            <div className="ml-6 mt-1 mb-2 flex items-center" >
                                                <div className="w-full bg-gray-700 rounded-full h-2.5" >
                                                    <div
                                                        className="bg-green-500 h-2.5 rounded-full"
                                                        style={{ width: `${dbStats.percentMapped}%` }
                                                        }
                                                    > </div>
                                                </div>
                                                < span className="ml-2 text-sm text-gray-300" >
                                                    {dbStats.percentMapped} % used({dbStats.mappedColumns} / {dbStats.totalColumns} columns)
                                                </span>
                                            </div>
                                        )}
                                </div>
                            );
                        })}
                    {
                        validationErrors['source'] && (
                            <p className="text-red-400 text-sm mt-1" > {validationErrors['source']} </p>
                        )
                    }
                </div>
            </div>
        </div>
    );
};

export default DatabaseSelection; 