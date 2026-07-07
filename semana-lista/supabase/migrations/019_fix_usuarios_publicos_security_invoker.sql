-- Recrear la vista usuarios_publicos con security_invoker para que RLS de la
-- tabla usuarios se aplique correctamente y no permita enumerar todos los usuarios.
drop view if exists public.usuarios_publicos;

create view public.usuarios_publicos with (security_invoker = true) as
  select id, username, avatar_url, created_at
  from public.usuarios;

grant select on public.usuarios_publicos to authenticated;
