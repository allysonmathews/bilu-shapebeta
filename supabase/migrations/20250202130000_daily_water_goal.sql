-- Adiciona daily_goal_ml à tabela daily_water (meta total do dia, para integridade e exibição).
-- O banco gerencia updated_at via default now().

alter table public.daily_water
  add column if not exists daily_goal_ml integer not null default 2000;
