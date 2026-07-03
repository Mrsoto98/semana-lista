-- ── Push notification subscriptions ─────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid references public.usuarios(id) on delete cascade not null,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_own" on public.push_subscriptions
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

create index if not exists idx_push_usuario on public.push_subscriptions(usuario_id);
