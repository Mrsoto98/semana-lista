-- Feedback de usuarios
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete set null,
  mensaje text not null,
  pagina text,
  created_at timestamptz default now()
);
alter table feedback enable row level security;
create policy "usuarios insertan feedback" on feedback for insert
  with check (auth.uid() = usuario_id or usuario_id is null);

-- Eventos de analytics (autoservicio, sin cuenta externa)
create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete set null,
  evento text not null,
  propiedades jsonb default '{}',
  created_at timestamptz default now()
);
alter table eventos enable row level security;
create policy "usuarios insertan eventos" on eventos for insert
  with check (auth.uid() = usuario_id or usuario_id is null);
-- Solo admins pueden leer (sin RLS select = no se expone al cliente)
create policy "nadie lee eventos desde cliente" on eventos for select
  using (false);
