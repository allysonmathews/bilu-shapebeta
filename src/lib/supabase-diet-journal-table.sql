-- Tabela diet_journal: consumo do diário (calorias, proteína, carbo, gordura) por usuário e data.
-- Usada pelo Diário para salvar pratos analisados pela IA e para gráficos de consumo.

create table if not exists public.diet_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  calorias numeric not null default 0,
  proteina numeric not null default 0,
  carbo numeric not null default 0,
  gordura numeric not null default 0,
  descricao text,
  created_at timestamptz default now()
);

alter table public.diet_journal enable row level security;

create policy "Usuário acessa apenas seus registros de diet_journal"
  on public.diet_journal
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_diet_journal_user_date
  on public.diet_journal (user_id, log_date);
