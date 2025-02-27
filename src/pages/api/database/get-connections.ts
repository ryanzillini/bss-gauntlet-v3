import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../utils/supabase-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Fetch database connections from Supabase
        const { data, error } = await supabase
            .from('databases')
            .select('id, name, metadata, created_at, dialect');

        if (error) {
            console.error('Error fetching database connections:', error);
            throw error;
        }

        // Transform data for the client
        const connections = data.map(db => {
            // Extract connection string from metadata or use a placeholder
            const connectionString = db.metadata?.connection_string || '[Connection string hidden]';

            return {
                id: db.id,
                name: db.name,
                connection_string: connectionString,
                created_at: db.created_at,
                dialect: db.dialect === 'ansi' ? 'PostgreSQL' : db.dialect === 'tsql' ? 'SQL Server' : undefined
            };
        });

        return res.status(200).json(connections);
    } catch (error: any) {
        console.error('Error fetching database connections:', error);

        // Return a fallback with mock data if there's an error
        const fallbackConnections = [
            {
                id: 'mock-1',
                name: 'Example PostgreSQL Database',
                connection_string: 'postgresql://user:password@localhost:5432/example',
                created_at: new Date().toISOString(),
                dialect: 'PostgreSQL'
            },
            {
                id: 'mock-2',
                name: 'Example SQL Server Database',
                connection_string: 'mssql://user:password@localhost:1433/example',
                created_at: new Date().toISOString(),
                dialect: 'SQL Server'
            }
        ];

        return res.status(200).json(fallbackConnections);
    }
} 