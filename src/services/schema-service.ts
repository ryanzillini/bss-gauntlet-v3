import { supabase } from '../utils/supabase-client';
import { Database, Table, Column, Constraint, ColumnTypeInfo, PrimaryKeyConstraint, ForeignKeyConstraint, DefaultConstraint, UniqueConstraint, CheckConstraint } from '../pages/schema/models';
import { toast } from 'react-hot-toast';

// Extended database interface for internal use
interface DatabaseWithId extends Database {
    id: string;
    name: string;
}

/**
 * Fetches all databases from the Supabase database
 */
export async function getDatabases(): Promise<DatabaseWithId[]> {
    const { data, error } = await supabase
        .from('databases')
        .select('*');

    if (error) {
        console.error('Error fetching databases:', error);
        throw error;
    }

    // Convert database records to Database model objects
    return data.map(db => ({
        type: "database" as const,
        dialect: db.dialect as "ansi" | "tsql",
        tables: [], // Tables will be populated separately
        id: db.id,
        name: db.name
    }));
}

/**
 * Fetches schema mappings between databases
 */
export async function getSchemaMappings() {
    const { data, error } = await supabase
        .from('schema_mappings')
        .select(`
      id, 
      name, 
      source_database,
      target_database,
      created_at,
      updated_at
    `);

    if (error) {
        console.error('Error fetching schema mappings:', error);
        throw error;
    }

    return data;
}

/**
 * Tests a database connection without saving it
 * @param connectionString The connection string to test
 * @returns Information about the connection
 */
export async function testDatabaseConnection(connectionString: string) {
    try {
        const response = await fetch('/api/database/test-connection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ connectionString }),
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('Error testing connection:', error);
        return {
            success: false,
            message: error.message || 'An unknown error occurred while testing the connection'
        };
    }
}

/**
 * Adds a new database connection by connecting to the actual database,
 * extracting its schema, and saving it to our Supabase database
 */
export async function addDatabaseConnection(name: string, connectionString: string) {
    try {
        const response = await fetch('/api/database/add-connection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, connectionString }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to add database connection');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error adding database connection:', error);
        throw error;
    }
}

/**
 * Fetches all available database connections
 */
export async function getDatabaseConnections() {
    try {
        const response = await fetch('/api/database/get-connections');

        if (!response.ok) {
            throw new Error('Failed to fetch database connections');
        }

        const connections = await response.json();
        return connections;
    } catch (error) {
        console.error('Error loading database connections:', error);

        // Fall back to mock data if there's an error
        return [
            {
                id: 'db-1',
                name: 'Customer Database',
                connection_string: 'postgresql://user:password@localhost:5432/customer_db',
                created_at: '2023-06-01T00:00:00.000Z',
                dialect: 'PostgreSQL'
            },
            {
                id: 'db-2',
                name: 'Product Database',
                connection_string: 'postgresql://user:password@localhost:5432/product_db',
                created_at: '2023-06-02T00:00:00.000Z',
                dialect: 'PostgreSQL'
            }
        ];
    }
}

/**
 * Gets database details by ID including associated tables
 * This retrieves table information directly from the database schema
 */
export async function getDatabaseWithTables(databaseId: string): Promise<Database> {
    // First get the database record
    const { data: dbData, error: dbError } = await supabase
        .from('databases')
        .select('*')
        .eq('id', databaseId);

    if (dbError) {
        console.error(`Error fetching database with ID ${databaseId}:`, dbError);
        throw dbError;
    }

    // If no database found, return an empty database
    if (!dbData || dbData.length === 0) {
        console.warn(`No database found with ID ${databaseId}`);
        return {
            type: "database" as const,
            dialect: "ansi", // Default dialect
            tables: []
        };
    }

    const database = dbData[0];

    // Get all tables for this database
    const { data: tablesData, error: tablesError } = await supabase
        .from('db_tables')
        .select('*')
        .eq('database_id', databaseId);

    if (tablesError) {
        console.error(`Error fetching tables for database ${databaseId}:`, tablesError);
        throw tablesError;
    }

    // Prepare tables array
    const tables: Table[] = [];

    // Process each table
    for (const tableData of tablesData) {
        // Get columns for this table
        const { data: columnsData, error: columnsError } = await supabase
            .from('db_columns')
            .select('*')
            .eq('table_id', tableData.id);

        if (columnsError) {
            console.error(`Error fetching columns for table ${tableData.id}:`, columnsError);
            throw columnsError;
        }

        // Get constraints for this table
        const { data: constraintsData, error: constraintsError } = await supabase
            .from('db_constraints')
            .select('*')
            .eq('table_id', tableData.id);

        if (constraintsError) {
            console.error(`Error fetching constraints for table ${tableData.id}:`, constraintsError);
            throw constraintsError;
        }

        // Convert columns to model format
        const columns: Column[] = columnsData.map((columnData) => ({
            type: "column" as const,
            name: columnData.name,
            dataType: columnData.data_type,
            typeInfo: columnData.type_info as ColumnTypeInfo,
            isNullable: columnData.is_nullable,
            isIdentity: columnData.is_identity,
            identityInfo: columnData.identity_info,
            defaultValue: columnData.default_value
        }));

        // Convert constraints to model format
        const constraints: Constraint[] = constraintsData.map((constraintData) => {
            const baseConstraint = {
                type: "constraint" as const,
                constraintType: constraintData.constraint_type as any,
                name: constraintData.name,
                rawSql: constraintData.raw_sql || ""
            };

            // Add specific properties based on constraint type
            switch (constraintData.constraint_type) {
                case 'primaryKey':
                    return {
                        ...baseConstraint,
                        constraintType: "primaryKey" as const,
                        columns: constraintData.pk_columns || [],
                        clustered: constraintData.pk_clustered,
                        fileGroup: constraintData.pk_file_group
                    } as PrimaryKeyConstraint;

                case 'foreignKey':
                    return {
                        ...baseConstraint,
                        constraintType: "foreignKey" as const,
                        sourceTable: constraintData.fk_source_table,
                        sourceSchema: constraintData.fk_source_schema,
                        sourceColumn: constraintData.fk_source_column,
                        referencedTable: constraintData.fk_referenced_table,
                        referencedSchema: constraintData.fk_referenced_schema,
                        referencedColumn: constraintData.fk_referenced_column
                    } as ForeignKeyConstraint;

                case 'default':
                    return {
                        ...baseConstraint,
                        constraintType: "default" as const,
                        table: constraintData.default_table,
                        schema: constraintData.default_schema,
                        column: constraintData.default_column,
                        value: constraintData.default_value
                    } as DefaultConstraint;

                case 'unique':
                    return {
                        ...baseConstraint,
                        constraintType: "unique" as const,
                        table: constraintData.unique_table,
                        schema: constraintData.unique_schema,
                        columns: constraintData.unique_columns || [],
                        clustered: constraintData.unique_clustered
                    } as UniqueConstraint;

                case 'check':
                    return {
                        ...baseConstraint,
                        constraintType: "check" as const,
                        table: constraintData.check_table,
                        schema: constraintData.check_schema,
                        expression: constraintData.check_expression
                    } as CheckConstraint;

                default:
                    return baseConstraint as any;
            }
        });

        // Build the table object
        const table: Table = {
            type: "table" as const,
            name: tableData.name,
            schema: tableData.schema,
            comment: tableData.comment || "",
            rawSql: tableData.raw_sql || "",
            columns: columns,
            constraints: constraints,
            fileGroup: tableData.file_group
        };

        tables.push(table);
    }

    // Get documentation if available
    let documentation = undefined;

    try {
        const { data: docRelData, error: docRelError } = await supabase
            .from('database_documentation_rel')
            .select('documentation_id')
            .eq('database_id', databaseId);

        if (!docRelError && docRelData && docRelData.length > 0) {
            const docIds = docRelData.map(rel => rel.documentation_id);

            const { data: docsData, error: docsError } = await supabase
                .from('database_documentation')
                .select('*')
                .in('id', docIds);

            if (!docsError && docsData && docsData.length > 0) {
                documentation = docsData.map(doc => ({
                    id: doc.id,
                    name: doc.name,
                    s3Location: doc.s3_location,
                    type: doc.type,
                    description: doc.description,
                    createdAt: doc.created_at ? new Date(doc.created_at) : undefined,
                    updatedAt: doc.updated_at ? new Date(doc.updated_at) : undefined
                }));
            }
        }
    } catch (error) {
        console.warn('Error fetching documentation:', error);
        // Don't throw, just continue without documentation
    }

    // Create database object with tables
    const databaseObject: Database = {
        type: "database" as const,
        dialect: database.dialect as "ansi" | "tsql",
        tables: tables,
        documentation: documentation
    };

    return databaseObject;
}

/**
 * Saves a complete Database object to the Supabase database.
 * This includes all tables, columns, constraints, and other properties.
 */
export async function saveFullDatabase(database: Database, name: string, connectionString?: string): Promise<string> {
    try {
        // 1. Insert the database record
        const { data: dbData, error: dbError } = await supabase
            .from('databases')
            .insert({
                name: name,
                type: database.type,
                dialect: database.dialect,
                metadata: connectionString ? { connection_string: connectionString } : {} // Store connection string in metadata
            })
            .select()
            .single();

        if (dbError) {
            console.error('Error creating database record:', dbError);
            throw dbError;
        }

        const databaseId = dbData.id;

        // 2. Insert all tables
        for (const table of database.tables) {
            const { data: tableData, error: tableError } = await supabase
                .from('db_tables')
                .insert({
                    database_id: databaseId,
                    name: table.name,
                    schema: table.schema,
                    comment: table.comment || '',
                    raw_sql: table.rawSql || '',
                    file_group: table.fileGroup || null
                })
                .select()
                .single();

            if (tableError) {
                console.error(`Error creating table ${table.name}:`, tableError);
                throw tableError;
            }

            const tableId = tableData.id;

            // 3. Insert all columns for this table
            for (const column of table.columns) {
                const { error: columnError } = await supabase
                    .from('db_columns')
                    .insert({
                        table_id: tableId,
                        name: column.name,
                        data_type: column.dataType,
                        type_info: column.typeInfo,
                        is_nullable: column.isNullable,
                        is_identity: column.isIdentity,
                        identity_info: column.identityInfo || null,
                        default_value: column.defaultValue || null
                    });

                if (columnError) {
                    console.error(`Error creating column ${column.name}:`, columnError);
                    throw columnError;
                }
            }

            // 4. Insert all constraints for this table
            for (const constraint of table.constraints) {
                let constraintData: any = {
                    table_id: tableId,
                    constraint_type: constraint.constraintType,
                    name: constraint.name,
                    raw_sql: constraint.rawSql || ''
                };

                // Add specific fields based on constraint type
                switch (constraint.constraintType) {
                    case 'primaryKey':
                        constraintData = {
                            ...constraintData,
                            pk_columns: (constraint as PrimaryKeyConstraint).columns,
                            pk_clustered: (constraint as PrimaryKeyConstraint).clustered,
                            pk_file_group: (constraint as PrimaryKeyConstraint).fileGroup
                        };
                        break;
                    case 'foreignKey':
                        const fk = constraint as ForeignKeyConstraint;
                        constraintData = {
                            ...constraintData,
                            fk_source_table: fk.sourceTable,
                            fk_source_schema: fk.sourceSchema,
                            fk_source_column: fk.sourceColumn,
                            fk_referenced_table: fk.referencedTable,
                            fk_referenced_schema: fk.referencedSchema,
                            fk_referenced_column: fk.referencedColumn
                        };
                        break;
                    case 'default':
                        const defC = constraint as DefaultConstraint;
                        constraintData = {
                            ...constraintData,
                            default_table: defC.table,
                            default_schema: defC.schema,
                            default_column: defC.column,
                            default_value: defC.value
                        };
                        break;
                    case 'unique':
                        const uniq = constraint as UniqueConstraint;
                        constraintData = {
                            ...constraintData,
                            unique_table: uniq.table,
                            unique_schema: uniq.schema,
                            unique_columns: uniq.columns,
                            unique_clustered: uniq.clustered
                        };
                        break;
                    case 'check':
                        const check = constraint as CheckConstraint;
                        constraintData = {
                            ...constraintData,
                            check_table: check.table,
                            check_schema: check.schema,
                            check_expression: check.expression
                        };
                        break;
                }

                const { error: constraintError } = await supabase
                    .from('db_constraints')
                    .insert(constraintData);

                if (constraintError) {
                    console.error(`Error creating constraint ${constraint.name}:`, constraintError);
                    throw constraintError;
                }
            }
        }

        // 5. Add documentation if it exists
        if (database.documentation && database.documentation.length > 0) {
            for (const doc of database.documentation) {
                const { data: docData, error: docError } = await supabase
                    .from('database_documentation')
                    .insert({
                        name: doc.name,
                        s3_location: doc.s3Location,
                        type: doc.type,
                        description: doc.description || '',
                        metadata: {}
                    })
                    .select()
                    .single();

                if (docError) {
                    console.error(`Error creating documentation ${doc.name}:`, docError);
                    throw docError;
                }

                // Create relationship between database and documentation
                const { error: relError } = await supabase
                    .from('database_documentation_rel')
                    .insert({
                        database_id: databaseId,
                        documentation_id: docData.id
                    });

                if (relError) {
                    console.error(`Error creating database-documentation relationship:`, relError);
                    throw relError;
                }
            }
        }

        return databaseId;
    } catch (error) {
        console.error('Error saving database to Supabase:', error);
        throw error;
    }
}

/**
 * Extracts the schema from a database connection and saves it to our Supabase database
 */
export async function extractDatabaseSchema(id: string, name: string, connectionString: string): Promise<any> {
    console.log(`Starting client-side extraction for database "${name}" with ID ${id}`);

    // Create an AbortController with a longer timeout (3 minutes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.log('Client-side timeout reached after 3 minutes, aborting request');
        controller.abort();
    }, 180000); // 3 minutes

    try {
        console.log('Sending extraction request to API endpoint...');
        const response = await fetch('/api/database/extract-schema', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, name, connectionString }),
            signal: controller.signal
        });

        // Clear the timeout if the request completes successfully
        clearTimeout(timeoutId);
        console.log('Request completed, clearing timeout');

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API returned error status ${response.status}: ${errorText}`);
            throw new Error(`Failed to extract schema: ${errorText}`);
        }

        console.log('API request successful, parsing response...');
        const data = await response.json();
        console.log(`Schema extraction successful. Retrieved ${data.tableCount} tables.`);
        return data;
    } catch (error: any) {
        clearTimeout(timeoutId); // Also clear the timeout if there's an error
        console.error('Error during schema extraction:', error);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out after 3 minutes');
        }
        throw error;
    }
} 