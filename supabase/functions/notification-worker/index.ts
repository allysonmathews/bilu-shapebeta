// Edge Function: notification-worker
// Monitoramento proativo de notificações para todos os usuários.
// Invocar via HTTP (ex.: cron a cada 15–30 min).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const MINUTES_PER_DAY = 24 * 60;
const SPAM_WINDOW_HOURS = 25; // Não reenviar notificação idêntica em menos de 25h

function parseTimeToMinutes(hhmm: string | undefined): number {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const parts = hhmm.trim().split(/[:\s]/);
  const h = parseInt(parts[0], 10);
  const m = parts[1] ? parseInt(parts[1], 10) : 0;
  if (!Number.isFinite(h) || h < 0 || h > 23) return 0;
  return Math.min(MINUTES_PER_DAY, h * 60 + (Number.isFinite(m) ? m : 0));
}

function getIdealWaterPaceMl(
  goalMl: number,
  wakeTimeHHmm: string | undefined,
  sleepTimeHHmm: string | undefined,
  now: Date
): number {
  const wakeMin = parseTimeToMinutes(wakeTimeHHmm);
  const sleepMin = parseTimeToMinutes(sleepTimeHHmm);
  const currentMin = now.getHours() * 60 + now.getMinutes();

  let totalAwakeMinutes: number;
  if (wakeMin <= sleepMin) {
    totalAwakeMinutes = sleepMin - wakeMin;
  } else {
    totalAwakeMinutes = MINUTES_PER_DAY - wakeMin + sleepMin;
  }
  if (totalAwakeMinutes <= 0) return 0;

  let minutesSinceWake: number;
  if (currentMin >= wakeMin && currentMin <= sleepMin) {
    minutesSinceWake = currentMin - wakeMin;
  } else if (currentMin < wakeMin) {
    minutesSinceWake = 0;
  } else {
    minutesSinceWake = totalAwakeMinutes;
  }

  const totalAwakeHours = totalAwakeMinutes / 60;
  const hoursSinceWake = minutesSinceWake / 60;
  const idealMl = (goalMl / totalAwakeHours) * hoursSinceWake;
  return Math.round(Math.max(0, Math.min(goalMl, idealMl)));
}

function calculateWaterGoal(weightKg: number, daysPerWeek: number, workoutDuration: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 2000;
  let baseMl = weightKg * 35;
  if (daysPerWeek >= 5 || (daysPerWeek >= 4 && workoutDuration >= 45)) baseMl *= 1.2;
  else if (daysPerWeek >= 3 || workoutDuration >= 30) baseMl *= 1.1;
  return Math.max(250, Math.round(baseMl / 250) * 250);
}

/** Gera horários de refeição distribuídos entre wake e sleep. */
function deriveMealTimes(wakeTime: string, sleepTime: string, mealsPerDay: number): string[] {
  const wakeMin = parseTimeToMinutes(wakeTime);
  let sleepMin = parseTimeToMinutes(sleepTime);
  if (sleepMin <= wakeMin) sleepMin += MINUTES_PER_DAY;
  const totalMin = sleepMin - wakeMin;
  const n = Math.max(1, Math.min(6, mealsPerDay || 4));
  const interval = totalMin / n;
  const times: string[] = [];
  for (let i = 0; i < n; i++) {
    let m = wakeMin + Math.round(interval * (i + 0.5));
    if (m >= MINUTES_PER_DAY) m -= MINUTES_PER_DAY;
    const h = Math.floor(m / 60);
    const mi = m % 60;
    times.push(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`);
  }
  return times.sort();
}

function formatHHmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Configuração do Supabase ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const now = new Date();
    const today = toDateStr(now);
    const currentHHmm = formatHHmm(now);
    const currentMin = now.getHours() * 60 + now.getMinutes();
    let processed = 0;
    let notificationsSent = 0;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, weight, calories, days_per_week, workout_duration, wakeTime, sleepTime, wake_up_time, sleep_time, meals_per_day')
      .not('id', 'is', null);

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, notificationsSent: 0, message: 'Nenhum perfil encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const spamSince = new Date(now.getTime() - SPAM_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    async function alreadySent(userId: string, type: string, ref: string): Promise<boolean> {
      const { data } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('ref', ref)
        .gte('created_at', spamSince)
        .limit(1);
      return Array.isArray(data) && data.length > 0;
    }

    async function insertNotification(
      userId: string,
      title: string,
      message: string,
      type: string,
      ref: string
    ): Promise<boolean> {
      if (await alreadySent(userId, type, ref)) return false;
      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message,
        type,
        ref,
        is_read: false,
      });
      return !error;
    }

    for (const p of profiles as Record<string, unknown>[]) {
      const userId = String(p.id ?? '');
      if (!userId) continue;
      processed++;

      const name = (String(p.name ?? '').trim() || 'Bilu').split(' ')[0];
      const wakeTime = String(p.wakeTime ?? p.wake_up_time ?? '07:00').trim() || '07:00';
      const sleepTime = String(p.sleepTime ?? p.sleep_time ?? '23:00').trim() || '23:00';
      const mealsPerDay = Number(p.meals_per_day ?? 4) || 4;
      const weight = Number(p.weight ?? 70) || 70;
      const daysPerWeek = Number(p.days_per_week ?? 3) || 3;
      const workoutDuration = Number(p.workout_duration ?? 60) || 60;
      const targetCalories = Number(p.calories ?? 2000) || 2000;

      const goalMl = calculateWaterGoal(weight, daysPerWeek, workoutDuration);
      const idealPaceMl = getIdealWaterPaceMl(goalMl, wakeTime, sleepTime, now);

      // daily_water
      const { data: waterRow } = await supabase
        .from('daily_water')
        .select('consumed_ml')
        .eq('user_id', userId)
        .eq('log_date', today)
        .maybeSingle();
      const consumedMl = Number((waterRow as { consumed_ml?: number } | null)?.consumed_ml ?? 0) || 0;

      // ÁGUA: atraso >= 500ml
      if (consumedMl < idealPaceMl - 500) {
        if (await insertNotification(
          userId,
          `Hidratação em dia, ${name}! 💧`,
          `Você está ${idealPaceMl - consumedMl} ml atrás do ritmo ideal. Beba água para manter o desempenho.`,
          'water_lag',
          `water_${today}`
        )) notificationsSent++;
      }

      // REFEIÇÕES
      const mealTimes = deriveMealTimes(wakeTime, sleepTime, mealsPerDay);
      const { data: completedRows } = await supabase
        .from('completed_meals')
        .select('meal_time')
        .eq('user_id', userId)
        .eq('log_date', today);
      const completedMealTimes = new Set(
        ((completedRows ?? []) as { meal_time: string }[]).map((r) => r.meal_time)
      );

      for (const mt of mealTimes) {
        const [h, m] = mt.split(':').map(Number);
        const mealMin = h * 60 + m;
        const diffMin = currentMin - mealMin;
        const diffMin15 = mealMin - currentMin;

        if (diffMin15 > 0 && diffMin15 <= 15) {
          if (await insertNotification(
            userId,
            `Refeição em breve, ${name}! 🍽️`,
            `Em 15 minutos: refeição das ${mt}. Prepare seu prato.`,
            'meal_reminder',
            `meal_reminder_${mt}_${today}`
          )) notificationsSent++;
        } else if (diffMin >= 30 && diffMin < 120 && !completedMealTimes.has(mt)) {
          if (await insertNotification(
            userId,
            `Refeição pendente, ${name} ⏰`,
            `Passaram 30 min da refeição das ${mt}. Registre quando consumir para acompanhar suas metas.`,
            'meal_pending',
            `meal_pending_${mt}_${today}`
          )) notificationsSent++;
        }
      }

      // TREINO: até 20h sem série registrada
      if (now.getHours() >= 20) {
        const { data: workoutRows } = await supabase
          .from('workout_history')
          .select('id')
          .eq('user_id', userId)
          .eq('workout_date', today)
          .limit(1);
        const hasWorkout = Array.isArray(workoutRows) && workoutRows.length > 0;

        if (!hasWorkout) {
          if (await insertNotification(
            userId,
            `Bora treinar, ${name}! 💪`,
            `O dia está acabando e ainda não registrou nenhum exercício. Que tal uma série rápida? Cada movimento conta!`,
            'workout_reminder',
            `workout_${today}`
          )) notificationsSent++;
        }
      }

      // RESUMO DIÁRIO: 30 min antes de dormir (janela de 30 min para cron)
      const sleepMin = parseTimeToMinutes(sleepTime);
      const thirtyBeforeSleep = (sleepMin - 30 + MINUTES_PER_DAY) % MINUTES_PER_DAY;
      let diffMin = Math.abs(currentMin - thirtyBeforeSleep);
      if (diffMin > 720) diffMin = MINUTES_PER_DAY - diffMin;
      if (diffMin < 30) {
        const waterPct = goalMl > 0 ? Math.round((consumedMl / goalMl) * 100) : 0;
        const { data: dietRows } = await supabase
          .from('diet_journal')
          .select('calorias')
          .eq('user_id', userId)
          .eq('log_date', today);
        const dietCal = ((dietRows ?? []) as { calorias: number }[]).reduce((s, r) => s + Number(r.calorias ?? 0), 0);
        const dietPct = targetCalories > 0 ? Math.round((dietCal / targetCalories) * 100) : 0;

        let tip = 'Continue assim amanhã!';
        if (waterPct < 80) tip = 'Amanhã, priorize mais água ao longo do dia.';
        else if (dietPct < 70) tip = 'Tente bater melhor a meta de calorias amanhã.';
        else if (waterPct >= 90 && dietPct >= 90) tip = 'Excelente dia! Amanhã repita o ritmo.';

        if (await insertNotification(
          userId,
          `Resumo do dia, ${name} 📊`,
          `Água: ${waterPct}% | Dieta: ${dietPct}% batida. ${tip}`,
          'daily_summary',
          `daily_summary_${today}`
        )) notificationsSent++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        notificationsSent,
        message: `Processados ${processed} usuários, ${notificationsSent} notificações enviadas`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
