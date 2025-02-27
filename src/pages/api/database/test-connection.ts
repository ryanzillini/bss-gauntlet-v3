import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import * as mssql from 'mssql';

// Helper functions
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
        // MySQL is planned but not yet implemented
        return null;
    }
    return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { connectionString } = req.body;

        if (!connectionString) {
            return res.status(400).json({
                success: false,
                message: 'Connection string is required'
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

        // Test the connection based on database type
        let isConnected = false;
        let dialectName = '';

        if (dbType === 'postgresql') {
            isConnected = await testPostgresConnection(connectionString);
            dialectName = 'PostgreSQL';
        } else if (dbType === 'mssql') {
            isConnected = await testMssqlConnection(connectionString);
            dialectName = 'SQL Server';
        }

        if (isConnected) {
            return res.status(200).json({
                success: true,
                dialect: dialectName,
                message: `Successfully connected to ${dialectName} database`
            });
        } else {
            return res.status(400).json({
                success: false,
                message: `Could not connect to the ${dialectName} database.`
            });
        }
    } catch (error: any) {
        console.error('Error testing connection:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'An unknown error occurred while testing the connection'
        });
    }
} 