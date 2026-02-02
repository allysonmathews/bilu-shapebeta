-- Histórico unificado: uma linha por usuário em debug_logs.
-- Adiciona user_id (UNIQUE) para upsert por usuário; dados passa a armazenar { history: [...] }.

-- 1) Adicionar coluna user_id (nullable para linhas antigas)
ALTER TABLE public.debug_logs
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2) Preencher linhas existentes: cada uma vira "seu próprio usuário" (user_id = id)
UPDATE public.debug_logs
  SET user_id = id
  WHERE user_id IS NULL;

-- 3) Índice único para upsert por user_id (permite múltiplos NULLs em linhas antigas)
CREATE UNIQUE INDEX IF NOT EXISTS debug_logs_user_id_key
  ON public.debug_logs (user_id)
  WHERE user_id IS NOT NULL;

-- 4) Comentário: novas inserções devem usar upsert por user_id e dados no formato { history: [...] }
COMMENT ON COLUMN public.debug_logs.user_id IS 'UUID do usuário (auth.users.id). Uma linha por user_id; dados.history = array de eventos.';
