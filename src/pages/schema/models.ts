// Root database structure
export interface Database {
    type: "database"
    dialect: "tsql" | "ansi"
    tables: Table[]
    documentation?: Documentation[] // Optional array of documentation
}
// Table structure
export interface Table {
    type: "table"
    name: string
    schema: string
    comment: string
    rawSql: string
    columns: Column[]
    constraints: Constraint[]
    indices?: Index[] // Optional array of indices
    fileGroup?: string
}
// Column structure
export interface Column {
    type: "column"
    name: string
    dataType: string
    typeInfo: ColumnTypeInfo
    isNullable: boolean
    isIdentity: boolean
    identityInfo?: IdentityInfo
    defaultValue?: string
}
// Type information for columns
export type ColumnTypeInfo =
    | { kind: "varchar"; length: number | null }
    | { kind: "nvarchar"; length: number | null }
    | { kind: "char"; length: number | null }
    | { kind: "numeric"; precision: number | null; scale: number | null }
    | { kind: "decimal"; precision: number | null; scale: number | null }
    | { kind: "datetime" }
    | { kind: "money" }
    | { kind: "bit" }
    | { kind: "ntext" }
    | { kind: "simple" } // For int, bigint, smallint, etc.
// Identity information
export interface IdentityInfo {
    seed: number
    increment: number
}
// Constraint union type
export type Constraint =
    | PrimaryKeyConstraint
    | ForeignKeyConstraint
    | DefaultConstraint
    | UniqueConstraint
    | CheckConstraint
// Primary Key constraint
export interface PrimaryKeyConstraint {
    type: "constraint"
    constraintType: "primaryKey"
    name: string
    columns: string[]
    rawSql: string
    clustered?: boolean
    fileGroup?: string
}
// Foreign Key constraint
export interface ForeignKeyConstraint {
    type: "constraint"
    constraintType: "foreignKey"
    name: string
    sourceTable: string
    sourceSchema: string
    sourceColumn: string
    referencedTable: string
    referencedSchema: string
    referencedColumn: string
    rawSql: string
}
// Default constraint
export interface DefaultConstraint {
    type: "constraint"
    constraintType: "default"
    name: string
    table: string
    schema: string
    column: string
    value: string
    rawSql: string
}
// Unique constraint
export interface UniqueConstraint {
    type: "constraint"
    constraintType: "unique"
    name: string
    table: string
    schema: string
    columns: string[]
    clustered?: boolean
    rawSql: string
}
// Check constraint
export interface CheckConstraint {
    type: "constraint"
    constraintType: "check"
    name: string
    table: string
    schema: string
    expression: string
    rawSql: string
}

// Schema mapping structure
export interface SchemaMapping {
    type: "schemaMapping"
    id: string
    name: string
    databases: Database[] // Many-to-many relationship with databases
    mappings: MappingEntry[] // Collection of mappings for this schema mapping
    createdAt?: Date
    updatedAt?: Date
}

// Mapping entry structure (based on Mapping interface in schema-mapping.tsx)
export interface MappingEntry {
    id: string
    targetTable: string
    targetColumn: string
    transformation?: string // Optional transformation expression
    sources: MappingSource[]
}

// Source definition for a mapping
export interface MappingSource {
    id: string
    table: string
    column: string
}

// Documentation structure for databases
export interface Documentation {
    id: string
    name: string
    s3Location: string // S3 file location
    type: string // Type of documentation (e.g., "database schema", "API specs")
    description?: string // Optional description
    createdAt?: Date
    updatedAt?: Date
}

// Index structure
export interface Index {
    type: "index"
    name: string
    table: string
    schema: string
    columns: string[]
    isUnique: boolean
    isClustered?: boolean
    includeColumns?: string[] // Columns included but not part of the key
    filterExpression?: string // For filtered indices
    rawSql: string
    fileGroup?: string
}