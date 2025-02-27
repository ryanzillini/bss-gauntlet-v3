import React from 'react';
import { X, ChevronDown, Plus } from 'lucide-react';
import { Column } from '../models';
import { CondensedMapping } from '../types';

interface ColumnMappingProps {
    mappingId: string;
    column: Column;
    tableName: string;
    sourceTables: { dbId: string; table: { name: string; columns: Column[] } }[];
    mapping?: CondensedMapping;
    onAddSource: (targetTable: string, targetColumn: string, sourceTable: string, sourceColumn: string, sourceDatabaseId: string) => void;
    onRemoveSource: (mappingId: string, sourceId: string) => void;
    onUpdateTransformation: (mappingId: string, transformation: string) => void;
    expandedTransforms: Set<string>;
    toggleTransformSection: (mappingId: string) => void;
    selectedSourceTable: { dbId: string; tableName: string } | null;
    onSelectSourceTable: (value: string) => void;
    getColumnsForTable: (dbId: string, tableName: string) => Column[];
    onInsertSourceReference: (mappingId: string, table: string, column: string) => void;
    onInsertTransformationTemplate: (mappingId: string, templateType: string) => void;
    validationErrors: { [key: string]: string };
    databaseList: any[];
}

const ColumnMapping: React.FC<ColumnMappingProps> = ({
    mappingId,
    column,
    tableName,
    sourceTables,
    mapping,
    onAddSource,
    onRemoveSource,
    onUpdateTransformation,
    expandedTransforms,
    toggleTransformSection,
    selectedSourceTable,
    onSelectSourceTable,
    getColumnsForTable,
    onInsertSourceReference,
    onInsertTransformationTemplate,
    validationErrors,
    databaseList,
}) => {
    return (
        <div className="bg-gray-700 border border-gray-600 rounded-md p-3" >
            <div className="flex justify-between items-center mb-2" >
                <div className="flex items-center" >
                    <span className="font-medium text-white" > {column.name} </span>
                    < span className="ml-2 text-xs text-gray-300" > {column.dataType} </span>
                    < span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${mapping && mapping.sources.length > 0
                        ? 'bg-green-900 text-green-300'
                        : 'bg-red-900 text-red-300'
                        }`
                    }>
                        {mapping && mapping.sources.length > 0 ? 'Mapped' : 'Unmapped'}
                    </span>
                </div>

                < div className="flex space-x-2" >
                    <div className="relative" >
                        <select
                            className="text-sm border border-gray-600 rounded p-1 bg-gray-600 text-white pr-8"
                            value={selectedSourceTable ? `${selectedSourceTable.dbId}|${selectedSourceTable.tableName}` : ""}
                            onChange={(e) => onSelectSourceTable(e.target.value)}
                        >
                            <option value="" > Select table...</option>
                            {
                                sourceTables.map(({ dbId, table }) => (
                                    <option key={`${dbId}|${table.name}`} value={`${dbId}|${table.name}`}>
                                        {databaseList.find(db => db.id === dbId)?.name} - {table.name}
                                    </option>
                                ))}
                        </select>
                        < div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" >
                            <ChevronDown className="h-4 w-4 text-gray-300" />
                        </div>
                    </div>

                    < div className="relative" >
                        <select
                            className="text-sm border border-gray-600 rounded p-1 bg-gray-600 text-white pr-8"
                            value=""
                            disabled={!selectedSourceTable}
                            onChange={(e) => {
                                if (e.target.value && selectedSourceTable) {
                                    onAddSource(tableName, column.name, selectedSourceTable.tableName, e.target.value, selectedSourceTable.dbId);
                                    e.target.value = "";
                                }
                            }}
                        >
                            <option value="" > Select column...</option>
                            {
                                selectedSourceTable &&
                                getColumnsForTable(selectedSourceTable.dbId, selectedSourceTable.tableName).map(col => (
                                    <option key={col.name} value={col.name} >
                                        {col.name}
                                    </option>
                                ))
                            }
                        </select>
                        < div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" >
                            <ChevronDown className="h-4 w-4 text-gray-300" />
                        </div>
                    </div>
                </div>
            </div>

            {
                mapping && mapping.sources.length > 0 && (
                    <div className="pl-4 space-y-2 mt-3 pt-3 border-t border-gray-600" >
                        <h4 className="text-sm font-medium text-gray-300 mb-2" > Mapped Sources: </h4>
                        {
                            mapping.sources.map(source => (
                                <div key={source.id} className="flex justify-between items-center bg-gray-600 rounded p-2" >
                                    <span className="text-sm text-white" >
                                        {databaseList.find(db => db.id === source.databaseId)?.name} - {source.table}.{source.column}
                                    </span>
                                    < button
                                        onClick={() => onRemoveSource(mappingId, source.id)}
                                        className="text-red-300 hover:text-red-100"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))
                        }

                        {
                            mapping.sources.length === 1 && !expandedTransforms.has(mappingId) && (
                                <button
                                    onClick={() => toggleTransformSection(mappingId)}
                                    className="mt-2 text-sm text-blue-400 hover:text-blue-300 flex items-center"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add transformation(optional)
                                </button>
                            )
                        }

                        {
                            (mapping.sources.length > 1 || expandedTransforms.has(mappingId)) && (
                                <div className="mt-4" >
                                    <div className="flex justify-between items-center" >
                                        <label className="block text-sm font-medium text-gray-300 mb-1" >
                                            Transformation
                                            {mapping.sources.length > 1 && <span className="text-red-400 ml-1" >* </span>}
                                        </label>
                                        {
                                            mapping.sources.length === 1 && (
                                                <button
                                                    onClick={() => toggleTransformSection(mappingId)}
                                                    className="text-sm text-gray-400 hover:text-gray-300 flex items-center"
                                                >
                                                    <X className="h-3 w-3 mr-1" />
                                                    Hide
                                                </button>
                                            )
                                        }
                                    </div>

                                    < textarea
                                        id={`transform-${mappingId}`
                                        }
                                        value={mapping.transformation || ''}
                                        onChange={(e) => onUpdateTransformation(mappingId, e.target.value)}
                                        placeholder={
                                            mapping.sources.length > 1
                                                ? 'Required: JavaScript expression (e.g., sourceData.Table1.col1 + \' \' + sourceData.Table2.col2)'
                                                : 'Optional: JavaScript expression (e.g., sourceData.Table.column.toUpperCase())'
                                        }
                                        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white placeholder-gray-400 font-mono
                  ${(mapping.sources.length > 1 && !mapping.transformation) || validationErrors[mappingId] ? 'border-red-400' : 'border-gray-600'}`}
                                        rows={3}
                                        spellCheck="false"
                                    />

                                    <div className="flex flex-wrap gap-1 mt-2 mb-3" >
                                        {
                                            mapping.sources.map(source => (
                                                <button
                                                    key={source.id}
                                                    onClick={() => onInsertSourceReference(mappingId, source.table, source.column)}
                                                    className="inline-flex items-center px-2 py-1 text-xs bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
                                                >
                                                    + {source.table}.{source.column}
                                                </button>
                                            ))}
                                    </div>

                                    < div className="mb-3" >
                                        <p className="text-xs text-gray-400 mb-1" > Example transformations: </p>
                                        < div className="flex flex-wrap gap-1" >
                                            {
                                                ['uppercase', 'lowercase', 'concat', 'conditional', 'substring', 'default'].map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => onInsertTransformationTemplate(mappingId, type)}
                                                        className="inline-flex items-center px-2 py-1 text-xs bg-indigo-800 text-gray-200 rounded hover:bg-indigo-700"
                                                    >
                                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>

                                    {
                                        mapping.sources.length > 1 && !mapping.transformation && (
                                            <p className="text-sm text-red-400 mt-1" > Transformation is required for multiple source columns </p>
                                        )}

                                    <div className="mt-2 text-xs text-gray-400" >
                                        <p>Use JavaScript expressions to transform your data: </p>
                                        < ul className="list-disc pl-5 mt-1" >
                                            <li>Source columns are available as <code className="bg-gray-600 px-1 rounded">sourceData.TableName.ColumnName</ code > </li>
                                            < li > Use an expression that evaluates to the desired output value </li>
                                            < li > Example: <code className="bg-gray-600 px-1 rounded" > sourceData.Users.firstName + & quot; & quot; + sourceData.Users.lastName </code></li >
                                            <li>Supports JS operators and methods </li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                    </div>
                )}
        </div>
    );
};

export default ColumnMapping; 