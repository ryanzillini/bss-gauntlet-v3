-- Create enum for mapping status
CREATE TYPE mapping_status AS ENUM ('draft', 'approved', 'rejected');

-- Create table for endpoint mappings
CREATE TABLE bss_endpoint_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id INTEGER REFERENCES bss_endpoints(id) ON DELETE CASCADE,
    doc_id UUID REFERENCES bss_mappings(id) ON DELETE CASCADE,
    source_endpoint JSONB NOT NULL,
    field_mappings JSONB NOT NULL,
    confidence_score INTEGER NOT NULL,
    reasoning TEXT,
    status mapping_status DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    metadata JSONB
);

-- Add indexes
CREATE INDEX idx_endpoint_mappings_endpoint_id ON bss_endpoint_mappings(endpoint_id);
CREATE INDEX idx_endpoint_mappings_doc_id ON bss_endpoint_mappings(doc_id);
CREATE INDEX idx_endpoint_mappings_status ON bss_endpoint_mappings(status);

-- Add RLS policies
ALTER TABLE bss_endpoint_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Endpoint mappings are viewable by everyone"
    ON bss_endpoint_mappings FOR SELECT
    USING (true);

CREATE POLICY "Endpoint mappings are insertable by authenticated users only"
    ON bss_endpoint_mappings FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Endpoint mappings are updatable by authenticated users only"
    ON bss_endpoint_mappings FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bss_endpoint_mappings_updated_at
    BEFORE UPDATE ON bss_endpoint_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
