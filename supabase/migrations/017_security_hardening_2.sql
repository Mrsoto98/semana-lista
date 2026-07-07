-- ══════════════════════════════════════════════════════════════════════════════
-- 017_security_hardening_2.sql
-- Segunda ronda de endurecimiento de seguridad
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Ocultar email de otros usuarios ────────────────────────────────────────
-- La política anterior permitía que cualquier usuario autenticado viera el
-- email de cualquier otro usuario. Lo reemplazamos por dos políticas:
--   a) Cada usuario lee su propia fila completa (incluyendo email)
--   b) Para búsquedas de otros usuarios, usamos una vista que excluye email

drop policy if exists "buscar usuarios autenticados" on usuarios;

-- Cada usuario puede leer/actualizar su propio registro completo
create policy "usuarios_propia_fila"
  on usuarios for select
  using (auth.uid() = id);

-- Para buscar otros usuarios (amigos, compartir lista) usamos una vista
-- que nunca expone el email
create or replace view usuarios_publicos as
  select id, username, avatar_url, created_at
  from usuarios;

-- Vista accesible para autenticados
grant select on usuarios_publicos to authenticated;


-- ── 2. aprendizaje_picker: anti-spam con 1 voto por usuario por par ──────────
-- Añadimos tracking de usuario para evitar vote stuffing.
-- El usuario_id se almacena pero no es consultable por otros (RLS).

alter table aprendizaje_picker
  add column if not exists usuario_id uuid references auth.users(id) on delete set null;

-- Tabla de votos individuales para evitar duplicados por usuario
create table if not exists picker_votos_usuario (
  usuario_id      uuid references auth.users(id) on delete cascade not null,
  ingrediente     text not null,
  producto_nombre text not null,
  created_at      timestamptz default now(),
  primary key (usuario_id, ingrediente, producto_nombre)
);

alter table picker_votos_usuario enable row level security;

-- Cada usuario solo ve sus propios votos
create policy "picker_votos_own"
  on picker_votos_usuario for select
  using (auth.uid() = usuario_id);

create policy "picker_votos_insert"
  on picker_votos_usuario for insert
  with check (auth.uid() = usuario_id);

-- Restricciones de longitud para evitar inyección de datos largos
alter table aprendizaje_picker
  add constraint if not exists check_ingrediente_len  check (length(ingrediente) <= 200),
  add constraint if not exists check_producto_len     check (length(producto_nombre) <= 200),
  add constraint if not exists check_foto_https       check (producto_foto is null or producto_foto like 'https://%');

-- Función actualizada con verificación de un voto por usuario
create or replace function incrementar_voto_picker(
  p_ingrediente text,
  p_nombre      text,
  p_precio      numeric,
  p_foto        text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Validar longitudes antes de proceder
  if length(p_ingrediente) > 200 or length(p_nombre) > 200 then
    raise exception 'Valor demasiado largo';
  end if;
  if p_foto is not null and p_foto not like 'https://%' then
    raise exception 'URL de foto inválida';
  end if;

  -- Un usuario solo puede votar una vez por cada par (ingrediente, producto)
  insert into picker_votos_usuario (usuario_id, ingrediente, producto_nombre)
  values (v_uid, p_ingrediente, p_nombre)
  on conflict (usuario_id, ingrediente, producto_nombre) do nothing;

  -- Solo incrementar si el insert anterior tuvo efecto (voto nuevo)
  if found then
    insert into aprendizaje_picker (ingrediente, producto_nombre, producto_precio, producto_foto, votos, updated_at)
    values (p_ingrediente, p_nombre, p_precio, p_foto, 1, now())
    on conflict (ingrediente, producto_nombre)
    do update set
      votos      = aprendizaje_picker.votos + 1,
      updated_at = now(),
      producto_precio = coalesce(excluded.producto_precio, aprendizaje_picker.producto_precio),
      producto_foto   = coalesce(excluded.producto_foto,   aprendizaje_picker.producto_foto);
  end if;
end;
$$;

grant execute on function incrementar_voto_picker to authenticated;


-- ── 3. Eliminar política de insert directo en aprendizaje_picker ─────────────
-- Todo debe ir por la función RPC que controla el límite por usuario.
drop policy if exists "picker_insert" on aprendizaje_picker;
drop policy if exists "picker_update" on aprendizaje_picker;

-- Solo la función SECURITY DEFINER (service_role) puede escribir
-- Los clientes solo pueden leer
create policy "picker_solo_lectura"
  on aprendizaje_picker for select
  to authenticated
  using (true);


-- ── 4. Índices de rendimiento para las nuevas tablas ─────────────────────────
create index if not exists idx_picker_votos_usuario
  on picker_votos_usuario(usuario_id, ingrediente);
create index if not exists idx_aprendizaje_ingrediente
  on aprendizaje_picker(ingrediente, votos desc);
