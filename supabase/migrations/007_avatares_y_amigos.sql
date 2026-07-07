-- ── 1. Avatar con foto ───────────────────────────────────────────────────────

alter table usuarios
  add column if not exists avatar_url text;

-- Bucket público para avatares
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

-- Policy storage: cada usuario sube solo a su carpeta
create policy "usuarios suben su avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "usuarios actualizan su avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatares publicos"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "usuarios borran su avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);


-- ── 2. Sistema de amigos ──────────────────────────────────────────────────────

create table if not exists amistades (
  id             uuid primary key default gen_random_uuid(),
  solicitante_id uuid references usuarios(id) on delete cascade not null,
  receptor_id    uuid references usuarios(id) on delete cascade not null,
  estado         text not null default 'pendiente'
                   check (estado in ('pendiente', 'aceptada')),
  created_at     timestamptz default now(),
  unique(solicitante_id, receptor_id)
);

alter table amistades enable row level security;

-- Ver solicitudes donde soy parte
create policy "ver mis amistades"
  on amistades for select
  using (auth.uid() = solicitante_id or auth.uid() = receptor_id);

-- Enviar solicitud
create policy "enviar solicitud"
  on amistades for insert
  with check (auth.uid() = solicitante_id);

-- Aceptar/rechazar (el receptor actualiza)
create policy "aceptar solicitud"
  on amistades for update
  using (auth.uid() = receptor_id);

-- Eliminar amistad (cualquiera de los dos)
create policy "eliminar amistad"
  on amistades for delete
  using (auth.uid() = solicitante_id or auth.uid() = receptor_id);

-- Realtime para notificaciones de solicitudes
alter publication supabase_realtime add table amistades;

-- ── 3. Policy para buscar usuarios por username (solo campos públicos) ────────
create policy "buscar usuarios por username"
  on usuarios for select
  using (true);
