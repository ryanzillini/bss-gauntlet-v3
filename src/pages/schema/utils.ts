import { Database, Table, Column } from './models';
import { MappingStats, CondensedMapping } from './types';
import { toast } from 'react-hot-toast';
import { supabase } from '@/utils/supabase-client';

interface ColumnMappingSource {
    databaseId: string;
    schema: string;
    table: string;
    column: string;
}

interface ColumnMapping {
    sources: ColumnMappingSource[];
    destinationSchema: string;
    destinationTable: string;
    destinationColumn: string;
    description: string;
}

interface MappingInput {
    columnMappings: ColumnMapping[];
}

interface DbSchemaMapping {
    id: string;
    name: string;
    target_database: string;
    source_database: string;
    metadata: Record<string, any>;
}

interface DbSchemaMappingEntry {
    schema_mapping_id: string;
    target_table: string;
    target_column: string;
    transformation?: string;
}

interface DbSchemaMappingSource {
    mapping_entry_id: string;
    source_database: string;
    source_table: string;
    source_column: string;
}

// Helper function to validate database existence
const validateDatabase = async (databaseId: string): Promise<boolean> => {
    const { data, error } = await supabase
        .from('databases')
        .select('id')
        .eq('id', databaseId)
        .single();

    if (error) {
        console.error('Error validating database:', error);
        return false;
    }

    return !!data;
};

// Helper function to validate table existence
const validateTable = async (databaseId: string, schema: string, tableName: string): Promise<boolean> => {
    const { data, error } = await supabase
        .from('db_tables')
        .select('id')
        .eq('database_id', databaseId)
        .eq('schema', schema)
        .eq('name', tableName)
        .single();

    if (error) {
        console.error('Error validating table:', error);
        return false;
    }

    return !!data;
};

// Helper function to validate column existence
const validateColumn = async (tableId: string, columnName: string): Promise<boolean> => {
    const { data, error } = await supabase
        .from('db_columns')
        .select('id')
        .eq('table_id', tableId)
        .eq('name', columnName)
        .single();

    if (error) {
        console.error('Error validating column:', error);
        return false;
    }

    return !!data;
};

// Helper function to get table ID
const getTableId = async (databaseId: string, schema: string, tableName: string): Promise<string | null> => {
    const { data, error } = await supabase
        .from('db_tables')
        .select('id')
        .eq('database_id', databaseId)
        .eq('schema', schema)
        .eq('name', tableName)
        .single();

    if (error || !data) {
        console.error('Error getting table ID:', error);
        return null;
    }

    return data.id;
};

export const saveMapping = async (
    targetDatabaseId: string,
    mappingInput: MappingInput,
    mappingName: string = `Mapping ${new Date().toISOString()}`
): Promise<void> => {
    try {
        // Validate target database exists
        const isTargetValid = await validateDatabase(targetDatabaseId);
        if (!isTargetValid) {
            throw new Error(`Target database with ID ${targetDatabaseId} not found`);
        }

        // Validate all source databases exist and collect unique source databases
        const uniqueSourceDbIds = Array.from(new Set(
            mappingInput.columnMappings
                .flatMap(mapping => mapping.sources)
                .map(source => source.databaseId)
        ));

        for (const sourceDbId of uniqueSourceDbIds) {
            const isSourceValid = await validateDatabase(sourceDbId);
            if (!isSourceValid) {
                throw new Error(`Source database with ID ${sourceDbId} not found`);
            }
        }

        // Validate all tables and columns exist
        for (const mapping of mappingInput.columnMappings) {
            // Validate target table
            const isTargetTableValid = await validateTable(
                targetDatabaseId,
                mapping.destinationSchema,
                mapping.destinationTable
            );
            if (!isTargetTableValid) {
                throw new Error(
                    `Target table ${mapping.destinationSchema}.${mapping.destinationTable} not found`
                );
            }

            // Validate target column
            const targetTableId = await getTableId(
                targetDatabaseId,
                mapping.destinationSchema,
                mapping.destinationTable
            );
            if (!targetTableId) {
                throw new Error(
                    `Could not find ID for table ${mapping.destinationSchema}.${mapping.destinationTable}`
                );
            }

            const isTargetColumnValid = await validateColumn(targetTableId, mapping.destinationColumn);
            if (!isTargetColumnValid) {
                throw new Error(
                    `Target column ${mapping.destinationColumn} not found in table ${mapping.destinationSchema}.${mapping.destinationTable}`
                );
            }

            // Validate source tables and columns
            for (const source of mapping.sources) {
                const isSourceTableValid = await validateTable(
                    source.databaseId,
                    source.schema,
                    source.table
                );
                if (!isSourceTableValid) {
                    throw new Error(
                        `Source table ${source.schema}.${source.table} not found in database ${source.databaseId}`
                    );
                }

                const sourceTableId = await getTableId(
                    source.databaseId,
                    source.schema,
                    source.table
                );
                if (!sourceTableId) {
                    throw new Error(
                        `Could not find ID for table ${source.schema}.${source.table}`
                    );
                }

                const isSourceColumnValid = await validateColumn(sourceTableId, source.column);
                if (!isSourceColumnValid) {
                    throw new Error(
                        `Source column ${source.column} not found in table ${source.schema}.${source.table}`
                    );
                }
            }
        }

        // 1. Create the main schema mapping record
        const { data: mappingData, error: mappingError } = await supabase
            .from('schema_mappings')
            .insert({
                name: mappingName,
                target_database: targetDatabaseId,
                metadata: {
                    description: 'Auto-generated mapping',
                    validation_timestamp: new Date().toISOString()
                }
            })
            .select()
            .single();

        if (mappingError) throw mappingError;
        const mappingId = mappingData.id;

        // 2. Create entries for each column mapping
        for (const mapping of mappingInput.columnMappings) {
            // Insert the mapping entry
            const { data: entryData, error: entryError } = await supabase
                .from('schema_mapping_entries')
                .insert({
                    schema_mapping_id: mappingId,
                    target_table: mapping.destinationTable,
                    target_column: mapping.destinationColumn,
                    transformation: null // We'll add transformation support later
                })
                .select()
                .single();

            if (entryError) throw entryError;

            // 3. Create source entries for each mapping
            const sourcesPromises = mapping.sources.map(source =>
                supabase
                    .from('schema_mapping_sources')
                    .insert({
                        mapping_entry_id: entryData.id,
                        source_database: source.databaseId,
                        source_table: source.table,
                        source_column: source.column
                    })
            );

            await Promise.all(sourcesPromises);
        }

        // 4. Create entries in the junction table for source databases
        const databaseMappingPromises = uniqueSourceDbIds.map(sourceDbId =>
            supabase
                .from('schema_mapping_databases')
                .insert({
                    schema_mapping_id: mappingId,
                    database_id: sourceDbId
                })
        );

        await Promise.all(databaseMappingPromises);

        toast.success('Mapping saved successfully');
    } catch (error) {
        console.error('Error saving mapping:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to save mapping');
        throw error;
    }
};

export const getColumnsForTable = (
    sourceDatabases: Map<string, Database>,
    dbId: string,
    tableName: string
): Column[] => {
    const database = sourceDatabases.get(dbId);
    if (!database) return [];

    const table = database.tables?.find(t => t.name === tableName);
    return table?.columns || [];
};

export const calculateMappingStats = (
    selectedTables: Table[],
    condensedMappings: CondensedMapping[],
    sourceDatabases: Map<string, Database>,
    sourceDatabaseIds: string[]
): {
    targetDbStats: MappingStats;
    sourceDbStats: Map<string, MappingStats>;
    tableStats: Map<string, MappingStats>;
} => {
    const sourceStats = new Map<string, { totalColumns: number; mappedColumns: number }>();
    const newTableStats = new Map<string, MappingStats>();

    // Initialize source database stats
    sourceDatabaseIds.forEach(dbId => {
        sourceStats.set(dbId, { totalColumns: 0, mappedColumns: 0 });
    });

    // Calculate table-level stats
    selectedTables.forEach(table => {
        const tableMappings = condensedMappings.filter(m => m.targetTable === table.name);
        const mappedColumns = tableMappings.length;
        const totalColumns = table.columns.length;
        const percentMapped = totalColumns > 0 ? Math.round((mappedColumns / totalColumns) * 100) : 0;

        newTableStats.set(table.name, {
            totalColumns,
            mappedColumns,
            percentMapped
        });

        // Update source database stats
        tableMappings.forEach(mapping => {
            mapping.sources.forEach(source => {
                const stats = sourceStats.get(source.databaseId);
                if (stats) {
                    stats.mappedColumns += 1;
                    sourceStats.set(source.databaseId, stats);
                }
            });
        });
    });

    // Calculate total columns for source databases
    sourceDatabaseIds.forEach(dbId => {
        const db = sourceDatabases.get(dbId);
        const stats = sourceStats.get(dbId);
        if (stats && db?.tables) {
            stats.totalColumns = db.tables.reduce((sum, table) => sum + (table.columns?.length || 0), 0);
            sourceStats.set(dbId, stats);
        }
    });

    // Calculate target database stats
    const totalTargetColumns = selectedTables.reduce((sum, table) => sum + table.columns.length, 0);
    const mappedTargetColumns = condensedMappings.length;
    const targetPercentMapped = totalTargetColumns > 0
        ? Math.round((mappedTargetColumns / totalTargetColumns) * 100)
        : 0;

    const targetDbStats = {
        totalColumns: totalTargetColumns,
        mappedColumns: mappedTargetColumns,
        percentMapped: targetPercentMapped
    };

    // Convert source stats to MappingStats format
    const sourceDbStats = new Map<string, MappingStats>();
    sourceStats.forEach((stats, dbId) => {
        const percentMapped = stats.totalColumns > 0
            ? Math.round((stats.mappedColumns / stats.totalColumns) * 100)
            : 0;

        sourceDbStats.set(dbId, {
            totalColumns: stats.totalColumns,
            mappedColumns: stats.mappedColumns,
            percentMapped
        });
    });

    return { targetDbStats, sourceDbStats, tableStats: newTableStats };
};

export const validateMappings = (
    mappingName: string,
    targetDatabaseId: string | null,
    sourceDatabaseIds: string[],
    condensedMappings: CondensedMapping[]
): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};

    if (!mappingName.trim()) {
        errors['name'] = 'Mapping name is required';
    }

    if (!targetDatabaseId) {
        errors['target'] = 'Target database is required';
    }

    if (sourceDatabaseIds.length === 0) {
        errors['source'] = 'At least one source database must be selected';
    }

    // Validate transformations for mappings with multiple sources
    condensedMappings.forEach(mapping => {
        if (mapping.sources.length > 1 && !mapping.transformation) {
            errors[mapping.id] = 'Transformation is required when mapping multiple source columns';
        }
    });

    return errors;
};

export const exportMappings = (
    mappingName: string,
    targetDatabaseId: string,
    sourceDatabaseIds: string[],
    condensedMappings: CondensedMapping[]
): void => {
    const exportData = {
        name: mappingName,
        targetDatabaseId,
        sourceDatabaseIds,
        mappings: condensedMappings.map(mapping => {
            return {
                targetSchema: mapping.targetSchema,
                targetTable: mapping.targetTable,
                targetColumn: mapping.targetColumn,
                transformation: mapping.transformation,
                sources: mapping.sources.map(source => {
                    return {
                        databaseId: source.databaseId,
                        schema: source.schema,
                        table: source.table,
                        column: source.column
                    };
                })
            };
        })
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `schema-mapping-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Mappings exported successfully');
};

export const generateMappingReport = (
    mappingName: string,
    databaseList: any[],
    targetDatabaseId: string,
    sourceDatabaseIds: string[],
    selectedTables: Table[],
    condensedMappings: CondensedMapping[],
    tableStats: Map<string, MappingStats>,
    sourceDbStats: Map<string, MappingStats>,
    targetDbStats: MappingStats
): void => {
    const currentDate = new Date().toLocaleDateString();
    const targetDb = databaseList.find(db => db.id === targetDatabaseId);

    // Generate shared report data
    const reportData = {
        title: `Schema Mapping Report: ${mappingName}`,
        date: currentDate,
        targetDatabase: {
            name: targetDb?.name || 'Unknown',
            stats: targetDbStats
        },
        sourceDatabases: sourceDatabaseIds.map(dbId => {
            const db = databaseList.find(d => d.id === dbId);
            const stats = sourceDbStats.get(dbId);
            return {
                name: db?.name || 'Unknown',
                stats
            };
        }),
        tableMappings: selectedTables.map(table => {
            const stats = tableStats.get(table.name);
            const tableMappings = condensedMappings.filter(m => m.targetTable === table.name);
            return {
                name: table.name,
                stats,
                mappings: tableMappings.map(mapping => ({
                    targetColumn: mapping.targetColumn,
                    sources: mapping.sources.map(source => {
                        const sourceDb = databaseList.find(db => db.id === source.databaseId);
                        return {
                            database: sourceDb?.name || 'Unknown',
                            table: source.table,
                            column: source.column
                        };
                    }),
                    transformation: mapping.transformation
                }))
            };
        })
    };

    // Generate HTML report
    const htmlContent = generateHtmlReport(reportData);
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const htmlUrl = URL.createObjectURL(htmlBlob);
    downloadFile(htmlUrl, `schema-mapping-report-${new Date().toISOString().split('T')[0]}.html`);

    // Generate Markdown report
    const markdownContent = generateMarkdownReport(reportData);
    const markdownBlob = new Blob([markdownContent], { type: 'text/markdown' });
    const markdownUrl = URL.createObjectURL(markdownBlob);
    downloadFile(markdownUrl, `schema-mapping-report-${new Date().toISOString().split('T')[0]}.md`);

    toast.success('Reports generated successfully');
};

const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

interface ReportData {
    title: string;
    date: string;
    targetDatabase: {
        name: string;
        stats: MappingStats;
    };
    sourceDatabases: Array<{
        name: string;
        stats: MappingStats | undefined;
    }>;
    tableMappings: Array<{
        name: string;
        stats: MappingStats | undefined;
        mappings: Array<{
            targetColumn: string;
            sources: Array<{
                database: string;
                table: string;
                column: string;
            }>;
            transformation: string | undefined;
        }>;
    }>;
}

const generateHtmlReport = (data: ReportData): string => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.title}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
            h1, h2, h3 { color: #2563eb; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8fafc; }
            .progress-container { width: 200px; background-color: #e2e8f0; border-radius: 9999px; }
            .progress-bar { height: 20px; background-color: #2563eb; border-radius: 9999px; }
            .stats { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
            .stat-card { background-color: #f8fafc; padding: 20px; border-radius: 8px; flex: 1; min-width: 250px; }
            .source-list { margin: 0; padding-left: 20px; }
        </style>
    </head>
    <body>
        <h1>${data.title}</h1>
        <p>Generated on ${data.date}</p>

        <h2>Overview</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>Target Database</h3>
                <p>${data.targetDatabase.name}</p>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${data.targetDatabase.stats.percentMapped}%"></div>
                </div>
                <p>${data.targetDatabase.stats.percentMapped}% mapped (${data.targetDatabase.stats.mappedColumns}/${data.targetDatabase.stats.totalColumns} columns)</p>
            </div>

            ${data.sourceDatabases.map(db => db.stats ? `
                <div class="stat-card">
                    <h3>Source Database: ${db.name}</h3>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${db.stats.percentMapped}%"></div>
                    </div>
                    <p>${db.stats.percentMapped}% used (${db.stats.mappedColumns}/${db.stats.totalColumns} columns)</p>
                </div>
            ` : '').join('')}
        </div>

        <h2>Table Mappings</h2>
        <table>
            <thead>
                <tr>
                    <th>Table Name</th>
                    <th>Mapped Columns</th>
                    <th>Total Columns</th>
                    <th>Progress</th>
                </tr>
            </thead>
            <tbody>
                ${data.tableMappings.map(table => table.stats ? `
                    <tr>
                        <td>${table.name}</td>
                        <td>${table.stats.mappedColumns}</td>
                        <td>${table.stats.totalColumns}</td>
                        <td>
                            <div class="progress-container">
                                <div class="progress-bar" style="width: ${table.stats.percentMapped}%"></div>
                            </div>
                            ${table.stats.percentMapped}%
                        </td>
                    </tr>
                ` : '').join('')}
            </tbody>
        </table>

        <h2>Detailed Mappings</h2>
        ${data.tableMappings.map(table => `
            <h3>${table.name}</h3>
            <table>
                <thead>
                    <tr>
                        <th>Target Column</th>
                        <th>Source Columns</th>
                        <th>Transformation</th>
                    </tr>
                </thead>
                <tbody>
                    ${table.mappings.map(mapping => `
                        <tr>
                            <td>${mapping.targetColumn}</td>
                            <td>
                                <ul class="source-list">
                                    ${mapping.sources.map(source => `
                                        <li>${source.database}.${source.table}.${source.column}</li>
                                    `).join('')}
                                </ul>
                            </td>
                            <td>${mapping.transformation || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `).join('')}
    </body>
    </html>
    `;
};

const generateMarkdownReport = (data: ReportData): string => {
    const tableRows = data.tableMappings
        .map(table => table.stats ?
            `| ${table.name} | ${table.stats.mappedColumns} | ${table.stats.totalColumns} | ${table.stats.percentMapped}% |`
            : '')
        .filter(row => row);

    const detailedMappings = data.tableMappings
        .map(table => {
            const mappingRows = table.mappings
                .map(mapping => {
                    const sourceColumns = mapping.sources
                        .map(source => `${source.database}.${source.table}.${source.column}`)
                        .join('<br>');
                    return `| ${mapping.targetColumn} | ${sourceColumns} | ${mapping.transformation || '-'} |`;
                })
                .join('\n');

            return `
### ${table.name}

| Target Column | Source Columns | Transformation |
|--------------|---------------|----------------|
${mappingRows}`;
        })
        .join('\n\n');

    const sourceDatabasesSection = data.sourceDatabases
        .map(db => db.stats ? `
### Source Database: ${db.name}
- Progress: ${db.stats.percentMapped}% used
- Mapped Columns: ${db.stats.mappedColumns}/${db.stats.totalColumns}
` : '')
        .filter(section => section)
        .join('\n');

    return `# ${data.title}

Generated on ${data.date}

## Overview

### Target Database: ${data.targetDatabase.name}
- Progress: ${data.targetDatabase.stats.percentMapped}% mapped
- Mapped Columns: ${data.targetDatabase.stats.mappedColumns}/${data.targetDatabase.stats.totalColumns}

${sourceDatabasesSection}

## Table Mappings

| Table Name | Mapped Columns | Total Columns | Progress |
|------------|---------------|---------------|----------|
${tableRows}

## Detailed Mappings
${detailedMappings}
`;
}; 