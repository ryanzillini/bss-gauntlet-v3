import { Database, Table } from './models';

export const getTablesFromDb = (db: Database | null): Table[] => {
    if (!db) return [];
    return db.tables || [];
};

export const getTargetTables = (targetDatabase: Database | null): Table[] => {
    return getTablesFromDb(targetDatabase);
};

export const getAllSourceTables = (sourceDatabases: Map<string, Database>): { dbId: string, table: Table }[] => {
    const allTables: { dbId: string, table: Table }[] = [];
    sourceDatabases.forEach((db, dbId) => {
        const tables = getTablesFromDb(db);
        tables.forEach(table => {
            allTables.push({ dbId, table });
        });
    });
    return allTables;
};

export const filterTablesBySearchTerm = (tables: Table[], searchTerm: string): Table[] => {
    return tables.filter(table =>
        table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        table.columns.some(col => col.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
}; 