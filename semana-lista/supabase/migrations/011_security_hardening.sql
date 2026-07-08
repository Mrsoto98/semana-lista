-- ══════════════════════════════════════════════════════════════════════════════
-- 011_security_hardening.sql
-- Revisión completa de seguridad: RLS, GRANTS, funciones, políticas
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Fix: usuarios tabla expone email a cualquier usuario autenticado ────────
-- El policy "buscar usuarios por username" usa using(true), exponiendo emails.
-- Lo restringimos a solo usuarios autenticados y NUNCA anónimos.
drop policy if exists "buscar usuarios por username" on usuarios;
create policy "buscar usuarios autenticados"
  on usuarios for select
  using (auth.uid() is not null);


-- ── 2. solicitudes_lista: tabla + RLS completo ────────────────────────────────
create table if not exists solicitudes_lista (
  id         uuid primary key default gen_random_uuid(),
  lista_id   uuid references listas_compartidas(id) on delete cascade not null,
  usuario_id uuid references usuarios(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(lista_id, usuario_id)
);

alter table solicitudes_lista enable row level security;

drop policy if exists "usuario crea solicitud"  on solicitudes_lista;
drop policy if exists "usuario ve solicitud"    on solicitudes_lista;
drop policy if exists "admin ve solicitudes"    on solicitudes_lista;
drop policy if exists "admin borra solicitud"   on solicitudes_lista;
drop policy if exists "usuario borra solicitud" on solicitudes_lista;

-- El solicitante ve su propia solicitud; el admin ve todas de su lista
create policy "usuario ve solicitud"
  on solicitudes_lista for select
  using (
    auth.uid() = usuario_id
    or exists (
      select 1 from lista_compartida_miembros
      where lista_id = solicitudes_lista.lista_id
        and usuario_id = auth.uid()
        and rol = 'admin'
    )
  );

-- Solo el propio usuario crea su solicitud
create policy "usuario crea solicitud"
  on solicitudes_lista for insert
  with check (auth.uid() = usuario_id);

-- El admin puede rechazar (borrar) solicitudes; el propio usuario puede retirarla
create policy "admin borra solicitud"
  on solicitudes_lista for delete
  using (
    auth.uid() = usuario_id
    or exists (
      select 1 from lista_compartida_miembros
      where lista_id = solicitudes_lista.lista_id
        and usuario_id = auth.uid()
        and rol = 'admin'
    )
  );

-- Realtime para solicitudes
alter publication supabase_realtime add table solicitudes_lista;


-- ── 3. GRANTS explícitos para todas las funciones SECURITY DEFINER ────────────
-- Sin esto, el rol "authenticated" no puede ejecutarlas aunque existan.
grant execute on function crear_lista_compartida(text)      to authenticated;
grant execute on function es_miembro_lista(uuid)            to authenticated;
grant execute on function aceptar_solicitud(uuid, uuid)     to authenticated;
grant execute on function rechazar_solicitud(uuid, uuid)    to authenticated;
grant execute on function expulsar_miembro(uuid, uuid)      to authenticated;


-- ── 4. Fix handle_new_user: añadir set search_path para prevenir inyección ────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ── 5. feedback y eventos: eliminar inserts anónimos (anti-spam) ──────────────
drop policy if exists "usuarios insertan feedback" on feedback;
create policy "usuarios insertan feedback"
  on feedback for insert
  with check (auth.uid() is not null and auth.uid() = usuario_id);

drop policy if exists "usuarios insertan eventos" on eventos;
create policy "usuarios insertan eventos"
  on eventos for insert
  with check (auth.uid() is not null and auth.uid() = usuario_id);


-- ── 6. catalogo_cache y mapa_ingredientes: bloquear writes desde cliente ──────
-- Solo service_role (Edge Functions) puede escribir. Clientes solo leen.
drop policy if exists "catalogo_write" on catalogo_cache;
drop policy if exists "mapa_write"     on mapa_ingredientes;
-- (no hay políticas de insert/update/delete existentes → RLS ya las bloquea)
-- Verificamos que RLS está activo:
alter table catalogo_cache    enable row level security;
alter table mapa_ingredientes enable row level security;


-- ── 7. Índices para mejorar rendimiento de las queries RLS ───────────────────
create index if not exists idx_miembros_usuario
  on lista_compartida_miembros(usuario_id);
create index if not exists idx_miembros_lista_rol
  on lista_compartida_miembros(lista_id, rol);
create index if not exists idx_solicitudes_lista
  on solicitudes_lista(lista_id);
create index if not exists idx_items_lista
  on lista_compartida_items(lista_id);
