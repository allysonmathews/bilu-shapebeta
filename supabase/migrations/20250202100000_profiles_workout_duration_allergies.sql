-- Adiciona colunas de duração do treino e alergias à tabela profiles (onboarding estruturado).
-- workout_duration: duração do treino em minutos (ex: 60).
-- allergies: array de strings para alergias/aversões alimentares.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS workout_duration integer,
  ADD COLUMN IF NOT EXISTS allergies text[];
