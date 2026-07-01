alter table perfiles
  add column if not exists dificultad_recetas text
    not null default 'combinado'
    check (dificultad_recetas in ('fácil', 'media', 'difícil', 'combinado'));
