'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import api from '@/lib/api';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import ErrorState from '@/components/ErrorState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { reportError } from '@/lib/error-reporting';
import type { Meeting, Contract, Approval, Payment } from '@/types';

type EventType = 'meeting' | 'deadline' | 'start' | 'contract' | 'approval' | 'payment';

interface CalendarEvent {
  date: string;
  title: string;
  type: EventType;
  id: number;
  status?: string;
}

/**
 * 24 Sept 2026 — a meeting/approval/payment timestamp is a UTC instant
 * (e.g. "2026-10-01T23:30:00Z"). Reading its date with a plain string slice
 * put an event that lands just after midnight Egypt time on the previous
 * day. Going through Date first converts to the viewer's own local time,
 * the same way MeetingChip and the meetings tab already display these.
 * NOT used for Contract.start_date/end_date — those are plain `date`
 * columns with no time part, so no conversion is needed or safe.
 */
function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarTab({ wsId }: { wsId: number }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const t = useTranslations('dashboard');
  const tCal = useTranslations('calendar');
  const locale = useLocale();

  const load = () => {
    setLoading(true);
    setLoadError(false);
    return Promise.all([
      api.get(`/workspaces/${wsId}/meetings`).then(({ data }) => setMeetings(data.meetings?.data || data.meetings || [])),
      api.get(`/workspaces/${wsId}/contracts`).then(({ data }) => setContracts(data.contracts?.data || data.contracts || [])),
      api.get(`/workspaces/${wsId}/approvals`).then(({ data }) => setApprovals(data.approvals?.data || data.approvals || [])),
      // 24 Sept 2026 — payments never appeared on this calendar at all,
      // unlike mobile's equivalent screen, which does show them.
      api.get(`/workspaces/${wsId}/payments`).then(({ data }) => setPayments(data.payments?.data || data.payments || [])),
    ]).catch((err) => { reportError('CalendarTab.load', err); setLoadError(true); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [wsId]);

  if (loading) return <TableSkeleton />;
  if (loadError) return <ErrorState onRetry={load} />;

  const items: CalendarEvent[] = [];

  meetings.forEach((m) => {
    if (!m.scheduled_at) return;
    // 24 Sept 2026 — status is now carried through so a cancelled/completed
    // meeting is visibly marked instead of looking identical to an upcoming
    // one.
    items.push({ date: localDayKey(m.scheduled_at), title: m.title, type: 'meeting', id: m.id, status: m.status });
  });

  contracts.forEach((c) => {
    if (c.start_date) items.push({ date: c.start_date, title: `${t('start_prefix')}${c.title}`, type: 'start', id: c.id, status: c.status });
    if (c.end_date) items.push({ date: c.end_date, title: `${t('deadline_prefix')}${c.title}`, type: 'deadline', id: c.id, status: c.status });
    // 24 Sept 2026 — start_date/end_date are optional (and the "show
    // contract dates" setting can hide the fields entirely), so a contract
    // with neither used to be invisible on this calendar. It now shows
    // once, on the day it was signed off or, failing that, created.
    if (!c.start_date && !c.end_date) {
      const fallback = c.company_signed_at || c.created_at;
      if (fallback) items.push({ date: localDayKey(fallback), title: c.title, type: 'contract', id: c.id, status: c.status });
    }
  });

  approvals.forEach((a) => {
    // 24 Sept 2026 — this only added an event once responded_at was set, so
    // a request still awaiting the client's answer never appeared at all.
    // It now falls back to when the request was made.
    const d = a.responded_at || a.created_at;
    if (d) items.push({ date: localDayKey(d), title: a.title, type: 'approval', id: a.id, status: a.status });
  });

  payments.forEach((p) => {
    if (!p.created_at) return;
    items.push({
      date: localDayKey(p.created_at),
      title: `${tCal('payment')}: ${p.amount} ${p.currency || ''}`.trim(),
      type: 'payment',
      id: p.id,
      status: p.status,
    });
  });

  items.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

  const grouped: Record<string, CalendarEvent[]> = {};
  items.forEach((i) => { if (!grouped[i.date]) grouped[i.date] = []; grouped[i.date].push(i); });

  const typeStyles: Record<string, string> = {
    meeting: 'border-blue-400',
    deadline: 'border-red-400',
    start: 'border-green-400',
    contract: 'border-zinc-400',
    approval: 'border-purple-400',
    payment: 'border-amber-400',
  };

  const typeLabels: Record<string, string> = {
    meeting: tCal('meeting'),
    deadline: tCal('deadline'),
    start: tCal('start'),
    contract: tCal('contract'),
    approval: tCal('approval'),
    payment: tCal('payment'),
  };

  // 24 Sept 2026 — StatusBadge's 'pending' label is "Pending Payment"
  // (correct for a payment, wrong for a pending approval request), so an
  // approval's status gets its own labels — the same ones the Approvals tab
  // already uses — instead of StatusBadge's generic ones.
  const approvalStatusLabels: Record<string, string> = {
    pending: t('approval_pending_status'),
    approved: t('approval_approved_status'),
    rejected: t('approval_rejected_status'),
    edit_requested: t('approval_edit_requested_status'),
  };
  const approvalStatusColors: Record<string, string> = {
    pending: 'bg-yellow-900/30 text-yellow-400',
    approved: 'bg-green-900/30 text-green-400',
    rejected: 'bg-red-900/30 text-red-400',
    edit_requested: 'bg-amber-900/30 text-amber-400',
  };

  const renderStatus = (i: CalendarEvent) => {
    if (!i.status) return null;
    if (i.type === 'approval') {
      return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${approvalStatusColors[i.status] || 'bg-zinc-700/30 text-zinc-400'}`}>
          {approvalStatusLabels[i.status] || i.status}
        </span>
      );
    }
    return <StatusBadge status={i.status} />;
  };

  return (
    <div className="space-y-3">
      {Object.keys(grouped).length === 0 ? <EmptyState message={t('no_events')} /> : null}
      {Object.entries(grouped).map(([date, entries]) => (
        <div key={date}>
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            {new Date(date + 'T12:00:00').toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </h4>
          <div className="space-y-1 mr-4">
            {entries.map((i, idx) => (
              <div key={`${i.type}-${i.id}-${idx}`} className={`flex items-center justify-between gap-2 text-sm border-r-2 ${typeStyles[i.type] || 'border-zinc-300'} pr-3 py-1`}>
                <div>
                  <span className="font-medium">{i.title}</span>
                  <span className={`text-xs mr-2 ${i.type === 'deadline' ? 'text-red-500' : 'text-[var(--color-text-disabled)]'}`}>{typeLabels[i.type] || i.type}</span>
                </div>
                {renderStatus(i)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
