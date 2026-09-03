'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { reportError } from '@/lib/error-reporting';
import type { Meeting, Contract, Approval } from '@/types';

export default function CalendarTab({ wsId }: { wsId: number }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('dashboard');
  const tCal = useTranslations('calendar');

  useEffect(() => {
    Promise.all([
      api.get(`/workspaces/${wsId}/meetings`).then(({ data }) => setMeetings(data.meetings?.data || data.meetings || [])),
      api.get(`/workspaces/${wsId}/contracts`).then(({ data }) => setContracts(data.contracts?.data || data.contracts || [])),
      api.get(`/workspaces/${wsId}/approvals`).then(({ data }) => setApprovals(data.approvals?.data || data.approvals || [])),
    ]).catch((err) => reportError('CalendarTab.load', err)).finally(() => setLoading(false));
  }, [wsId]);

  if (loading) return <LoadingSkeleton />;

  const items: { date: string; title: string; type: string; id: number }[] = [];

  meetings.forEach((m) => {
    const d = m.scheduled_at ? m.scheduled_at.substring(0, 10) : '';
    if (d) items.push({ date: d, title: m.title, type: 'meeting', id: m.id });
  });

  contracts.forEach((c) => {
    if (c.end_date) items.push({ date: c.end_date, title: `${t('deadline_prefix')}${c.title}`, type: 'deadline', id: c.id });
    if (c.start_date) items.push({ date: c.start_date, title: `${t('start_prefix')}${c.title}`, type: 'start', id: c.id });
  });

  approvals.forEach((a) => {
    if (a.responded_at) {
      const d = a.responded_at.substring(0, 10);
      items.push({ date: d, title: `${a.title} — ${a.status}`, type: 'approval', id: a.id });
    }
  });

  items.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

  const grouped: Record<string, typeof items> = {};
  items.forEach((i) => { if (!grouped[i.date]) grouped[i.date] = []; grouped[i.date].push(i); });

  const typeStyles: Record<string, string> = {
    meeting: 'border-blue-400',
    deadline: 'border-red-400',
    start: 'border-green-400',
    approval: 'border-purple-400',
  };

  const typeLabels: Record<string, string> = {
    meeting: tCal('meeting'),
    deadline: tCal('deadline'),
    start: tCal('start'),
    approval: tCal('approval'),
  };

  return (
    <div className="space-y-3">
      {Object.keys(grouped).length === 0 ? <EmptyState message={t('no_events')} /> : null}
      {Object.entries(grouped).map(([date, entries]) => (
        <div key={date}>
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">{new Date(date + 'T12:00:00').toLocaleDateString('en-SA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</h4>
          <div className="space-y-1 mr-4">
            {entries.map((i, idx) => (
              <div key={`${i.type}-${i.id}-${idx}`} className={`text-sm border-r-2 ${typeStyles[i.type] || 'border-zinc-300'} pr-3 py-1`}>
                <span className="font-medium">{i.title}</span>
                <span className={`text-xs mr-2 ${i.type === 'deadline' ? 'text-red-500' : 'text-[var(--color-text-disabled)]'}`}>{typeLabels[i.type] || i.type}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
