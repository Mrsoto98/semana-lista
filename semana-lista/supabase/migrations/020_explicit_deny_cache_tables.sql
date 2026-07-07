-- Políticas explícitas de denegación de escritura en tablas de caché.
-- Las lecturas siguen permitidas (catalogo_read_all / mapa_read_all).
-- Estas políticas restrictivas bloquean INSERT/UPDATE/DELETE para usuarios
-- autenticados de forma explícita. El service_role (Edge Functions) sigue
-- pudiendo escribir porque bypasea RLS.

create policy "catalogo_deny_insert" on public.catalogo_cache
  as restrictive for insert to authenticated with check (false);

create policy "catalogo_deny_update" on public.catalogo_cache
  as restrictive for update to authenticated using (false) with check (false);

create policy "catalogo_deny_delete" on public.catalogo_cache
  as restrictive for delete to authenticated using (false);

create policy "mapa_deny_insert" on public.mapa_ingredientes
  as restrictive for insert to authenticated with check (false);

create policy "mapa_deny_update" on public.mapa_ingredientes
  as restrictive for update to authenticated using (false) with check (false);

create policy "mapa_deny_delete" on public.mapa_ingredientes
  as restrictive for delete to authenticated using (false);
