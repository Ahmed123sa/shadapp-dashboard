'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { subscribeToNotifications, disconnectEcho } from '@/lib/echo';
import { showToast } from './ToastNotification';
import { reportError } from '@/lib/error-reporting';
import type { AppNotification } from '@/types';

export default function NotificationBell() {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const lastIdRef = useRef<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const initialLoadDoneRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const notificationTab: Record<string, string> = {
    chat: t('tab_chat'),
    chat_message: t('tab_chat'),
    contract_sent: t('tab_contracts'),
    contract_client_approved: t('tab_contracts'),
    contract_client_signed: t('tab_contracts'),
    contract_company_approved: t('tab_contracts'),
    contract_completed: t('tab_contracts'),
    contract_reminder: t('tab_contracts'),
    contract_edit_requested: t('tab_contracts'),
    payment_created: t('tab_payments'),
    payment_reviewed: t('tab_payments'),
    workspace_activated: t('tab_payments'),
    payment_scheduled: t('tab_payments'),
    payment_reminder: t('tab_payments'),
    payment_schedule_updated: t('tab_payments'),
    payment_schedule_deleted: t('tab_payments'),
    approval_requested: t('tab_approvals'),
    approval_responded: t('tab_approvals'),
    meeting_created: t('tab_meetings'),
    meeting_reminder: t('tab_meetings'),
    meeting_updated: t('tab_meetings'),
    meeting_cancelled: t('tab_meetings'),
    file_uploaded: t('tab_files'),
    file_approved: t('tab_files'),
    file_rejected: t('tab_files'),
    birthday_reminder: t('tab_client_profile') || 'الملف التعريفي',
    birthday_greeting: t('tab_client_profile') || 'الملف التعريفي',
  };

  const getHref = (n: AppNotification) => {
    const d = n.data;
    const isClientPortal = typeof window !== 'undefined' && (window.location.pathname.startsWith('/client-dashboard') || window.location.pathname.startsWith('/client-login'));
    const tab = notificationTab[d?.type ?? ''] || '';

    if (isClientPortal) {
      return tab ? `/client-dashboard?tab=${encodeURIComponent(tab)}` : '/client-dashboard';
    }

    // plans/notifications-badges-toasts-plan.md ن5 — this used to fall back
    // to workspace_id when client_id was missing, routing to
    // /dashboard/clients/{workspace_id} — a workspace id used as a client
    // id, landing on the wrong client (or a page that doesn't exist) more
    // often than not. Every notification type now carries a real client_id
    // (ح3), and there's no /dashboard/workspaces/{id} route to fall back to,
    // so a missing client_id now just leaves the tap on the dashboard.
    const clientId = d?.client_id;
    if (!clientId) return '/dashboard';
    return tab ? `/dashboard/clients/${clientId}?tab=${encodeURIComponent(tab)}` : `/dashboard/clients/${clientId}`;
  };

  const load = () => {
    api.get('/notifications').then(({ data }) => {
      const items: AppNotification[] = data.notifications || [];
      if (!initialLoadDoneRef.current) {
        items.forEach((item) => knownIdsRef.current.add(item.id));
        initialLoadDoneRef.current = true;
        if (items.length > 0) {
          lastIdRef.current = items[0]?.id || null;
        }
      } else {
        const newlyArrived = items.filter((item) => !knownIdsRef.current.has(item.id) && !item.read_at);
        newlyArrived.forEach((newest) => {
          knownIdsRef.current.add(newest.id);
          const href = getHref(newest);
          showToast({
            id: newest.id,
            title: newest.data?.title || '',
            // ن4 — several backend notification types still only send
            // 'body', not 'message'; older stored rows never got backfilled.
            message: newest.data?.message || newest.data?.body || '',
            href,
          });
        });
        if (items.length > 0) {
          lastIdRef.current = items[0]?.id || null;
        }
      }
      setNotifications(items);
      setUnread(data.unread_count || 0);
    }).catch((err) => reportError('NotificationBell.load', err));
  };

  useEffect(() => {
    load();
    const unsubscribe = subscribeToNotifications(() => { load(); });
    // ن10 — matches the mobile app's 60-second poll. At 5 minutes, a toast
    // for a new notification could lag that far behind if Reverb dropped or
    // never connected in the first place.
    const interval = setInterval(load, 60000);
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => { clearInterval(interval); if (unsubscribe) unsubscribe(); disconnectEcho(); document.removeEventListener('mousedown', close); };
  }, []);

  const markRead = (id: string) => {
    api.post(`/notifications/${id}/read`).then(() => { load(); }).catch((err) => reportError('NotificationBell.markRead', err));
  };

  // ن11 — this used to loop over every unread notification and POST
  // /notifications/{id}/read one at a time (20 unread = 20 requests), when
  // the backend already has a dedicated /notifications/read-all endpoint
  // that does it in one query.
  const markAllRead = () => {
    api.post('/notifications/read-all').then(() => { load(); }).catch((err) => reportError('NotificationBell.markAllRead', err));
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] transition">
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[var(--color-primary)] text-white text-[length:var(--fs-1)] w-4 h-4 flex items-center justify-center rounded-full font-bold">{unread}</span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 bg-[var(--color-card)] border border-[var(--color-card-border)] z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-[var(--color-card-border)] flex justify-between items-center">
            <h3 className="text-sm font-bold">{t('notif_title')}</h3>
            <button onClick={markAllRead} className="text-xs text-[var(--color-gold-text)] hover:underline">{t('notif_mark_all_read')}</button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-xs text-[var(--color-text-disabled)] p-4 text-center">{t('notif_empty')}</p>
          ) : (
            notifications.map((n) => (
              <a key={n.id} href={getHref(n)} onClick={(e) => { if (!n.read_at) markRead(n.id); const href = getHref(n); if (href !== '#') { e.preventDefault(); router.push(href); } }}
                className={`block p-3 border-b border-[var(--color-card-border)] last:border-0 hover:bg-[var(--color-card-border)] transition ${n.read_at ? '' : 'bg-[var(--color-primary)]/10'}`}>
                <p className="text-xs font-medium">{n.data?.title || ''}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{n.data?.message || n.data?.body || ''}</p>
                <p className="text-[length:var(--fs-1)] text-[var(--color-text-disabled)] mt-1">{new Date(n.created_at).toLocaleDateString('ar-EG')}</p>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
