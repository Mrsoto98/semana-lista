-- Listas compartidas entre usuarios

create table if not exists listas_compartidas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null default 'Lista compartida',
  codigo     text unique not null default upper(substring(md5(random()::text), 1, 6)),
  creado_por uuid references usuarios(id) on delete cascade not null,
  created_at timestamptz default now()
);

create table if not exists lista_compartida_miembros (
  lista_id   uuid references listas_compartidas(id) on delete cascade not null,
  usuario_id uuid references usuarios(id) on delete cascade not null,
  rol        text not null default 'miembro' check (rol in ('admin', 'miembro')),
  joined_at  timestamptz default now(),
  primary key (lista_id, usuario_id)
);

create table if not exists lista_compartida_items (
  id        uuid primary key default gen_random_uuid(),
  lista_id  uuid references listas_compartidas(id) on delete cascade not null,
  nombre    text not null,
  cantidad  numeric,
  unidad    text,
  precio    numeric,
  comprado  boolean default false,
  en_casa   boolean default false,
  added_by  uuid references usuarios(id) on delete set null,
  created_at timestamptz default now()
);

-- RLS
alter table listas_compartidas enable row level security;
alter table lista_compartida_miembros enable row level security;
alter table lista_compartida_items enable row level security;

-- listas_compartidas: solo ven y editan los miembros
create policy "miembros ven la lista"
  on listas_compartidas for select
  using (exists (
    select 1 from lista_compartida_miembros
    where lista_id = listas_compartidas.id and usuario_id = auth.uid()
  ));

create policy "miembros actualizan nombre"
  on listas_compartidas for update
  using (exists (
    select 1 from lista_compartida_miembros
    where lista_id = listas_compartidas.id and usuario_id = auth.uid()
  ));

create policy "usuario autenticado crea lista"
  on listas_compartidas for insert
  with check (auth.uid() = creado_por);

create policy "admin borra lista"
  on listas_compartidas for delete
  using (exists (
    select 1 from lista_compartida_miembros
    where lista_id = listas_compartidas.id and usuario_id = auth.uid() and rol = 'admin'
  ));

-- miembros: pueden verse entre ellos si comparten lista
create policy "miembros ven miembros de su lista"
  on lista_compartida_miembros for select
  using (exists (
    select 1 from lista_compartida_miembros m2
    where m2.lista_id = lista_compartida_miembros.lista_id and m2.usuario_id = auth.uid()
  ));

create policy "usuario se une a lista"
  on lista_compartida_miembros for insert
  with check (auth.uid() = usuario_id);

create policy "usuario abandona lista"
  on lista_compartida_miembros for delete
  using (auth.uid() = usuario_id);

-- items: cualquier miembro puede crear/editar/borrar
create policy "miembros ven items"
  on lista_compartida_items for select
  using (exists (
    select 1 from lista_compartida_miembros
    where lista_id = lista_compartida_items.lista_id and usuario_id = auth.uid()
  ));

create policy "miembros insertan items"
  on lista_compartida_items for insert
  with check (exists (
    select 1 from lista_compartida_miembros
    where lista_id = lista_compartida_items.lista_id and usuario_id = auth.uid()
  ));

create policy "miembros actualizan items"
  on lista_compartida_items for update
  using (exists (
    select 1 from lista_compartida_miembros
    where lista_id = lista_compartida_items.lista_id and usuario_id = auth.uid()
  ));

create policy "miembros borran items"
  on lista_compartida_items for delete
  using (exists (
    select 1 from lista_compartida_miembros
    where lista_id = lista_compartida_items.lista_id and usuario_id = auth.uid()
  ));

-- Realtime activado en items para actualizaciones en tiempo real
alter publication supabase_realtime add table lista_compartida_items;
alter publication supabase_realtime add table lista_compartida_miembros;
