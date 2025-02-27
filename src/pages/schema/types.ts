import { Database } from './models';

export interface Mapping<DbKeys extends string = string> {
    type: "mapping";
    in: Record<DbKeys, Database>;
    out: Database;
    columnMappings: ColumnMapping<DbKeys>[];
}

export interface SourceColumn<DbKey extends string = string> {
    databaseId: DbKey;
    schema: string;
    table: string;
    column: string;
}

export interface ColumnMapping<DbKeys extends string = string> {
    sources: SourceColumn<DbKeys>[];
    destinationSchema: string;
    destinationTable: string;
    destinationColumn: string;
    transform?: string;
}

export interface MappingStats {
    totalColumns: number;
    mappedColumns: number;
    percentMapped: number;
}

export interface CondensedMapping {
    id: string;
    targetSchema: string;
    targetTable: string;
    targetColumn: string;
    transformation?: string;
    sources: {
        id: string;
        databaseId: string;
        schema: string;
        table: string;
        column: string;
    }[];
} 