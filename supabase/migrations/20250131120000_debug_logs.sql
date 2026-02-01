-- Tabela debug_logs: id + dados (JSONB). Para inspecionar o JSON bruto que a IA envia.
-- Execute no SQL Editor do Supabase ou: supabase db push

CREATE TABLE IF NOT EXISTS public.debug_logs (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dados jsonb
);
