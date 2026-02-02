-- Tabela daily_water: consumo diário de água (consumed_ml) por usuário e data.
-- Uma linha por usuário por dia; upsert ao clicar em +/- no Diário.

create table if not exists public.daily_water (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  consumed_ml integer not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, log_date)
);

alter table public.daily_water enable row level security;

create policy "Usuário acessa apenas seus registros de daily_water"
  on public.daily_water
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_daily_water_user_date
  on public.daily_water (user_id, log_date);
