create table if not exists public.tmf_endpoints (
  id uuid default uuid_generate_v4() primary key,
  path text not null,
  method text not null,
  version text not null,
  description text,
  parameters jsonb,
  responses jsonb,
  required_fields text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create unique constraint on path and method combination
create unique index if not exists tmf_endpoints_path_method_idx on public.tmf_endpoints (path, method);

-- Add RLS policies
alter table public.tmf_endpoints enable row level security;

create policy "TMF endpoints are viewable by everyone"
  on public.tmf_endpoints for select
  using (true);

create policy "TMF endpoints are insertable by authenticated users only"
  on public.tmf_endpoints for insert
  with check (auth.role() = 'authenticated');

create policy "TMF endpoints are updatable by authenticated users only"
  on public.tmf_endpoints for update
  using (auth.role() = 'authenticated');

-- Create function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at timestamp
create trigger handle_tmf_endpoints_updated_at
  before update on public.tmf_endpoints
  for each row
  execute function public.handle_updated_at(); 