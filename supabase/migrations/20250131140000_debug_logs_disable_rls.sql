-- Desabilita RLS na tabela debug_logs para permitir insert com service_role
-- (service_role já ignora RLS, mas isso garante que nenhuma política bloqueie)
ALTER TABLE public.debug_logs DISABLE ROW LEVEL SECURITY;
