-- Tabela workout_history: histórico de exercícios (nome + peso) por usuário e data.
-- O app envia: user_id (UUID do Auth), exercise_id, exercise_name, weight, workout_date.

create table if not exists public.workout_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  exercise_name text not null,
  weight numeric not null,
  workout_date date not null,
  created_at timestamptz default now()
);

alter table public.workout_history enable row level security;

create policy "Usuário acessa apenas seus registros"
  on public.workout_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_workout_history_user_date
  on public.workout_history (user_id, workout_date);
