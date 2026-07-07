-- Función que crea la lista y añade el creador como admin en una sola transacción.
-- SECURITY DEFINER evita problemas de RLS en el INSERT.
create or replace function crear_lista_compartida(p_nombre text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_cod  text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Asegurar que el usuario existe en la tabla usuarios
  insert into usuarios (id, email)
  values (auth.uid(), (select email from auth.users where id = auth.uid()))
  on conflict (id) do nothing;

  -- Crear la lista
  insert into listas_compartidas (nombre, creado_por)
  values (p_nombre, auth.uid())
  returning id, codigo into v_id, v_cod;

  -- Añadir creador como admin
  insert into lista_compartida_miembros (lista_id, usuario_id, rol)
  values (v_id, auth.uid(), 'admin');

  return json_build_object('id', v_id, 'codigo', v_cod, 'nombre', p_nombre, 'creado_por', auth.uid());
end;
$$;
