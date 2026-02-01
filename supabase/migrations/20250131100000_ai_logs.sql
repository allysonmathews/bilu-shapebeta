-- Tabela ai_logs: armazena payload bruto de chamadas/respostas da IA (JSONB sem restrições).
-- Execute no SQL Editor do Supabase ou via: supabase db push

CREATE TABLE IF NOT EXISTS public.ai_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz      DEFAULT now(),
  raw_data   jsonb
);

COMMENT ON TABLE public.ai_logs IS 'Logs brutos de interações com IA; raw_data aceita qualquer JSON.';
