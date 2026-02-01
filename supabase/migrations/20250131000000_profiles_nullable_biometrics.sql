-- Migration: tornar colunas de biometria e objetivo opcionais na tabela profiles.
-- Motivo: onboarding via chat preenche dados gradualmente; registro inicial pode estar incompleto.
-- Execute no SQL Editor do Supabase ou via: supabase db push (se usar Supabase CLI).
-- Idempotente: seguro rodar mais de uma vez.

DO $$
DECLARE
  col text;
BEGIN
  -- Colunas do schema original + pre-cadastro
  FOREACH col IN ARRAY ARRAY['biotype', 'objective', 'calories', 'weight', 'height', 'age', 'goal', 'days_per_week', 'workout_location'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = col) THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.profiles ALTER COLUMN %I DROP NOT NULL', col);
        RAISE NOTICE 'Coluna % tornada opcional.', col;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Coluna %: % (pode já ser nullable)', col, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;
