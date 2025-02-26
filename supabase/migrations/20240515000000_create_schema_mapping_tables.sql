-- Create table for storing database schemas
create table if not exists public.database_schemas (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  content jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Set up row-level security for database_schemas
alter table public.database_schemas enable row level security;

create policy "Database schemas are viewable by everyone"
on public.database_schemas for select
using (true);

create policy "Database schemas are insertable by authenticated users only"
on public.database_schemas for insert
with check (auth.role() = 'authenticated');

create policy "Database schemas are updatable by authenticated users only"
on public.database_schemas for update
using (auth.role() = 'authenticated');

-- Create trigger for updated_at
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_database_schemas_updated_at
before update on public.database_schemas
for each row execute procedure handle_updated_at();

-- Create table for storing schema mappings
create table if not exists public.schema_mappings (
  id uuid primary key default uuid_generate_v4(),
  database_schema_id uuid not null references public.database_schemas(id) on delete cascade,
  tmf_class_id text not null,
  mappings jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Set up row-level security for schema_mappings
alter table public.schema_mappings enable row level security;

create policy "Schema mappings are viewable by everyone"
on public.schema_mappings for select
using (true);

create policy "Schema mappings are insertable by authenticated users only"
on public.schema_mappings for insert
with check (auth.role() = 'authenticated');

create policy "Schema mappings are updatable by authenticated users only"
on public.schema_mappings for update
using (auth.role() = 'authenticated');

create policy "Schema mappings are deletable by authenticated users only"
on public.schema_mappings for delete
using (auth.role() = 'authenticated');

create trigger handle_schema_mappings_updated_at
before update on public.schema_mappings
for each row execute procedure handle_updated_at(); 