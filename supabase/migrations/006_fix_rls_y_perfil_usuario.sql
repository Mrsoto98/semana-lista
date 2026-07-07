-- ── 1. FIX: Recursión infinita en RLS de lista_compartida_miembros ──────────

-- Función security definer para comprobar membresía SIN disparar RLS
create or replace function es_miembro_lista(p_lista_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from lista_compartida_miembros
    where lista_id = p_lista_id and usuario_id = auth.uid()
  );
$$;

-- Eliminar policies problemáticas y recrearlas usando la función
drop policy if exists "miembros ven la lista"            on listas_compartidas;
drop policy if exists "miembros actualizan nombre"       on listas_compartidas;
drop policy if exists "admin borra lista"                on listas_compartidas;
drop policy if exists "miembros ven miembros de su lista" on lista_compartida_miembros;
drop policy if exists "miembros ven items"               on lista_compartida_items;
drop policy if exists "miembros insertan items"          on lista_compartida_items;
drop policy if exists "miembros actualizan items"        on lista_compartida_items;
drop policy if exists "miembros borran items"            on lista_compartida_items;

create policy "miembros ven la lista"
  on listas_compartidas for select
  using (es_miembro_lista(id));

create policy "miembros actualizan nombre"
  on listas_compartidas for update
  using (es_miembro_lista(id));

create policy "admin borra lista"
  on listas_compartidas for delete
  using (
    exists (
      select 1 from lista_compartida_miembros
      where lista_id = listas_compartidas.id
        and usuario_id = auth.uid()
        and rol = 'admin'
    )
  );

create policy "miembros ven miembros de su lista"
  on lista_compartida_miembros for select
  using (es_miembro_lista(lista_id));

create policy "miembros ven items"
  on lista_compartida_items for select
  using (es_miembro_lista(lista_id));

create policy "miembros insertan items"
  on lista_compartida_items for insert
  with check (es_miembro_lista(lista_id));

create policy "miembros actualizan items"
  on lista_compartida_items for update
  using (es_miembro_lista(lista_id));

create policy "miembros borran items"
  on lista_compartida_items for delete
  using (es_miembro_lista(lista_id));


-- ── 2. Perfil de usuario enriquecido ─────────────────────────────────────────

alter table usuarios
  add column if not exists nombre_display text,
  add column if not exists username       text unique,
  add column if not exists avatar_emoji   text default '🧑';

-- username solo letras, números y guiones bajos, 3-20 chars
alter table usuarios
  drop constraint if exists usuarios_username_format;
alter table usuarios
  add constraint usuarios_username_format
  check (username is null or username ~ '^[a-zA-Z0-9_]{3,20}$');
