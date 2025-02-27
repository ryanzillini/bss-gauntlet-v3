import React from 'react';
//import { XMarkIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { Table, Column } from '../models';
import { CondensedMapping, MappingStats } from '../types';
import ColumnMapping from './ColumnMapping';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { X } from 'lucide-react';

interface TableMappingProps {
    table: Table;
    sourceTables: { dbId: string; table: Table }[];
    mappings: CondensedMapping[];
    onAddSource: (targetTable: string, targetColumn: string, sourceTable: string, sourceColumn: string, sourceDatabaseId: string) => void;
    onRemoveSource: (mappingId: string, sourceId: string) => void;
    onUpdateTransformation: (mappingId: string, transformation: string) => void;
    expandedTransforms: Set<string>;
    toggleTransformSection: (mappingId: string) => void;
    selectedSourceTables: { [mappingId: string]: { dbId: string; tableName: string } | null };
    setSelectedSourceTables: React.Dispatch<React.SetStateAction<{ [mappingId: string]: { dbId: string; tableName: string } | null }>>;
    getColumnsForTable: (dbId: string, tableName: string) => Column[];
    tableStats: MappingStats;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onRemoveTable: (tableName: string) => void;
    onInsertSourceReference: (mappingId: string, table: string, column: string) => void;
    onInsertTransformationTemplate: (mappingId: string, templateType: string) => void;
    validationErrors: { [key: string]: string };
    databaseList: any[];
}

const TableMapping: React.FC<TableMappingProps> = ({
    table,
    sourceTables,
    mappings,
    onAddSource,
    onRemoveSource,
    onUpdateTransformation,
    expandedTransforms,
    toggleTransformSection,
    selectedSourceTables,
    setSelectedSourceTables,
    getColumnsForTable,
    tableStats,
    isCollapsed,
    onToggleCollapse,
    onRemoveTable,
    onInsertSourceReference,
    onInsertTransformationTemplate,
    validationErrors,
    databaseList,
}) => {
    const tableMappings = mappings.filter(m => m.targetTable === table.name);

    return (
        <div className="border border-gray-700 rounded-md bg-gray-800 shadow-md overflow-hidden" >
            <div
                className="bg-gray-700 p-4 flex flex-col cursor-pointer hover:bg-gray-600 transition-colors"
                onClick={onToggleCollapse}
            >
                <div className="flex justify-between items-center" >
                    <div className="flex items-center" >
                        <h3 className="text-lg font-semibold text-white" > {table.name} </h3>
                        < span className="ml-2 text-gray-400 text-sm" > ({table.columns.length} columns)</span>
                        < button
                            className="ml-2 text-gray-300 hover:text-white focus:outline-none bg-gray-600 p-1 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleCollapse();
                            }}
                            title={isCollapsed ? "Expand table" : "Collapse table"}
                        >
                            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </button>
                    </div>
                    < button
                        className="text-gray-300 hover:text-white"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemoveTable(table.name);
                        }}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                < div className="mt-2 flex items-center" >
                    <div className="w-full bg-gray-600 rounded-full h-2.5" >
                        <div
                            className={`h-2.5 rounded-full ${tableStats.percentMapped === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${tableStats.percentMapped}%` }}
                        > </div>
                    </div>
                    < span className="ml-2 text-sm text-gray-300" >
                        {tableStats.percentMapped} % mapped({tableStats.mappedColumns} / {tableStats.totalColumns} columns)
                    </span>
                </div>
            </div>

            {
                !isCollapsed && (
                    <div className="p-4 space-y-4" >
                        {
                            table.columns.map(column => {
                                const mappingId = `${table.name}-${column.name}`;
                                const columnMapping = tableMappings.find(m => m.id === mappingId);

                                return (
                                    <ColumnMapping
                                        key={column.name}
                                        mappingId={mappingId}
                                        column={column}
                                        tableName={table.name}
                                        sourceTables={sourceTables}
                                        mapping={columnMapping}
                                        onAddSource={onAddSource}
                                        onRemoveSource={onRemoveSource}
                                        onUpdateTransformation={onUpdateTransformation}
                                        expandedTransforms={expandedTransforms}
                                        toggleTransformSection={toggleTransformSection}
                                        selectedSourceTable={selectedSourceTables[mappingId] || null}
                                        onSelectSourceTable={(value) => {
                                            const [dbId, tableName] = value.split('|');
                                            setSelectedSourceTables(prev => ({
                                                ...prev,
                                                [mappingId]: value ? { dbId, tableName } : null
                                            }));
                                        }
                                        }
                                        getColumnsForTable={getColumnsForTable}
                                        onInsertSourceReference={onInsertSourceReference}
                                        onInsertTransformationTemplate={onInsertTransformationTemplate}
                                        validationErrors={validationErrors}
                                        databaseList={databaseList}
                                    />
                                );
                            })
                        }
                    </div>
                )}
        </div>
    );
};

export default TableMapping; 