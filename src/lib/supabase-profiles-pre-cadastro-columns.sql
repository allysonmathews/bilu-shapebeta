-- Migração: adiciona colunas do pre-cadastro à tabela profiles.
-- Execute no SQL Editor do Supabase se a tabela profiles ainda não tiver essas colunas.
-- A Edge Function pre-cadastro salva: weight, height, age, biotype, goal, days_per_week, workout_location, injuries.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weight numeric,
  ADD COLUMN IF NOT EXISTS height numeric,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS days_per_week integer,
  ADD COLUMN IF NOT EXISTS workout_location text,
  ADD COLUMN IF NOT EXISTS injuries text[];
