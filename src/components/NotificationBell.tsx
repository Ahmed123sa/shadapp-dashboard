'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { subscribeToNotifications, disconnectEcho } from '@/lib/echo';
import { showToast } from './ToastNotification';

export default function NotificationBell() {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
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

  const getHref = (n: any) => {
    const d = n.data;
    const isClientPortal = typeof window !== 'undefined' && (window.location.pathname.startsWith('/client-dashboard') || window.location.pathname.startsWith('/client-login'));
    const tab = notificationTab[d?.type] || '';

    if (isClientPortal) {
      return tab ? `/client-dashboard?tab=${encodeURIComponent(tab)}` : '/client-dashboard';
    }

    const clientId = d?.client_id || d?.workspace_id;
    if (!clientId) return '/dashboard';
    return tab ? `/dashboard/clients/${clientId}?tab=${encodeURIComponent(tab)}` : `/dashboard/clients/${clientId}`;
  };

  const load = () => {
    api.get('/notifications').then(({ data }) => {
      const items = data.notifications || [];
      if (!initialLoadDoneRef.current) {
        items.forEach((item: any) => knownIdsRef.current.add(item.id));
        initialLoadDoneRef.current = true;
        if (items.length > 0) {
          lastIdRef.current = items[0]?.id || null;
        }
      } else {
        const newlyArrived = items.filter((item: any) => !knownIdsRef.current.has(item.id) && !item.read_at);
        newlyArrived.forEach((newest: any) => {
          knownIdsRef.current.add(newest.id);
          const href = getHref(newest);
          showToast({
            id: newest.id,
            title: newest.data?.title || '',
            message: newest.data?.message || '',
            href,
          });
        });
        if (items.length > 0) {
          lastIdRef.current = items[0]?.id || null;
        }
      }
      setNotifications(items);
      setUnread(data.unread_count || 0);
    }).catch(() => {});
  };

  useEffect(() => {
    load();
    const unsubscribe = subscribeToNotifications(() => { load(); });
    const interval = setInterval(load, 300000);
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => { clearInterval(interval); if (unsubscribe) unsubscribe(); disconnectEcho(); document.removeEventListener('mousedown', close); };
  }, []);

  const markRead = (id: string) => {
    api.post(`/notifications/${id}/read`).then(() => { load(); }).catch(() => {});
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] transition">
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[var(--color-primary)] text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{unread}</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-[var(--color-card)] border border-[var(--color-card-border)] z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-[var(--color-card-border)] flex justify-between items-center">
            <h3 className="text-sm font-bold">{t('notif_title')}</h3>
            <button onClick={() => { notifications.forEach((n) => { if (!n.read_at) markRead(n.id); }); }} className="text-xs text-[var(--color-gold)] hover:underline">{t('notif_mark_all_read')}</button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-xs text-[var(--color-text-disabled)] p-4 text-center">{t('notif_empty')}</p>
          ) : (
            notifications.map((n) => (
              <a key={n.id} href={getHref(n)} onClick={(e) => { if (!n.read_at) markRead(n.id); const href = getHref(n); if (href !== '#') { e.preventDefault(); router.push(href); } }}
                className={`block p-3 border-b border-[var(--color-card-border)] last:border-0 hover:bg-[var(--color-card-border)] transition ${n.read_at ? '' : 'bg-[var(--color-primary)]/10'}`}>
                <p className="text-xs font-medium">{n.data?.title || ''}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{n.data?.message || ''}</p>
                <p className="text-[10px] text-[var(--color-text-disabled)] mt-1">{new Date(n.created_at).toLocaleDateString('ar-SA')}</p>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
