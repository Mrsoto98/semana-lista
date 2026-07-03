-- Asegurar tabla solicitudes_lista con RLS correcto
create table if not exists solicitudes_lista (
  id         uuid primary key default gen_random_uuid(),
  lista_id   uuid references listas_compartidas(id) on delete cascade not null,
  usuario_id uuid references usuarios(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(lista_id, usuario_id)
);

alter table solicitudes_lista enable row level security;

-- El usuario puede crear/ver/cancelar su propia solicitud
drop policy if exists "usuario crea solicitud"  on solicitudes_lista;
drop policy if exists "usuario ve solicitud"    on solicitudes_lista;
drop policy if exists "usuario borra solicitud" on solicitudes_lista;
drop policy if exists "admin ve solicitudes"    on solicitudes_lista;
drop policy if exists "admin borra solicitud"   on solicitudes_lista;

create policy "usuario crea solicitud"
  on solicitudes_lista for insert
  with check (auth.uid() = usuario_id);

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

-- Admin y propio usuario pueden borrar (rechazar / retirar)
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

-- Realtime
alter publication supabase_realtime add table solicitudes_lista;

-- ── Función: el admin acepta una solicitud ────────────────────────────────────
-- SECURITY DEFINER para poder insertar un miembro con usuario_id distinto al caller
create or replace function aceptar_solicitud(p_solicitud_id uuid, p_lista_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Solo el admin puede aceptar
  if not exists (
    select 1 from lista_compartida_miembros
    where lista_id = p_lista_id and usuario_id = auth.uid() and rol = 'admin'
  ) then
    raise exception 'Solo el admin puede aceptar solicitudes';
  end if;

  -- Obtener el usuario solicitante
  select usuario_id into v_usuario_id
  from solicitudes_lista
  where id = p_solicitud_id and lista_id = p_lista_id;

  if v_usuario_id is null then
    raise exception 'Solicitud no encontrada';
  end if;

  -- Insertar como miembro (bypass RLS gracias a SECURITY DEFINER)
  insert into lista_compartida_miembros (lista_id, usuario_id, rol)
  values (p_lista_id, v_usuario_id, 'miembro')
  on conflict (lista_id, usuario_id) do nothing;

  -- Borrar la solicitud
  delete from solicitudes_lista where id = p_solicitud_id;
end;
$$;

-- ── Función: el admin expulsa a un miembro ────────────────────────────────────
create or replace function expulsar_miembro(p_lista_id uuid, p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Solo el admin puede expulsar
  if not exists (
    select 1 from lista_compartida_miembros
    where lista_id = p_lista_id and usuario_id = auth.uid() and rol = 'admin'
  ) then
    raise exception 'Solo el admin puede expulsar miembros';
  end if;

  -- El admin no puede expulsarse a sí mismo
  if p_usuario_id = auth.uid() then
    raise exception 'El admin no puede expulsarse. Usa "Abandonar lista".';
  end if;

  delete from lista_compartida_miembros
  where lista_id = p_lista_id and usuario_id = p_usuario_id;
end;
$$;
