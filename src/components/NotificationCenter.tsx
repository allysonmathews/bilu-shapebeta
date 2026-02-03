import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { supabase, getNotifications, markNotificationAsRead, type NotificationRow } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface NotificationCenterProps {
  userId: string;
}

function formatNotificationDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays} dia(s) atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/** Normaliza payload do Realtime para NotificationRow. */
function toNotificationRow(row: Record<string, unknown>): NotificationRow {
  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    title: String(row.title ?? ''),
    message: row.message != null ? String(row.message) : null,
    is_read: Boolean(row.is_read ?? false),
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const hasUnread = notifications.some((n) => !n.is_read);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const data = await getNotifications(userId);
    setNotifications(data);
    setLoading(false);
  }, [userId]);

  // Carregamento inicial
  useEffect(() => {
    if (!userId) return;
    fetchNotifications();
  }, [userId, fetchNotifications]);

  // Supabase Realtime: escuta INSERT, UPDATE e DELETE na tabela notifications filtrado por user_id
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const row = toNotificationRow(payload.new as Record<string, unknown>);
            setNotifications((prev) => [row, ...prev]);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const row = toNotificationRow(payload.new as Record<string, unknown>);
            setNotifications((prev) =>
              prev.map((n) => (n.id === row.id ? row : n))
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const id = String((payload.old as Record<string, unknown>).id ?? '');
            if (id) {
              setNotifications((prev) => prev.filter((n) => n.id !== id));
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[NotificationCenter] Realtime channel error');
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  // Fechar popover ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (n: NotificationRow) => {
    if (!n.is_read) {
      const { ok } = await markNotificationAsRead(n.id, userId);
      if (ok) {
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
      }
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="relative p-2 rounded-full text-gray-400 hover:text-alien-green hover:bg-card-bg border border-transparent hover:border-alien-green/50 transition-colors"
        aria-label="Notificações"
      >
        <Bell size={22} />
        {hasUnread && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-deep-bg"
            aria-hidden
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-80 overflow-hidden rounded-xl bg-card-bg border border-bilu-purple/50 shadow-xl shadow-black/50 z-50">
          <div className="p-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-alien-green">Central de Notificações</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-400">Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                Nenhuma notificação
              </div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left p-3 hover:bg-deep-bg/80 transition-colors ${
                        !n.is_read ? 'bg-alien-green/5 border-l-2 border-alien-green' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm font-medium text-white">{n.title}</span>
                        {!n.is_read && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                        )}
                      </div>
                      {n.message && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {formatNotificationDate(n.created_at)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
