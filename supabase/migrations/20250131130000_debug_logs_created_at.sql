-- Adiciona created_at à tabela debug_logs se não existir.
-- Estrutura final: id (uuid), created_at (timestamptz), dados (jsonb)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'debug_logs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.debug_logs ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;
