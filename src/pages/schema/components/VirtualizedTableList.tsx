import React, { useRef, useCallback } from 'react';
import { VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Table } from '../models';
import { MappingStats } from '../types';
import TableMapping from './TableMapping';
import { CondensedMapping } from '../types';

interface VirtualizedTableListProps {
    tables: Table[];
    sourceTables: { dbId: string; table: Table }[];
    mappings: CondensedMapping[];
    onAddSource: (targetTable: string, targetColumn: string, sourceTable: string, sourceColumn: string, sourceDatabaseId: string) => void;
    onRemoveSource: (mappingId: string, sourceId: string) => void;
    onUpdateTransformation: (mappingId: string, transformation: string) => void;
    expandedTransforms: Set<string>;
    toggleTransformSection: (mappingId: string) => void;
    selectedSourceTables: { [mappingId: string]: { dbId: string; tableName: string } | null };
    setSelectedSourceTables: React.Dispatch<React.SetStateAction<{ [mappingId: string]: { dbId: string; tableName: string } | null }>>;
    getColumnsForTable: (dbId: string, tableName: string) => any[];
    tableStats: Map<string, MappingStats>;
    collapsedTables: Set<string>;
    onToggleCollapse: (tableName: string) => void;
    onRemoveTable: (tableName: string) => void;
    onInsertSourceReference: (mappingId: string, table: string, column: string) => void;
    onInsertTransformationTemplate: (mappingId: string, templateType: string) => void;
    validationErrors: { [key: string]: string };
    databaseList: any[];
}

const VirtualizedTableList: React.FC<VirtualizedTableListProps> = ({
    tables,
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
    collapsedTables,
    onToggleCollapse,
    onRemoveTable,
    onInsertSourceReference,
    onInsertTransformationTemplate,
    validationErrors,
    databaseList,
}) => {
    // Create a ref for the virtualized list
    const listRef = useRef<VariableSizeList>(null);

    // Calculate the height of each row based on whether it's collapsed or not
    const getRowHeight = useCallback((index: number) => {
        const table = tables[index];
        const isCollapsed = collapsedTables.has(table.name);
        // Base height for header
        const baseHeight = 100;

        if (isCollapsed) {
            return baseHeight + 16; // Add margin
        }

        // Calculate expanded height based on number of columns
        const columnsCount = table.columns.length;
        const columnHeight = 80; // Approximate height per column
        return baseHeight + (columnsCount * columnHeight) + 16; // Add margin
    }, [tables, collapsedTables]);

    // Reset cached sizes when a table is collapsed/expanded
    const handleToggleCollapse = useCallback((tableName: string) => {
        onToggleCollapse(tableName);
        // Reset size for all items since the layout might shift
        if (listRef.current) {
            listRef.current.resetAfterIndex(0);
        }
    }, [onToggleCollapse]);

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const table = tables[index];
        return (
            <div style={{
                ...style,
                paddingBottom: '16px' // Add padding to create space between items
            }}>
                <TableMapping
                    key={table.name}
                    table={table}
                    sourceTables={sourceTables}
                    mappings={mappings}
                    onAddSource={onAddSource}
                    onRemoveSource={onRemoveSource}
                    onUpdateTransformation={onUpdateTransformation}
                    expandedTransforms={expandedTransforms}
                    toggleTransformSection={toggleTransformSection}
                    selectedSourceTables={selectedSourceTables}
                    setSelectedSourceTables={setSelectedSourceTables}
                    getColumnsForTable={getColumnsForTable}
                    tableStats={tableStats.get(table.name) || { totalColumns: 0, mappedColumns: 0, percentMapped: 0 }}
                    isCollapsed={collapsedTables.has(table.name)}
                    onToggleCollapse={() => handleToggleCollapse(table.name)}
                    onRemoveTable={onRemoveTable}
                    onInsertSourceReference={onInsertSourceReference}
                    onInsertTransformationTemplate={onInsertTransformationTemplate}
                    validationErrors={validationErrors}
                    databaseList={databaseList}
                />
            </div>
        );
    };

    return (
        <div style={{ height: 'calc(100vh - 300px)', width: '100%' }}>
            <AutoSizer>
                {({ height, width }) => (
                    <VariableSizeList
                        ref={listRef}
                        height={height}
                        width={width}
                        itemCount={tables.length}
                        itemSize={getRowHeight}
                        overscanCount={2}
                    >
                        {Row}
                    </VariableSizeList>
                )}
            </AutoSizer>
        </div>
    );
};

export default VirtualizedTableList; 