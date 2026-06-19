-- Run in Supabase SQL Editor (Dashboard → SQL → New query)
--
-- Android local.properties:
-- supabase.url=https://YOUR_PROJECT.supabase.co
-- supabase.anon.key=YOUR_ANON_KEY
--
-- Supabase Auth → disable "Confirm email" for MVP (or enable after testing).

create table if not exists public.user_sync (
    user_id uuid primary key references auth.users (id) on delete cascade,
    credentials jsonb,
    watch_history jsonb not null default '[]'::jsonb,
    favorites jsonb not null default '[]'::jsonb,
    category_visibility jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.user_sync enable row level security;

create policy "Users read own sync"
    on public.user_sync for select
    using (auth.uid() = user_id);

create policy "Users insert own sync"
    on public.user_sync for insert
    with check (auth.uid() = user_id);

create policy "Users update own sync"
    on public.user_sync for update
    using (auth.uid() = user_id);

create policy "Users delete own sync"
    on public.user_sync for delete
    using (auth.uid() = user_id);
