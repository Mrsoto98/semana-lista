-- 019_comunidad.sql — Feed social de recetas

-- Tabla principal de publicaciones
create table if not exists public.publicaciones (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.usuarios(id) on delete cascade,
  tipo         text not null check (tipo in ('receta_app', 'receta_personal', 'foto')),
  -- Si tipo = 'receta_app', referencia opcional al menú
  receta_nombre text,
  -- Contenido
  titulo       text not null check (char_length(titulo) between 1 and 120),
  descripcion  text check (char_length(descripcion) <= 500),
  -- Ingredientes y pasos (solo para receta_personal)
  ingredientes jsonb,   -- [{ nombre, cantidad, unidad }]
  pasos        jsonb,   -- ["paso 1", "paso 2", ...]
  -- Fotos (urls de Supabase Storage)
  fotos        text[] default '{}',
  foto_portada text,    -- primera foto / portada
  -- Privacidad
  visibilidad  text not null default 'publico' check (visibilidad in ('publico', 'amigos', 'privado')),
  -- Métricas
  likes_count  int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Likes
create table if not exists public.publicaciones_likes (
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  usuario_id     uuid not null references public.usuarios(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (publicacion_id, usuario_id)
);

-- Índices
create index if not exists idx_publicaciones_usuario on public.publicaciones(usuario_id);
create index if not exists idx_publicaciones_visibilidad on public.publicaciones(visibilidad, created_at desc);

-- Trigger para updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists publicaciones_updated_at on public.publicaciones;
create trigger publicaciones_updated_at
  before update on public.publicaciones
  for each row execute function public.set_updated_at();

-- Trigger para mantener likes_count
create or replace function public.actualizar_likes_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.publicaciones set likes_count = likes_count + 1 where id = new.publicacion_id;
  elsif tg_op = 'DELETE' then
    update public.publicaciones set likes_count = greatest(0, likes_count - 1) where id = old.publicacion_id;
  end if;
  return null;
end; $$;

drop trigger if exists likes_count_trigger on public.publicaciones_likes;
create trigger likes_count_trigger
  after insert or delete on public.publicaciones_likes
  for each row execute function public.actualizar_likes_count();

-- RLS
alter table public.publicaciones enable row level security;
alter table public.publicaciones_likes enable row level security;

-- Ver publicaciones públicas: cualquiera autenticado
create policy "ver_publicas" on public.publicaciones for select
  using (
    visibilidad = 'publico'
    or usuario_id = auth.uid()
    or (
      visibilidad = 'amigos'
      and exists (
        select 1 from public.amistades
        where estado = 'aceptada'
          and ((solicitante_id = auth.uid() and receptor_id = usuario_id)
            or (receptor_id = auth.uid() and solicitante_id = usuario_id))
      )
    )
  );

-- Crear: solo el propio usuario
create policy "crear_propia" on public.publicaciones for insert
  with check (usuario_id = auth.uid());

-- Editar/borrar: solo el propio usuario
create policy "editar_propia" on public.publicaciones for update
  using (usuario_id = auth.uid());

create policy "borrar_propia" on public.publicaciones for delete
  using (usuario_id = auth.uid());

-- Likes: ver los propios
create policy "ver_likes" on public.publicaciones_likes for select
  using (usuario_id = auth.uid());

create policy "dar_like" on public.publicaciones_likes for insert
  with check (usuario_id = auth.uid());

create policy "quitar_like" on public.publicaciones_likes for delete
  using (usuario_id = auth.uid());
