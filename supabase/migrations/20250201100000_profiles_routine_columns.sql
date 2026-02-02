-- Adiciona colunas de rotina à tabela profiles (onboarding via chat).
-- meals_per_day: número de refeições por dia; wakeTime, sleepTime, workoutTime: horários em "HH:mm".

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS meals_per_day integer,
  ADD COLUMN IF NOT EXISTS "wakeTime" text,
  ADD COLUMN IF NOT EXISTS "sleepTime" text,
  ADD COLUMN IF NOT EXISTS "workoutTime" text;
