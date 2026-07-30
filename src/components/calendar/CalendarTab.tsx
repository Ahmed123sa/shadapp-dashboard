'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CalendarTab({ wsId }: { wsId: number }) {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/workspaces/${wsId}/meetings`).then(({ data }) => setMeetings(data.meetings?.data || data.meetings || [])),
      api.get(`/workspaces/${wsId}/contracts`).then(({ data }) => setContracts(data.contracts?.data || data.contracts || [])),
      api.get(`/workspaces/${wsId}/approvals`).then(({ data }) => setApprovals(data.approvals?.data || data.approvals || [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [wsId]);

  if (loading) return <LoadingSkeleton />;

  const items: { date: string; title: string; type: string; id: number }[] = [];

  meetings.forEach((m) => {
    const d = m.scheduled_at ? m.scheduled_at.substring(0, 10) : '';
    if (d) items.push({ date: d, title: m.title, type: 'meeting', id: m.id });
  });

  contracts.forEach((c) => {
    if (c.end_date) items.push({ date: c.end_date, title: `موعد نهائي: ${c.title}`, type: 'deadline', id: c.id });
    if (c.start_date) items.push({ date: c.start_date, title: `بداية: ${c.title}`, type: 'start', id: c.id });
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
    meeting: 'اجتماع',
    deadline: 'موعد نهائي',
    start: 'بداية',
    approval: 'موافقة',
  };

  return (
    <div className="space-y-3">
      {Object.keys(grouped).length === 0 ? <EmptyState message="لا توجد أحداث" /> : null}
      {Object.entries(grouped).map(([date, entries]) => (
        <div key={date}>
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">{new Date(date + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</h4>
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
