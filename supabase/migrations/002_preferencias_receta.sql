-- Tabla de preferencias de recetas por usuario
create table if not exists preferencias_receta (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade not null,
  receta_nombre text not null,
  tipo text not null check (tipo in ('like', 'dislike')),
  motivo text,
  ingredientes_no_gustan text[] default '{}',
  created_at timestamptz default now(),
  unique(usuario_id, receta_nombre)
);

alter table preferencias_receta enable row level security;

create policy "usuarios gestionan sus propias preferencias"
  on preferencias_receta for all
  using (auth.uid() = usuario_id);
