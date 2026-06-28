-- supabase/migrations/001_schema.sql

-- ─── User profile (created by trigger on auth.users insert) ───────────────────
create table if not exists public.usuarios (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.usuarios(id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Perfil ───────────────────────────────────────────────────────────────────
create table if not exists public.perfiles (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid unique references public.usuarios(id) on delete cascade,
  personas         int not null default 2,
  presupuesto      numeric not null default 100,
  codigo_postal    text not null default '28001',
  supermercado     text not null default 'mercadona',
  objetivo         text not null default 'sin_restriccion',
  ingredientes_si  text[] not null default '{}',
  ingredientes_no  text[] not null default '{}',
  nevera           text[] not null default '{}'
);

-- ─── Semanas ──────────────────────────────────────────────────────────────────
create table if not exists public.semanas (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid references public.usuarios(id) on delete cascade,
  fecha_inicio     date not null,
  recetas_elegidas jsonb not null default '{}',
  lista_compra     jsonb not null default '[]',
  total_precio     numeric,
  es_publica       boolean not null default false
);

-- ─── Historial recetas ────────────────────────────────────────────────────────
create table if not exists public.historial_recetas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid references public.usuarios(id) on delete cascade,
  nombre_receta text not null,
  fecha_uso     date not null default current_date
);

-- ─── Catálogo Mercadona (cache compartido, sin RLS) ───────────────────────────
create table if not exists public.catalogo_cache (
  id            uuid primary key default gen_random_uuid(),
  termino       text unique not null,
  payload       jsonb not null,
  actualizado_en timestamptz not null default now()
);

-- ─── Mapa de ingredientes conocidos (cache compartido) ────────────────────────
create table if not exists public.mapa_ingredientes (
  id                     uuid primary key default gen_random_uuid(),
  ingrediente_normalizado text unique not null,
  mercadona_product_id   text,
  confirmado             boolean not null default false
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.usuarios          enable row level security;
alter table public.perfiles          enable row level security;
alter table public.semanas           enable row level security;
alter table public.historial_recetas enable row level security;
alter table public.catalogo_cache    enable row level security;
alter table public.mapa_ingredientes enable row level security;

-- usuarios: solo puede leer/escribir su propia fila
create policy "usuarios_own" on public.usuarios
  using (auth.uid() = id) with check (auth.uid() = id);

-- perfiles: solo su propio perfil
create policy "perfiles_own" on public.perfiles
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- semanas: propio + lectura pública de las marcadas es_publica
create policy "semanas_own" on public.semanas
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "semanas_public_read" on public.semanas
  for select using (es_publica = true);

-- historial: solo propio
create policy "historial_own" on public.historial_recetas
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- catalogo_cache: lectura pública; escritura solo service_role (Edge Functions)
create policy "catalogo_read_all" on public.catalogo_cache
  for select using (true);

-- mapa_ingredientes: lectura pública; escritura solo service_role
create policy "mapa_read_all" on public.mapa_ingredientes
  for select using (true);

-- Index para búsquedas frecuentes
create index if not exists historial_usuario_fecha
  on public.historial_recetas(usuario_id, fecha_uso desc);
create index if not exists catalogo_termino
  on public.catalogo_cache(termino);
