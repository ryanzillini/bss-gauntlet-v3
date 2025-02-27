-- Create tables for schema mappings and documentation

-- Table for databases (create this first since other tables reference it)
CREATE TABLE databases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL DEFAULT 'database',
    dialect VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Table for database tables
CREATE TABLE db_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    schema VARCHAR(255) NOT NULL,
    comment TEXT,
    raw_sql TEXT,
    file_group VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for columns
CREATE TABLE db_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES db_tables(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    data_type VARCHAR(100) NOT NULL,
    -- JSON field to store all type info variants
    type_info JSONB NOT NULL,
    is_nullable BOOLEAN NOT NULL DEFAULT true,
    is_identity BOOLEAN NOT NULL DEFAULT false,
    -- JSON field to store identity info (seed and increment)
    identity_info JSONB,
    default_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for constraints with discriminator pattern
CREATE TABLE db_constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES db_tables(id) ON DELETE CASCADE,
    constraint_type VARCHAR(50) NOT NULL, -- 'primaryKey', 'foreignKey', 'default', 'unique', 'check'
    name VARCHAR(255) NOT NULL,
    raw_sql TEXT,
    
    -- Primary Key specific fields
    pk_columns JSONB, -- Array of column names
    pk_clustered BOOLEAN,
    pk_file_group VARCHAR(255),
    
    -- Foreign Key specific fields
    fk_source_table VARCHAR(255),
    fk_source_schema VARCHAR(255),
    fk_source_column VARCHAR(255),
    fk_referenced_table VARCHAR(255),
    fk_referenced_schema VARCHAR(255),
    fk_referenced_column VARCHAR(255),
    
    -- Default constraint specific fields
    default_table VARCHAR(255),
    default_schema VARCHAR(255),
    default_column VARCHAR(255),
    default_value TEXT,
    
    -- Unique constraint specific fields
    unique_table VARCHAR(255),
    unique_schema VARCHAR(255),
    unique_columns JSONB, -- Array of column names
    unique_clustered BOOLEAN,
    
    -- Check constraint specific fields
    check_table VARCHAR(255),
    check_schema VARCHAR(255),
    check_expression TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for schema mappings
CREATE TABLE schema_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    target_database UUID REFERENCES databases(id),
    source_database UUID REFERENCES databases(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Table for schema mapping entries (individual field mappings)
CREATE TABLE schema_mapping_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_mapping_id UUID REFERENCES schema_mappings(id) ON DELETE CASCADE,
    target_table VARCHAR(255) NOT NULL,
    target_column VARCHAR(255) NOT NULL,
    transformation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for mapping sources (source columns for each mapping entry)
CREATE TABLE schema_mapping_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapping_entry_id UUID REFERENCES schema_mapping_entries(id) ON DELETE CASCADE,
    source_database UUID REFERENCES databases(id),
    source_table VARCHAR(255) NOT NULL,
    source_column VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for database documentation
CREATE TABLE database_documentation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    s3_location VARCHAR(1024) NOT NULL,
    type VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Junction table for many-to-many relationship between schema_mappings and databases
CREATE TABLE schema_mapping_databases (
    schema_mapping_id UUID REFERENCES schema_mappings(id) ON DELETE CASCADE,
    database_id UUID REFERENCES databases(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (schema_mapping_id, database_id)
);

-- Junction table for many-to-many relationship between databases and documentation
CREATE TABLE database_documentation_rel (
    database_id UUID REFERENCES databases(id) ON DELETE CASCADE,
    documentation_id UUID REFERENCES database_documentation(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (database_id, documentation_id)
);

-- Add indexes for performance
CREATE INDEX idx_db_tables_database_id ON db_tables(database_id);
CREATE INDEX idx_db_columns_table_id ON db_columns(table_id);
CREATE INDEX idx_db_constraints_table_id ON db_constraints(table_id);
CREATE INDEX idx_schema_mapping_entries_mapping_id ON schema_mapping_entries(schema_mapping_id);
CREATE INDEX idx_schema_mapping_sources_entry_id ON schema_mapping_sources(mapping_entry_id);
CREATE INDEX idx_schema_mapping_databases_mapping_id ON schema_mapping_databases(schema_mapping_id);
CREATE INDEX idx_schema_mapping_databases_database_id ON schema_mapping_databases(database_id);
CREATE INDEX idx_database_documentation_rel_database_id ON database_documentation_rel(database_id);
CREATE INDEX idx_database_documentation_rel_documentation_id ON database_documentation_rel(documentation_id);

-- Add RLS policies
ALTER TABLE databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_mapping_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_mapping_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_documentation_rel ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_mapping_databases ENABLE ROW LEVEL SECURITY;

-- Create policies for all tables
-- Databases
CREATE POLICY "Databases are viewable by everyone"
    ON databases FOR SELECT
    USING (true);

CREATE POLICY "Databases are insertable by authenticated users only"
    ON databases FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Databases are updatable by authenticated users only"
    ON databases FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Database Tables
CREATE POLICY "DB Tables are viewable by everyone"
    ON db_tables FOR SELECT
    USING (true);

CREATE POLICY "DB Tables are insertable by authenticated users only"
    ON db_tables FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "DB Tables are updatable by authenticated users only"
    ON db_tables FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Columns
CREATE POLICY "DB Columns are viewable by everyone"
    ON db_columns FOR SELECT
    USING (true);

CREATE POLICY "DB Columns are insertable by authenticated users only"
    ON db_columns FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "DB Columns are updatable by authenticated users only"
    ON db_columns FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Constraints
CREATE POLICY "DB Constraints are viewable by everyone"
    ON db_constraints FOR SELECT
    USING (true);

CREATE POLICY "DB Constraints are insertable by authenticated users only"
    ON db_constraints FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "DB Constraints are updatable by authenticated users only"
    ON db_constraints FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Schema mappings
CREATE POLICY "Schema mappings are viewable by everyone"
    ON schema_mappings FOR SELECT
    USING (true);

CREATE POLICY "Schema mappings are insertable by authenticated users only"
    ON schema_mappings FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Schema mappings are updatable by authenticated users only"
    ON schema_mappings FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Schema mapping entries
CREATE POLICY "Schema mapping entries are viewable by everyone"
    ON schema_mapping_entries FOR SELECT
    USING (true);

CREATE POLICY "Schema mapping entries are insertable by authenticated users only"
    ON schema_mapping_entries FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Schema mapping entries are updatable by authenticated users only"
    ON schema_mapping_entries FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Schema mapping sources
CREATE POLICY "Schema mapping sources are viewable by everyone"
    ON schema_mapping_sources FOR SELECT
    USING (true);

CREATE POLICY "Schema mapping sources are insertable by authenticated users only"
    ON schema_mapping_sources FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Database documentation
CREATE POLICY "Database documentation are viewable by everyone"
    ON database_documentation FOR SELECT
    USING (true);

CREATE POLICY "Database documentation are insertable by authenticated users only"
    ON database_documentation FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Database documentation are updatable by authenticated users only"
    ON database_documentation FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Relationship policies
CREATE POLICY "Schema mapping database relations are viewable by everyone"
    ON schema_mapping_databases FOR SELECT
    USING (true);

CREATE POLICY "Schema mapping database relations are insertable by authenticated users only"
    ON schema_mapping_databases FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Database documentation relations are viewable by everyone"
    ON database_documentation_rel FOR SELECT
    USING (true);

CREATE POLICY "Database documentation relations are insertable by authenticated users only"
    ON database_documentation_rel FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Add triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_databases_updated_at
    BEFORE UPDATE ON databases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_db_tables_updated_at
    BEFORE UPDATE ON db_tables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_db_columns_updated_at
    BEFORE UPDATE ON db_columns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_db_constraints_updated_at
    BEFORE UPDATE ON db_constraints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schema_mappings_updated_at
    BEFORE UPDATE ON schema_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schema_mapping_entries_updated_at
    BEFORE UPDATE ON schema_mapping_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_database_documentation_updated_at
    BEFORE UPDATE ON database_documentation
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 