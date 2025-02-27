import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../utils/supabase-client';
import { Pool } from 'pg';
import * as mssql from 'mssql';
import { Database, Table, Column, Constraint, ColumnTypeInfo, PrimaryKeyConstraint, ForeignKeyConstraint, DefaultConstraint, UniqueConstraint, CheckConstraint } from '../../../pages/schema/models';

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

// Helper function to parse a connection string into MSSQL config
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
        const config = parseMssqlConnectionString(connectionString);
        const pool = new mssql.ConnectionPool(config);
        await pool.connect();
        await pool.request().query('SELECT 1 as test');
        await pool.close();
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
    const config = parseMssqlConnectionString(connectionString);
    const pool = new mssql.ConnectionPool(config);

    try {
        await pool.connect();

        // Get all tables
        const tablesResult = await pool.request().query(`
      SELECT 
        s.name as table_schema,
        t.name as table_name,
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

        const tables: Table[] = [];

        // Process tables
        for (const tableRow of tablesResult.recordset) {
            const tableSchema = tableRow.table_schema;
            const tableName = tableRow.table_name;
            const tableComment = tableRow.table_comment || '';

            // Get columns for this table
            const columnsResult = await pool.request()
                .input('schema', mssql.NVarChar, tableSchema)
                .input('table', mssql.NVarChar, tableName)
                .query(`
        SELECT 
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
        WHERE 
          s.name = @schema AND
          tbl.name = @table
        ORDER BY 
          c.column_id
      `);

            // Process columns
            const columns: Column[] = columnsResult.recordset.map(col => {
                // Map SQL Server types to our ColumnTypeInfo structure
                let typeInfo: ColumnTypeInfo = { kind: 'simple' };

                if (col.data_type === 'varchar' || col.data_type === 'nvarchar') {
                    // For nvarchar, max_length is in bytes and accounts for unicode (x2)
                    const length = col.data_type === 'nvarchar'
                        ? (col.max_length === -1 ? null : col.max_length / 2)
                        : (col.max_length === -1 ? null : col.max_length);

                    typeInfo = {
                        kind: col.data_type === 'varchar' ? 'varchar' : 'nvarchar',
                        length
                    };
                } else if (col.data_type === 'char') {
                    typeInfo = { kind: 'char', length: col.max_length };
                } else if (col.data_type === 'numeric' || col.data_type === 'decimal') {
                    typeInfo = {
                        kind: col.data_type === 'numeric' ? 'numeric' : 'decimal',
                        precision: col.precision,
                        scale: col.scale
                    };
                } else if (col.data_type === 'datetime') {
                    typeInfo = { kind: 'datetime' };
                } else if (col.data_type === 'money') {
                    typeInfo = { kind: 'money' };
                } else if (col.data_type === 'bit') {
                    typeInfo = { kind: 'bit' };
                } else if (col.data_type === 'ntext') {
                    typeInfo = { kind: 'ntext' };
                }

                // Identity info for identity columns
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

            // Get primary key constraints
            const primaryKeysResult = await pool.request()
                .input('schema', mssql.NVarChar, tableSchema)
                .input('table', mssql.NVarChar, tableName)
                .query(`
        SELECT 
          i.name as constraint_name,
          c.name as column_name,
          i.is_primary_key,
          i.is_unique_constraint,
          i.type_desc
        FROM 
          sys.indexes i 
          INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
          INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          INNER JOIN sys.tables t ON i.object_id = t.object_id
          INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE 
          i.is_primary_key = 1 AND
          s.name = @schema AND
          t.name = @table
        ORDER BY 
          ic.key_ordinal
      `);

            // Get foreign key constraints
            const foreignKeysResult = await pool.request()
                .input('schema', mssql.NVarChar, tableSchema)
                .input('table', mssql.NVarChar, tableName)
                .query(`
        SELECT 
          fk.name as constraint_name,
          COL_NAME(fkc.parent_object_id, fkc.parent_column_id) as source_column,
          OBJECT_SCHEMA_NAME(fkc.referenced_object_id) as target_schema,
          OBJECT_NAME(fkc.referenced_object_id) as target_table,
          COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) as target_column
        FROM 
          sys.foreign_keys fk
          INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
          INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
          INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE 
          s.name = @schema AND
          t.name = @table
      `);

            // Get unique constraints
            const uniqueKeysResult = await pool.request()
                .input('schema', mssql.NVarChar, tableSchema)
                .input('table', mssql.NVarChar, tableName)
                .query(`
        SELECT 
          i.name as constraint_name,
          c.name as column_name,
          i.type_desc
        FROM 
          sys.indexes i 
          INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
          INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          INNER JOIN sys.tables t ON i.object_id = t.object_id
          INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE 
          i.is_unique_constraint = 1 AND
          s.name = @schema AND
          t.name = @table
        ORDER BY 
          ic.key_ordinal
      `);

            // Create constraints array
            const constraints: Constraint[] = [];

            // Process primary keys
            if (primaryKeysResult.recordset.length > 0) {
                // Group by constraint name
                const pkConstraints: Record<string, { columns: string[], clustered: boolean }> = {};
                primaryKeysResult.recordset.forEach(row => {
                    if (!pkConstraints[row.constraint_name]) {
                        pkConstraints[row.constraint_name] = {
                            columns: [],
                            clustered: row.type_desc === 'CLUSTERED'
                        };
                    }
                    pkConstraints[row.constraint_name].columns.push(row.column_name);
                });

                // Create a primary key constraint for each group
                Object.entries(pkConstraints).forEach(([name, { columns, clustered }]) => {
                    const pkConstraint: PrimaryKeyConstraint = {
                        type: "constraint",
                        constraintType: "primaryKey",
                        name,
                        columns,
                        clustered,
                        rawSql: `PRIMARY KEY ${clustered ? 'CLUSTERED' : 'NONCLUSTERED'} (${columns.join(', ')})`
                    };
                    constraints.push(pkConstraint);
                });
            }

            // Process foreign keys
            foreignKeysResult.recordset.forEach(row => {
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
                    rawSql: `FOREIGN KEY (${row.source_column}) REFERENCES [${row.target_schema}].[${row.target_table}](${row.target_column})`
                };
                constraints.push(fkConstraint);
            });

            // Process unique constraints
            if (uniqueKeysResult.recordset.length > 0) {
                // Group by constraint name
                const uniqueConstraints: Record<string, { columns: string[], clustered: boolean }> = {};
                uniqueKeysResult.recordset.forEach(row => {
                    if (!uniqueConstraints[row.constraint_name]) {
                        uniqueConstraints[row.constraint_name] = {
                            columns: [],
                            clustered: row.type_desc === 'CLUSTERED'
                        };
                    }
                    uniqueConstraints[row.constraint_name].columns.push(row.column_name);
                });

                // Create a unique constraint for each group
                Object.entries(uniqueConstraints).forEach(([name, { columns, clustered }]) => {
                    const uniqueConstraint: UniqueConstraint = {
                        type: "constraint",
                        constraintType: "unique",
                        name,
                        table: tableName,
                        schema: tableSchema,
                        columns,
                        clustered,
                        rawSql: `UNIQUE ${clustered ? 'CLUSTERED' : 'NONCLUSTERED'} (${columns.join(', ')})`
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
        }

        return { tables };
    } catch (error) {
        console.error('Error extracting SQL Server schema:', error);
        throw error;
    } finally {
        await pool.close();
    }
}

async function saveDatabase(name: string, dbType: string, connectionString: string): Promise<string> {
    try {
        const dialect: "ansi" | "tsql" = dbType === 'postgresql' ? "ansi" : "tsql";

        // Insert the database record
        const { data: dbData, error: dbError } = await supabase
            .from('databases')
            .insert({
                name: name,
                type: "database",
                dialect: dialect,
                metadata: { connection_string: connectionString }
            })
            .select()
            .single();

        if (dbError) {
            console.error('Error creating database record:', dbError);
            throw dbError;
        }

        return dbData.id;
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
        const { name, connectionString } = req.body;

        if (!name || !connectionString) {
            return res.status(400).json({
                success: false,
                message: 'Name and connection string are required'
            });
        }

        // Detect database type
        const dbType = detectDatabaseType(connectionString);

        if (!dbType) {
            return res.status(400).json({
                success: false,
                message: 'Unsupported database type. Currently only PostgreSQL and SQL Server are supported.'
            });
        }

        // Test connection first
        let isConnected = false;
        if (dbType === 'postgresql') {
            isConnected = await testPostgresConnection(connectionString);
        } else if (dbType === 'mssql') {
            isConnected = await testMssqlConnection(connectionString);
        }

        if (!isConnected) {
            return res.status(400).json({
                success: false,
                message: `Could not connect to the ${dbType === 'postgresql' ? 'PostgreSQL' : 'SQL Server'} database.`
            });
        }

        // Save to database without extracting schema
        const databaseId = await saveDatabase(name, dbType, connectionString);

        // Return success
        return res.status(200).json({
            success: true,
            id: databaseId,
            name,
            connection_string: connectionString,
            dialect: dbType === 'postgresql' ? 'PostgreSQL' : 'SQL Server',
            created_at: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Error adding database connection:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'An unknown error occurred while adding the database connection'
        });
    }
} 