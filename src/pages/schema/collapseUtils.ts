import { Table } from './models';

export const toggleTableCollapse = (
    collapsedTables: Set<string>,
    tableName: string
): Set<string> => {
    const updatedCollapsed = new Set(collapsedTables);
    if (updatedCollapsed.has(tableName)) {
        updatedCollapsed.delete(tableName);
    } else {
        updatedCollapsed.add(tableName);
    }
    return updatedCollapsed;
};

export const collapseAllTables = (tables: Table[]): Set<string> => {
    return new Set(tables.map(table => table.name));
};

export const expandAllTables = (): Set<string> => {
    return new Set();
}; 