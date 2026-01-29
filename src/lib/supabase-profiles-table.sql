-- Execute este SQL no Supabase (SQL Editor) para criar a tabela de perfis.
-- Assim o app consegue salvar Nome, Biotipo, Objetivo e Calorias na nuvem.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  name text default '',
  biotype text not null,
  objective text not null,
  calories integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Permissão para o anon key inserir/atualizar (ajuste RLS conforme sua política).
alter table public.profiles enable row level security;

create policy "Permitir insert e update anon em profiles"
  on public.profiles
  for all
  using (true)
  with check (true);
