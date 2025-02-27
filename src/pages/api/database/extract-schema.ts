import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../utils/supabase-client';
import { Pool } from 'pg';
import * as mssql from 'mssql';
import { Database, Table, Column, Constraint, ColumnTypeInfo, PrimaryKeyConstraint, ForeignKeyConstraint, DefaultConstraint, UniqueConstraint, CheckConstraint } from '../../../pages/schema/models';

// Set increased timeout for this API route
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
        responseLimit: '8mb',
        externalResolver: true, // This tells Next.js this route will be handled by an external resolver
    },
};

// Helper functions
function detectDatabaseType(connectionString: string): string | null {
    if (connectionString.startsWith('postgres') || connectionString.startsWith('postgresql')) {
        return 'postgresql';
    } else if (
        connectionString.toLowerCase().includes('sqlserver') ||
        connectionString.toLowerCase().includes('mssql') ||
        connectionString.toLowerCase().includes('server=')
    ) {
        return 'mssql';
    } else if (connectionString.toLowerCase().includes('mysql')) {
        return null;
    }
    return null;
}

function parseMssqlConnectionString(connectionString: string): mssql.config {
    let config: mssql.config;

    console.log('Parsing connection string:', connectionString.replace(/\/\/.*?@/, '//***@')); // Log the sanitized string

    // Handle URL-style connection strings (both mssql:// and sqlserver://)
    if (connectionString.startsWith('mssql://') || connectionString.startsWith('sqlserver://')) {
        try {
            // Special handling for connection strings with format: sqlserver://username@password_server_hostname/database
            if (connectionString.includes('@') && !connectionString.includes(':')) {
                const protocol = connectionString.startsWith('mssql://') ? 'mssql://' : 'sqlserver://';
                const withoutProtocol = connectionString.substring(protocol.length);

                // Split by @ to separate username from the rest
                const [username, serverAndDb] = withoutProtocol.split('@');

                // Try to intelligently split the server part
                const serverParts = serverAndDb.split('.');
                if (serverParts.length > 1) {
                    // Assume format is sqlserver://username@password_remainingServerAddress
                    // where password is the first part of what looks like the hostname
                    const potentialPassword = serverParts[0];
                    const remainingServer = serverParts.slice(1).join('.');

                    // Extract database name if exists
                    let database = '';
                    const serverAndPort = remainingServer.split('/');
                    const actualServer = serverAndPort[0];
                    if (serverAndPort.length > 1) {
                        database = serverAndPort[1];
                    }

                    config = {
                        user: username,
                        password: potentialPassword,
                        server: actualServer,
                        database,
                        port: 1433, // Default SQL Server port
                        options: {
                            trustServerCertificate: true,
                            encrypt: true
                        }
                    };

                    console.log('Using special parsing for SQL Server connection with embedded password');
                    return config;
                }
            }

            // Standard URL parsing for well-formed URLs
            // First, normalize the URL protocol to ensure proper parsing
            let normalizedUrl = connectionString;
            if (connectionString.startsWith('sqlserver://')) {
                normalizedUrl = 'mssql://' + connectionString.substring('sqlserver://'.length);
            }

            const url = new URL(normalizedUrl);

            // Extract credentials
            let user = url.username || '';
            let password = url.password || '';

            // Handle special case where password might be embedded in hostname (admin@password123.database.com)
            if (!password && url.hostname.includes('@')) {
                const parts = url.hostname.split('@');
                if (parts.length === 2) {
                    password = parts[0];
                    url.hostname = parts[1];
                }
            }

            config = {
                user: user,
                password: password,
                server: url.hostname,
                database: url.pathname.substring(1), // Remove leading slash
                port: url.port ? parseInt(url.port) : 1433,
                options: {
                    trustServerCertificate: true, // For dev/test environments
                    encrypt: true  // For Azure
                }
            };
        } catch (error) {
            console.error('Error parsing URL-style connection string:', error);
            // If URL parsing fails, try to extract parts manually
            const urlPattern = /(?:mssql|sqlserver):\/\/([^:@]+)(?::([^@]+))?@([^:\/]+)(?::(\d+))?(?:\/(.+))?/;
            const match = connectionString.match(urlPattern);

            if (match) {
                const [, user, password, server, port, database] = match;
                config = {
                    user: user || '',
                    password: password || '',
                    server: server,
                    database: database || '',
                    port: port ? parseInt(port) : 1433,
                    options: {
                        trustServerCertificate: true,
                        encrypt: true
                    }
                };
            } else {
                // If all else fails, try to get at least the server name
                const serverPattern = /(?:mssql|sqlserver):\/\/(?:.*@)?([^:\/]+)/;
                const serverMatch = connectionString.match(serverPattern);

                config = {
                    server: serverMatch ? serverMatch[1] : '',
                    options: {
                        trustServerCertificate: true,
                        encrypt: true
                    }
                };
            }
        }
    } else {
        // Parse key-value style connection string
        const params: Record<string, string> = {};
        connectionString.split(';').forEach(part => {
            const keyValue = part.split('=');
            if (keyValue.length === 2) {
                params[keyValue[0].trim()] = keyValue[1].trim();
            }
        });

        config = {
            user: params['User Id'] || params['User'] || params['UID'] || params['uid'] || '',
            password: params['Password'] || params['PWD'] || params['pwd'] || '',
            server: params['Server'] || params['Data Source'] || params['server'] || '',
            database: params['Database'] || params['Initial Catalog'] || params['database'] || '',
            port: params['Port'] ? parseInt(params['Port']) : 1433,
            options: {
                trustServerCertificate: true,
                encrypt: params['Encrypt'] === 'true' || true
            }
        };
    }

    // Validate required configuration
    if (!config.server) {
        throw new Error('Server name or address is required in the connection string');
    }

    // Log the config we're using (without password for security)
    console.log('Using SQL Server config:', {
        ...config,
        password: config.password ? '********' : undefined
    });

    return config;
}

async function testPostgresConnection(connectionString: string): Promise<boolean> {
    const pool = new Pool({ connectionString });

    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        return true;
    } catch (error) {
        console.error('Error testing PostgreSQL connection:', error);
        return false;
    }
}

async function testMssqlConnection(connectionString: string): Promise<boolean> {
    try {
        console.log('Testing SQL Server connection...');
        const config = parseMssqlConnectionString(connectionString);

        // Add longer timeout values
        config.options = {
            ...config.options,
            connectTimeout: 30000, // 30 seconds for test connection
            requestTimeout: 30000 // 30 seconds for test query
        };

        console.log('Creating SQL Server connection pool with config:', {
            server: config.server,
            database: config.database,
            user: config.user ? 'specified' : 'not specified',
            port: config.port,
            connectTimeout: config.options?.connectTimeout,
            requestTimeout: config.options?.requestTimeout
        });
        const pool = new mssql.ConnectionPool(config);
        console.log('Connecting to SQL Server...');
        await pool.connect();
        console.log('Connection successful, executing test query...');
        await pool.request().query('SELECT 1 as test');
        console.log('Test query successful, closing connection...');
        await pool.close();
        console.log('SQL Server connection test completed successfully.');
        return true;
    } catch (error) {
        console.error('Error testing SQL Server connection:', error);
        return false;
    }
}

async function extractPostgresSchema(connectionString: string): Promise<{ tables: Table[] }> {
    const pool = new Pool({ connectionString });
    let client;

    try {
        client = await pool.connect();

        // Get all tables
        const tablesResult = await client.query(`
      SELECT table_schema, table_name, obj_description(
        ('"' || table_schema || '"."' || table_name || '"')::regclass, 
        'pg_class'
      ) as table_comment
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);

        const tables: Table[] = [];

        for (const tableRow of tablesResult.rows) {
            const tableSchema = tableRow.table_schema;
            const tableName = tableRow.table_name;
            const tableComment = tableRow.table_comment || '';

            // Get columns for this table
            const columnsResult = await client.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable, 
          column_default,
          character_maximum_length, 
          numeric_precision, 
          numeric_scale,
          col_description(
            ('"' || $1 || '"."' || $2 || '"')::regclass, 
            ordinal_position
          ) as column_comment,
          is_identity,
          identity_generation
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [tableSchema, tableName]);

            // Process columns with more detailed type information
            const columns: Column[] = columnsResult.rows.map((col: any) => {
                // Map PostgreSQL types to our ColumnTypeInfo structure
                let typeInfo: ColumnTypeInfo = { kind: 'simple' };

                if (col.data_type === 'character varying') {
                    typeInfo = { kind: 'varchar', length: col.character_maximum_length };
                } else if (col.data_type === 'character') {
                    typeInfo = { kind: 'char', length: col.character_maximum_length };
                } else if (col.data_type === 'numeric') {
                    typeInfo = {
                        kind: 'numeric',
                        precision: col.numeric_precision,
                        scale: col.numeric_scale
                    };
                } else if (col.data_type === 'decimal') {
                    typeInfo = {
                        kind: 'decimal',
                        precision: col.numeric_precision,
                        scale: col.numeric_scale
                    };
                }

                // Identity info if the column is an identity column
                let identityInfo = undefined;
                if (col.is_identity === 'YES') {
                    // In a real implementation, we'd extract seed and increment
                    identityInfo = {
                        seed: 1,
                        increment: 1
                    };
                }

                return {
                    type: "column",
                    name: col.column_name,
                    dataType: col.data_type,
                    typeInfo: typeInfo,
                    isNullable: col.is_nullable === 'YES',
                    isIdentity: col.is_identity === 'YES',
                    identityInfo,
                    defaultValue: col.column_default
                };
            });

            // Get primary key constraints
            const primaryKeysResult = await client.query(`
        SELECT 
          kcu.column_name,
          tc.constraint_name
        FROM 
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE 
          tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
        ORDER BY kcu.ordinal_position
      `, [tableSchema, tableName]);

            // Get foreign key constraints
            const foreignKeysResult = await client.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name as source_column,
          ccu.table_schema as target_schema,
          ccu.table_name as target_table,
          ccu.column_name as target_column
        FROM 
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE 
          tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      `, [tableSchema, tableName]);

            // Get unique constraints
            const uniqueKeysResult = await client.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name
        FROM 
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE 
          tc.constraint_type = 'UNIQUE'
          AND tc.table_schema = $1
          AND tc.table_name = $2
        ORDER BY kcu.ordinal_position
      `, [tableSchema, tableName]);

            // Create constraints array
            const constraints: Constraint[] = [];

            // Process primary keys
            if (primaryKeysResult.rows.length > 0) {
                // Group by constraint name
                const pkConstraints: Record<string, string[]> = {};
                primaryKeysResult.rows.forEach(row => {
                    if (!pkConstraints[row.constraint_name]) {
                        pkConstraints[row.constraint_name] = [];
                    }
                    pkConstraints[row.constraint_name].push(row.column_name);
                });

                // Create a primary key constraint for each group
                Object.entries(pkConstraints).forEach(([name, columns]) => {
                    const pkConstraint: PrimaryKeyConstraint = {
                        type: "constraint",
                        constraintType: "primaryKey",
                        name,
                        columns,
                        rawSql: `PRIMARY KEY (${columns.join(', ')})`
                    };
                    constraints.push(pkConstraint);
                });
            }

            // Process foreign keys
            foreignKeysResult.rows.forEach(row => {
                const fkConstraint: ForeignKeyConstraint = {
                    type: "constraint",
                    constraintType: "foreignKey",
                    name: row.constraint_name,
                    sourceTable: tableName,
                    sourceSchema: tableSchema,
                    sourceColumn: row.source_column,
                    referencedTable: row.target_table,
                    referencedSchema: row.target_schema,
                    referencedColumn: row.target_column,
                    rawSql: `FOREIGN KEY (${row.source_column}) REFERENCES "${row.target_schema}"."${row.target_table}"(${row.target_column})`
                };
                constraints.push(fkConstraint);
            });

            // Process unique constraints
            if (uniqueKeysResult.rows.length > 0) {
                // Group by constraint name
                const uniqueConstraints: Record<string, string[]> = {};
                uniqueKeysResult.rows.forEach(row => {
                    if (!uniqueConstraints[row.constraint_name]) {
                        uniqueConstraints[row.constraint_name] = [];
                    }
                    uniqueConstraints[row.constraint_name].push(row.column_name);
                });

                // Create a unique constraint for each group
                Object.entries(uniqueConstraints).forEach(([name, columns]) => {
                    const uniqueConstraint: UniqueConstraint = {
                        type: "constraint",
                        constraintType: "unique",
                        name,
                        table: tableName,
                        schema: tableSchema,
                        columns,
                        rawSql: `UNIQUE (${columns.join(', ')})`
                    };
                    constraints.push(uniqueConstraint);
                });
            }

            // Create the table object
            const table: Table = {
                type: "table",
                name: tableName,
                schema: tableSchema,
                comment: tableComment,
                rawSql: '',
                columns,
                constraints,
                fileGroup: undefined
            };

            tables.push(table);
        }

        return { tables };
    } catch (error) {
        console.error('Error extracting PostgreSQL schema:', error);
        throw error;
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

async function extractMssqlSchema(connectionString: string): Promise<{ tables: Table[] }> {
    console.log('Starting SQL Server schema extraction with optimized bulk queries...');
    const config = parseMssqlConnectionString(connectionString);

    // Add longer timeout values for large queries
    config.options = {
        ...config.options,
        connectTimeout: 60000, // 60 seconds for connecting
        requestTimeout: 300000 // 5 minutes for query execution (bulk queries need more time)
    };

    console.log('Creating SQL Server connection pool for schema extraction with config:', {
        server: config.server,
        database: config.database,
        user: config.user ? 'specified' : 'not specified',
        port: config.port,
        connectTimeout: config.options?.connectTimeout,
        requestTimeout: config.options?.requestTimeout
    });
    const pool = new mssql.ConnectionPool(config);

    try {
        console.log('Connecting to SQL Server for schema extraction...');
        await pool.connect();
        console.log('Connection successful, executing bulk queries...');

        // 1. Get all tables in one query
        console.log('Fetching all tables in one query...');
        const tablesResult = await pool.request().query(`
            SELECT 
                s.name as table_schema,
                t.name as table_name,
                t.object_id,
                ISNULL(ep.value, '') as table_comment
            FROM 
                sys.tables t
                INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
                LEFT JOIN sys.extended_properties ep ON 
                    ep.major_id = t.object_id AND 
                    ep.minor_id = 0 AND 
                    ep.name = 'MS_Description'
            WHERE
                t.is_ms_shipped = 0
            ORDER BY 
                s.name, t.name
        `);

        const totalTables = tablesResult.recordset.length;
        console.log(`Found ${totalTables} tables in database`);

        // Create a map of object_id to table info for quick lookup
        const tableMap = new Map<number, { schema: string, name: string, comment: string }>();
        tablesResult.recordset.forEach(t => {
            tableMap.set(t.object_id, {
                schema: t.table_schema,
                name: t.table_name,
                comment: t.table_comment || ''
            });
        });

        // 2. Get all columns for all tables in one query
        console.log('Fetching all columns for all tables in one query...');
        const columnsResult = await pool.request().query(`
            SELECT 
                c.object_id,
                c.name as column_name,
                t.name as data_type,
                c.max_length,
                c.precision,
                c.scale,
                c.is_nullable,
                c.is_identity,
                ISNULL(ep.value, '') as column_comment,
                c.default_object_id,
                dc.definition as default_value
            FROM 
                sys.columns c
                INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
                INNER JOIN sys.tables tbl ON c.object_id = tbl.object_id
                INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
                LEFT JOIN sys.extended_properties ep ON 
                    ep.major_id = c.object_id AND 
                    ep.minor_id = c.column_id AND
                    ep.name = 'MS_Description'
                LEFT JOIN sys.default_constraints dc ON 
                    c.default_object_id = dc.object_id
            ORDER BY 
                s.name, tbl.name, c.column_id
        `);

        console.log(`Fetched ${columnsResult.recordset.length} total columns for all tables`);

        // 3. Get all primary key constraints in one query
        console.log('Fetching all primary key constraints in one query...');
        const primaryKeysResult = await pool.request().query(`
            SELECT 
                ic.object_id,
                i.name as constraint_name,
                c.name as column_name,
                i.is_primary_key,
                i.is_unique_constraint,
                i.type_desc,
                ic.key_ordinal
            FROM 
                sys.indexes i 
                INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                INNER JOIN sys.tables t ON i.object_id = t.object_id
            WHERE 
                i.is_primary_key = 1
            ORDER BY 
                i.object_id, i.name, ic.key_ordinal
        `);

        console.log(`Fetched ${primaryKeysResult.recordset.length} primary key constraint records`);

        // 4. Get all foreign key constraints in one query
        console.log('Fetching all foreign key constraints in one query...');
        const foreignKeysResult = await pool.request().query(`
            SELECT 
                fk.parent_object_id as object_id,
                fk.name as constraint_name,
                COL_NAME(fkc.parent_object_id, fkc.parent_column_id) as source_column,
                OBJECT_SCHEMA_NAME(fkc.referenced_object_id) as target_schema,
                OBJECT_NAME(fkc.referenced_object_id) as target_table,
                COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) as target_column
            FROM 
                sys.foreign_keys fk
                INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            ORDER BY
                fk.parent_object_id, fk.name
        `);

        console.log(`Fetched ${foreignKeysResult.recordset.length} foreign key constraint records`);

        // 5. Get all unique constraints in one query
        console.log('Fetching all unique constraints in one query...');
        const uniqueKeysResult = await pool.request().query(`
            SELECT 
                ic.object_id,
                i.name as constraint_name,
                c.name as column_name,
                i.type_desc,
                ic.key_ordinal
            FROM 
                sys.indexes i 
                INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                INNER JOIN sys.tables t ON i.object_id = t.object_id
            WHERE 
                i.is_unique_constraint = 1
            ORDER BY 
                i.object_id, i.name, ic.key_ordinal
        `);

        console.log(`Fetched ${uniqueKeysResult.recordset.length} unique constraint records`);

        // Now organize columns by table
        const columnsByTable = new Map<number, any[]>();
        columnsResult.recordset.forEach(col => {
            if (!columnsByTable.has(col.object_id)) {
                columnsByTable.set(col.object_id, []);
            }
            columnsByTable.get(col.object_id)?.push(col);
        });

        // Organize primary keys by table and constraint name
        const pksByTable = new Map<number, Map<string, { columns: string[], clustered: boolean }>>();
        primaryKeysResult.recordset.forEach(pk => {
            if (!pksByTable.has(pk.object_id)) {
                pksByTable.set(pk.object_id, new Map());
            }
            const tableConstraints = pksByTable.get(pk.object_id)!;

            if (!tableConstraints.has(pk.constraint_name)) {
                tableConstraints.set(pk.constraint_name, {
                    columns: [],
                    clustered: pk.type_desc === 'CLUSTERED'
                });
            }

            const constraint = tableConstraints.get(pk.constraint_name)!;
            constraint.columns.push(pk.column_name);
        });

        // Organize foreign keys by table
        const fksByTable = new Map<number, any[]>();
        foreignKeysResult.recordset.forEach(fk => {
            if (!fksByTable.has(fk.object_id)) {
                fksByTable.set(fk.object_id, []);
            }
            fksByTable.get(fk.object_id)?.push(fk);
        });

        // Organize unique constraints by table and constraint name
        const uniquesByTable = new Map<number, Map<string, { columns: string[], clustered: boolean }>>();
        uniqueKeysResult.recordset.forEach(uk => {
            if (!uniquesByTable.has(uk.object_id)) {
                uniquesByTable.set(uk.object_id, new Map());
            }
            const tableConstraints = uniquesByTable.get(uk.object_id)!;

            if (!tableConstraints.has(uk.constraint_name)) {
                tableConstraints.set(uk.constraint_name, {
                    columns: [],
                    clustered: uk.type_desc === 'CLUSTERED'
                });
            }

            const constraint = tableConstraints.get(uk.constraint_name)!;
            constraint.columns.push(uk.column_name);
        });

        // Build tables array from our organized data
        const tables: Table[] = [];
        tablesResult.recordset.forEach(tableRow => {
            const tableObjectId = tableRow.object_id;
            const tableSchema = tableRow.table_schema;
            const tableName = tableRow.table_name;
            const tableComment = tableRow.table_comment || '';

            // Process columns for this table
            const tableColumns = columnsByTable.get(tableObjectId) || [];
            const columns: Column[] = tableColumns.map(col => {
                // Map SQL Server types to our ColumnTypeInfo structure
                let typeInfo: ColumnTypeInfo = { kind: 'simple' };

                if (col.data_type === 'varchar' || col.data_type === 'nvarchar') {
                    typeInfo = {
                        kind: 'varchar',
                        length: col.max_length === -1 ? 'MAX' : col.max_length
                    };
                } else if (col.data_type === 'char' || col.data_type === 'nchar') {
                    typeInfo = { kind: 'char', length: col.max_length };
                } else if (col.data_type === 'decimal' || col.data_type === 'numeric') {
                    typeInfo = {
                        kind: 'decimal',
                        precision: col.precision,
                        scale: col.scale
                    };
                }

                // Identity info if it's an identity column
                let identityInfo = undefined;
                if (col.is_identity) {
                    // In a full implementation, we'd look up seed and increment
                    identityInfo = {
                        seed: 1,
                        increment: 1
                    };
                }

                return {
                    type: "column",
                    name: col.column_name,
                    dataType: col.data_type,
                    typeInfo: typeInfo,
                    isNullable: !!col.is_nullable,
                    isIdentity: !!col.is_identity,
                    identityInfo,
                    defaultValue: col.default_value
                };
            });

            // Create constraints array for this table
            const constraints: Constraint[] = [];

            // Add primary key constraints
            const tablePKs = pksByTable.get(tableObjectId);
            if (tablePKs) {
                tablePKs.forEach((pkData, constraintName) => {
                    const pkConstraint: PrimaryKeyConstraint = {
                        type: "constraint",
                        constraintType: "primaryKey",
                        name: constraintName,
                        columns: pkData.columns,
                        clustered: pkData.clustered,
                        rawSql: `PRIMARY KEY ${pkData.clustered ? 'CLUSTERED' : 'NONCLUSTERED'} (${pkData.columns.join(', ')})`
                    };
                    constraints.push(pkConstraint);
                });
            }

            // Add foreign key constraints
            const tableFKs = fksByTable.get(tableObjectId);
            if (tableFKs) {
                tableFKs.forEach(fk => {
                    const fkConstraint: ForeignKeyConstraint = {
                        type: "constraint",
                        constraintType: "foreignKey",
                        name: fk.constraint_name,
                        sourceTable: tableName,
                        sourceSchema: tableSchema,
                        sourceColumn: fk.source_column,
                        referencedTable: fk.target_table,
                        referencedSchema: fk.target_schema,
                        referencedColumn: fk.target_column,
                        rawSql: `FOREIGN KEY (${fk.source_column}) REFERENCES [${fk.target_schema}].[${fk.target_table}](${fk.target_column})`
                    };
                    constraints.push(fkConstraint);
                });
            }

            // Add unique constraints
            const tableUniques = uniquesByTable.get(tableObjectId);
            if (tableUniques) {
                tableUniques.forEach((uniqueData, constraintName) => {
                    const uniqueConstraint: UniqueConstraint = {
                        type: "constraint",
                        constraintType: "unique",
                        name: constraintName,
                        table: tableName,
                        schema: tableSchema,
                        columns: uniqueData.columns,
                        clustered: uniqueData.clustered,
                        rawSql: `UNIQUE ${uniqueData.clustered ? 'CLUSTERED' : 'NONCLUSTERED'} (${uniqueData.columns.join(', ')})`
                    };
                    constraints.push(uniqueConstraint);
                });
            }

            // Create the full table object
            const table: Table = {
                type: "table",
                name: tableName,
                schema: tableSchema,
                comment: tableComment,
                rawSql: '',
                columns,
                constraints,
                fileGroup: undefined
            };

            tables.push(table);
        });

        console.log(`Completed organizing schema data for all ${totalTables} tables`);
        return { tables };
    } catch (error) {
        console.error('Error extracting SQL Server schema:', error);
        throw error;
    } finally {
        console.log('Closing SQL Server connection');
        await pool.close();
    }
}

async function saveDatabase(database: Database, name: string, connectionString: string): Promise<string> {
    console.log(`Starting to save database "${name}" to Supabase (optimized batch operations)`);
    try {
        // 1. Insert the database record
        console.log('Creating database record in Supabase');
        const { data: dbData, error: dbError } = await supabase
            .from('databases')
            .insert({
                name: name,
                type: database.type,
                dialect: database.dialect,
                metadata: { connection_string: connectionString }
            })
            .select()
            .single();

        if (dbError) {
            console.error('Error creating database record:', dbError);
            throw dbError;
        }

        const databaseId = dbData.id;
        console.log(`Database record created with ID: ${databaseId}`);

        // Prepare batch arrays
        const totalTables = database.tables.length;
        console.log(`Preparing batch insert for ${totalTables} tables and their components`);

        // Map to store table IDs by table index
        const tableIdMap = new Map<number, string>();

        // Process tables in batches to avoid overwhelmingly large payloads
        const BATCH_SIZE = 50;
        const totalBatches = Math.ceil(totalTables / BATCH_SIZE);

        for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
            const startIdx = batchNumber * BATCH_SIZE;
            const endIdx = Math.min(startIdx + BATCH_SIZE, totalTables);
            const batchTables = database.tables.slice(startIdx, endIdx);

            console.log(`Processing batch ${batchNumber + 1}/${totalBatches} (tables ${startIdx + 1}-${endIdx})`);

            // 2. Prepare and insert tables batch
            const tableInserts = batchTables.map(table => ({
                database_id: databaseId,
                name: table.name,
                schema: table.schema,
                comment: table.comment || '',
                raw_sql: table.rawSql || '',
                file_group: table.fileGroup || null
            }));

            const { data: tableData, error: tableError } = await supabase
                .from('db_tables')
                .insert(tableInserts)
                .select('id, name, schema');

            if (tableError) {
                console.error(`Error batch inserting tables:`, tableError);
                throw tableError;
            }

            console.log(`Successfully inserted batch of ${tableData.length} tables`);

            // Create a lookup for faster access
            const tableNameToIdMap = new Map<string, string>();
            tableData.forEach(td => {
                tableNameToIdMap.set(`${td.schema}.${td.name}`, td.id);
            });

            // 3. Prepare all columns for this batch of tables
            let allColumnInserts: any[] = [];
            let allConstraintInserts: any[] = [];

            for (let i = 0; i < batchTables.length; i++) {
                const table = batchTables[i];
                const tableId = tableNameToIdMap.get(`${table.schema}.${table.name}`);

                if (!tableId) {
                    console.error(`Could not find ID for inserted table ${table.schema}.${table.name}`);
                    continue;
                }

                // Add columns for this table
                const columnInserts = table.columns.map(column => ({
                    table_id: tableId,
                    name: column.name,
                    data_type: column.dataType,
                    type_info: column.typeInfo,
                    is_nullable: column.isNullable,
                    is_identity: column.isIdentity,
                    identity_info: column.identityInfo || null,
                    default_value: column.defaultValue || null
                }));

                allColumnInserts.push(...columnInserts);

                // Add constraints for this table
                const constraintInserts = table.constraints.map(constraint => {
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
                            const df = constraint as DefaultConstraint;
                            constraintData = {
                                ...constraintData,
                                default_table: df.table,
                                default_schema: df.schema,
                                default_column: df.column,
                                default_value: df.value
                            };
                            break;
                        case 'unique':
                            const uq = constraint as UniqueConstraint;
                            constraintData = {
                                ...constraintData,
                                unique_table: uq.table,
                                unique_schema: uq.schema,
                                unique_columns: uq.columns,
                                unique_clustered: uq.clustered
                            };
                            break;
                        case 'check':
                            const ck = constraint as CheckConstraint;
                            constraintData = {
                                ...constraintData,
                                check_table: ck.table,
                                check_schema: ck.schema,
                                check_expression: ck.expression
                            };
                            break;
                    }

                    return constraintData;
                });

                allConstraintInserts.push(...constraintInserts);
            }

            // Insert columns in batches to avoid payload size limitations
            const COLUMN_BATCH_SIZE = 500;
            const columnBatches = Math.ceil(allColumnInserts.length / COLUMN_BATCH_SIZE);

            console.log(`Inserting ${allColumnInserts.length} columns in ${columnBatches} batches`);

            for (let colBatch = 0; colBatch < columnBatches; colBatch++) {
                const colStartIdx = colBatch * COLUMN_BATCH_SIZE;
                const colEndIdx = Math.min(colStartIdx + COLUMN_BATCH_SIZE, allColumnInserts.length);
                const columnBatch = allColumnInserts.slice(colStartIdx, colEndIdx);

                if (columnBatch.length > 0) {
                    const { error: columnError } = await supabase
                        .from('db_columns')
                        .insert(columnBatch);

                    if (columnError) {
                        console.error(`Error batch inserting columns (batch ${colBatch + 1}/${columnBatches}):`, columnError);
                        throw columnError;
                    }
                }
            }

            console.log(`Successfully inserted all ${allColumnInserts.length} columns`);

            // Insert constraints in batches too
            if (allConstraintInserts.length > 0) {
                const CONSTRAINT_BATCH_SIZE = 500;
                const constraintBatches = Math.ceil(allConstraintInserts.length / CONSTRAINT_BATCH_SIZE);

                console.log(`Inserting ${allConstraintInserts.length} constraints in ${constraintBatches} batches`);

                for (let consBatch = 0; consBatch < constraintBatches; consBatch++) {
                    const consStartIdx = consBatch * CONSTRAINT_BATCH_SIZE;
                    const consEndIdx = Math.min(consStartIdx + CONSTRAINT_BATCH_SIZE, allConstraintInserts.length);
                    const constraintBatch = allConstraintInserts.slice(consStartIdx, consEndIdx);

                    if (constraintBatch.length > 0) {
                        const { error: constraintError } = await supabase
                            .from('db_constraints')
                            .insert(constraintBatch);

                        if (constraintError) {
                            console.error(`Error batch inserting constraints (batch ${consBatch + 1}/${constraintBatches}):`, constraintError);
                            throw constraintError;
                        }
                    }
                }

                console.log(`Successfully inserted all ${allConstraintInserts.length} constraints`);
            } else {
                console.log('No constraints to insert in this batch');
            }
        }

        console.log(`Successfully saved all data for database "${name}" (${totalTables} tables) to Supabase`);
        return databaseId;
    } catch (error) {
        console.error('Error saving database to Supabase:', error);
        throw error;
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { id, name, connectionString } = req.body;
        console.log(`Received request to extract schema for "${name}"${id ? ` (ID: ${id})` : ''}`);

        if (!name || !connectionString) {
            return res.status(400).json({
                success: false,
                message: 'Name and connection string are required'
            });
        }

        // Detect database type
        const dbType = detectDatabaseType(connectionString);
        console.log(`Detected database type: ${dbType}`);

        if (!dbType) {
            return res.status(400).json({
                success: false,
                message: 'Unsupported database type. Currently only PostgreSQL and SQL Server are supported.'
            });
        }

        const dialect: "ansi" | "tsql" = dbType === 'postgresql' ? "ansi" : "tsql";

        // Test connection first
        console.log(`Testing connection to ${dbType} database...`);
        let isConnected = false;
        if (dbType === 'postgresql') {
            isConnected = await testPostgresConnection(connectionString);
        } else if (dbType === 'mssql') {
            isConnected = await testMssqlConnection(connectionString);
        }

        if (!isConnected) {
            console.log(`Connection test failed for ${dbType} database`);
            return res.status(400).json({
                success: false,
                message: `Could not connect to the ${dbType === 'postgresql' ? 'PostgreSQL' : 'SQL Server'} database.`
            });
        }
        console.log(`Connection test successful for ${dbType} database`);

        // Extract schema
        let schemaInfo;
        try {
            console.log(`Starting schema extraction for ${dbType} database...`);
            if (dbType === 'postgresql') {
                schemaInfo = await extractPostgresSchema(connectionString);
            } else if (dbType === 'mssql') {
                schemaInfo = await extractMssqlSchema(connectionString);
            }
            console.log(`Schema extraction completed successfully with ${schemaInfo?.tables.length || 0} tables`);
        } catch (error: any) {
            console.error('Error extracting schema:', error);
            return res.status(500).json({
                success: false,
                message: `Error extracting schema: ${error.message || 'Unknown error'}`
            });
        }

        // If we have an ID, it means the database record already exists
        // Otherwise, save to database
        let databaseId;
        if (id) {
            databaseId = id;
            console.log(`Updating schema for existing database with ID ${id}`);

            // We need to save the schema information for an existing database
            // First, get all existing tables for this database from Supabase
            const { data: existingTables, error: tablesError } = await supabase
                .from('db_tables')
                .select('id')
                .eq('database_id', id);

            if (tablesError) {
                console.error('Error fetching existing tables:', tablesError);
                return res.status(500).json({
                    success: false,
                    message: `Error updating schema: ${tablesError.message}`
                });
            }

            // Delete existing tables (cascade will delete columns and constraints)
            if (existingTables && existingTables.length > 0) {
                const tableIds = existingTables.map(t => t.id);
                console.log(`Deleting ${existingTables.length} existing tables and related data...`);

                // Delete constraints first
                const { error: deleteConstraintsError } = await supabase
                    .from('db_constraints')
                    .delete()
                    .in('table_id', tableIds);

                if (deleteConstraintsError) {
                    console.error('Error deleting constraints:', deleteConstraintsError);
                }

                // Delete columns
                const { error: deleteColumnsError } = await supabase
                    .from('db_columns')
                    .delete()
                    .in('table_id', tableIds);

                if (deleteColumnsError) {
                    console.error('Error deleting columns:', deleteColumnsError);
                }

                // Delete tables
                const { error: deleteTablesError } = await supabase
                    .from('db_tables')
                    .delete()
                    .eq('database_id', id);

                if (deleteTablesError) {
                    console.error('Error deleting tables:', deleteTablesError);
                    return res.status(500).json({
                        success: false,
                        message: `Error updating schema: ${deleteTablesError.message}`
                    });
                }
                console.log('Successfully deleted existing tables and related data');
            }

            // Make sure schemaInfo exists
            if (!schemaInfo || !schemaInfo.tables) {
                return res.status(500).json({
                    success: false,
                    message: 'No schema information available to update the database'
                });
            }

            // Now insert the new tables and related data using optimized batch operations
            const totalTables = schemaInfo.tables.length;
            console.log(`Starting batch insert for ${totalTables} tables and their components`);

            // Process tables in batches to avoid overwhelmingly large payloads
            const BATCH_SIZE = 50;
            const totalBatches = Math.ceil(totalTables / BATCH_SIZE);

            for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
                const startIdx = batchNumber * BATCH_SIZE;
                const endIdx = Math.min(startIdx + BATCH_SIZE, totalTables);
                const batchTables = schemaInfo.tables.slice(startIdx, endIdx);

                console.log(`Processing batch ${batchNumber + 1}/${totalBatches} (tables ${startIdx + 1}-${endIdx})`);

                // Prepare and insert tables batch
                const tableInserts = batchTables.map(table => ({
                    database_id: id,
                    name: table.name,
                    schema: table.schema,
                    comment: table.comment || '',
                    raw_sql: table.rawSql || '',
                    file_group: table.fileGroup || null
                }));

                const { data: tableData, error: tableError } = await supabase
                    .from('db_tables')
                    .insert(tableInserts)
                    .select('id, name, schema');

                if (tableError) {
                    console.error(`Error batch inserting tables:`, tableError);
                    return res.status(500).json({
                        success: false,
                        message: `Error batch inserting tables: ${tableError.message}`
                    });
                }

                console.log(`Successfully inserted batch of ${tableData.length} tables`);

                // Create a lookup for faster access
                const tableNameToIdMap = new Map<string, string>();
                tableData.forEach(td => {
                    tableNameToIdMap.set(`${td.schema}.${td.name}`, td.id);
                });

                // Prepare all columns and constraints for this batch of tables
                let allColumnInserts: any[] = [];
                let allConstraintInserts: any[] = [];

                for (let i = 0; i < batchTables.length; i++) {
                    const table = batchTables[i];
                    const tableId = tableNameToIdMap.get(`${table.schema}.${table.name}`);

                    if (!tableId) {
                        console.error(`Could not find ID for inserted table ${table.schema}.${table.name}`);
                        continue;
                    }

                    // Add columns for this table
                    const columnInserts = table.columns.map(column => ({
                        table_id: tableId,
                        name: column.name,
                        data_type: column.dataType,
                        type_info: column.typeInfo,
                        is_nullable: column.isNullable,
                        is_identity: column.isIdentity,
                        identity_info: column.identityInfo || null,
                        default_value: column.defaultValue || null
                    }));

                    allColumnInserts.push(...columnInserts);

                    // Add constraints for this table
                    const constraintInserts = table.constraints.map(constraint => {
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
                                const df = constraint as DefaultConstraint;
                                constraintData = {
                                    ...constraintData,
                                    default_table: df.table,
                                    default_schema: df.schema,
                                    default_column: df.column,
                                    default_value: df.value
                                };
                                break;
                            case 'unique':
                                const uq = constraint as UniqueConstraint;
                                constraintData = {
                                    ...constraintData,
                                    unique_table: uq.table,
                                    unique_schema: uq.schema,
                                    unique_columns: uq.columns,
                                    unique_clustered: uq.clustered
                                };
                                break;
                            case 'check':
                                const ck = constraint as CheckConstraint;
                                constraintData = {
                                    ...constraintData,
                                    check_table: ck.table,
                                    check_schema: ck.schema,
                                    check_expression: ck.expression
                                };
                                break;
                        }

                        return constraintData;
                    });

                    allConstraintInserts.push(...constraintInserts);
                }

                // Insert columns in batches to avoid payload size limitations
                const COLUMN_BATCH_SIZE = 500;
                const columnBatches = Math.ceil(allColumnInserts.length / COLUMN_BATCH_SIZE);

                console.log(`Inserting ${allColumnInserts.length} columns in ${columnBatches} batches`);

                for (let colBatch = 0; colBatch < columnBatches; colBatch++) {
                    const colStartIdx = colBatch * COLUMN_BATCH_SIZE;
                    const colEndIdx = Math.min(colStartIdx + COLUMN_BATCH_SIZE, allColumnInserts.length);
                    const columnBatch = allColumnInserts.slice(colStartIdx, colEndIdx);

                    if (columnBatch.length > 0) {
                        const { error: columnError } = await supabase
                            .from('db_columns')
                            .insert(columnBatch);

                        if (columnError) {
                            console.error(`Error batch inserting columns (batch ${colBatch + 1}/${columnBatches}):`, columnError);
                            return res.status(500).json({
                                success: false,
                                message: `Error batch inserting columns: ${columnError.message}`
                            });
                        }
                    }
                }

                console.log(`Successfully inserted all ${allColumnInserts.length} columns`);

                // Insert constraints in batches too
                if (allConstraintInserts.length > 0) {
                    const CONSTRAINT_BATCH_SIZE = 500;
                    const constraintBatches = Math.ceil(allConstraintInserts.length / CONSTRAINT_BATCH_SIZE);

                    console.log(`Inserting ${allConstraintInserts.length} constraints in ${constraintBatches} batches`);

                    for (let consBatch = 0; consBatch < constraintBatches; consBatch++) {
                        const consStartIdx = consBatch * CONSTRAINT_BATCH_SIZE;
                        const consEndIdx = Math.min(consStartIdx + CONSTRAINT_BATCH_SIZE, allConstraintInserts.length);
                        const constraintBatch = allConstraintInserts.slice(consStartIdx, consEndIdx);

                        if (constraintBatch.length > 0) {
                            const { error: constraintError } = await supabase
                                .from('db_constraints')
                                .insert(constraintBatch);

                            if (constraintError) {
                                console.error(`Error batch inserting constraints (batch ${consBatch + 1}/${constraintBatches}):`, constraintError);
                                return res.status(500).json({
                                    success: false,
                                    message: `Error batch inserting constraints: ${constraintError.message}`
                                });
                            }
                        }
                    }

                    console.log(`Successfully inserted all ${allConstraintInserts.length} constraints`);
                }
            }
            console.log(`Successfully updated all schema data for database ${id}`);
        } else {
            console.log('Creating new database and saving schema...');
            databaseId = await saveDatabase({
                type: "database",
                dialect: dialect,
                tables: schemaInfo?.tables || [],
                documentation: []
            }, name, connectionString);
            console.log(`New database created with ID ${databaseId}`);
        }

        // Return success
        console.log(`Schema extraction and saving completed successfully for "${name}"`);
        return res.status(200).json({
            success: true,
            id: databaseId,
            name,
            connection_string: connectionString,
            dialect: dbType === 'postgresql' ? 'PostgreSQL' : 'SQL Server',
            tableCount: schemaInfo?.tables.length || 0,
            created_at: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Error extracting database schema:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'An unknown error occurred while extracting the database schema'
        });
    }
} 