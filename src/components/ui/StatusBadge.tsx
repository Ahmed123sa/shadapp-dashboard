'use client';

import { useTranslations } from 'next-intl';

const statusColors: Record<string, string> = {
  draft: 'bg-zinc-700/30 text-zinc-400',
  sent: 'bg-blue-900/30 text-blue-400',
  client_approved: 'bg-green-900/30 text-green-400',
  client_rejected: 'bg-red-900/30 text-red-400',
  edit_requested: 'bg-amber-900/30 text-amber-400',
  company_approved: 'bg-purple-900/30 text-purple-400',
  completed: 'bg-emerald-900/30 text-emerald-400',
  archived: 'bg-zinc-700/30 text-zinc-500',
  pending: 'bg-yellow-900/30 text-yellow-400',
  approved: 'bg-green-900/30 text-green-400',
  rejected: 'bg-red-900/30 text-red-400',
  active: 'bg-green-900/30 text-green-400',
  inactive: 'bg-zinc-700/30 text-zinc-500',
  scheduled: 'bg-blue-900/30 text-blue-400',
  cancelled: 'bg-red-900/30 text-red-400',
}

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const t = useTranslations('dashboard');
  const statusLabels: Record<string, string> = {
    draft: t('label_draft'),
    sent: t('label_sent'),
    client_approved: t('label_pending_waiting'),
    client_rejected: t('label_client_rejected_badge'),
    edit_requested: t('label_edit_requested'),
    company_approved: t('label_company_approved_badge'),
    completed: t('label_completed'),
    archived: t('label_archived'),
    pending: t('label_pending_payment'),
    approved: t('label_approved_badge'),
    rejected: t('label_rejected_badge'),
    active: t('label_active_badge'),
    inactive: t('label_inactive_badge'),
    scheduled: t('label_scheduled_badge'),
    cancelled: t('label_cancelled_badge'),
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-zinc-700/30 text-zinc-400'} ${className}`}>
      {statusLabels[status] || status}
    </span>
  );
}
