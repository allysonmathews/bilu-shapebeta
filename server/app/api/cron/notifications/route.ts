/**
 * API Route: /api/cron/notifications
 *
 * Invoca o worker de notificações proativas (Supabase Edge Function).
 * Destinado a ser chamado por um cron job externo a cada 15–30 minutos.
 *
 * Segurança: envie header X-Cron-Secret com valor igual a CRON_SECRET no .env.
 * Se CRON_SECRET não estiver definido, a rota exige que a requisição seja local ou
 * usa um fallback (não recomendado em produção).
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return runWorker(req);
}

export async function POST(req: NextRequest) {
  return runWorker(req);
}

async function runWorker(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const headerSecret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '');
    if (headerSecret !== cronSecret) {
      return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados' },
      { status: 500 }
    );
  }

  const fnUrl = `${supabaseUrl}/functions/v1/notification-worker`;
  try {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data.error ?? `Edge Function retornou ${res.status}` },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
