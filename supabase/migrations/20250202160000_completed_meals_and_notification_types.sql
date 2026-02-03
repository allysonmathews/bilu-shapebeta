-- Tabela completed_meals: refeições marcadas como concluídas (para o worker verificar).
-- meal_time: horário HH:mm da refeição (usado pelo worker para matching).

CREATE TABLE IF NOT EXISTS public.completed_meals (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date    date NOT NULL,
  meal_time   text NOT NULL,
  meal_id     text,
  completed_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, log_date, meal_time)
);

CREATE INDEX IF NOT EXISTS idx_completed_meals_user_date ON public.completed_meals(user_id, log_date);

ALTER TABLE public.completed_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own completed_meals"
  ON public.completed_meals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Colunas type e ref em notifications para deduplicação (evitar spam).
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS ref text;

CREATE INDEX IF NOT EXISTS idx_notifications_user_type_ref ON public.notifications(user_id, type, ref);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
