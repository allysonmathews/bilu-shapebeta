-- Tabela notifications: notificações por usuário.
-- user_id referencia auth.users; cada usuário vê apenas suas notificações (RLS).

CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  message    text,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Usuário só vê e atualiza suas próprias notificações
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Inserção via service_role ou funções server-side (opcional); ou permitir insert se necessário
-- Por ora, não permitimos INSERT pelo cliente (notificações criadas por triggers/funções backend)
COMMENT ON TABLE public.notifications IS 'Notificações por usuário; is_read indica se já foi lida.';
