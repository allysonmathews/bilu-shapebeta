-- Habilita Supabase Realtime na tabela notifications.
-- Necessário para que o cliente possa escutar INSERT/UPDATE/DELETE em tempo real.

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
