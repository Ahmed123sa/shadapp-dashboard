'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { getMeetingJoinStatus, formatMeetingDate } from '@/lib/utils';

export default function ClientMeetings({ wsId }: { wsId: number }) {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/workspaces/${wsId}/meetings`)
      .then(({ data }) => setMeetings(data.meetings?.data || data.meetings || []))
      .catch(() => setError('فشل تحميل الاجتماعات'))
      .finally(() => setLoading(false));
  }, [wsId]);

  const formatDate = formatMeetingDate;

  if (loading) return <LoadingSkeleton />;
  if (error) return <p className="text-sm text-red-500 text-center py-8">{error}</p>;

  const now = new Date();
  const upcoming = meetings.filter((m) => {
    if (m.status !== 'scheduled') return false;
    try { return new Date(m.scheduled_at) > now; } catch { return true; }
  });
  const past = meetings.filter((m) => {
    if (m.status !== 'scheduled') return true;
    try { return new Date(m.scheduled_at) <= now; } catch { return false; }
  });

  return (
    <div className="space-y-4">
      {meetings.length === 0 ? <EmptyState message="لا توجد اجتماعات" /> : null}

      {upcoming.length > 0 && (
        <>
          <h4 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">الاجتماعات القادمة</h4>
          {upcoming.map((m) => (
            <div key={m.id} className="border border-[var(--color-card-border)] rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{m.title}</h4>
                  <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">
                    {formatDate(m.scheduled_at)} • {m.duration_minutes} دقيقة
                  </p>
                  {m.notes && <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">{m.notes}</p>}
                </div>
                <StatusBadge status={m.status} />
              </div>
              {m.status === 'scheduled' && m.link && (() => {
                const joinStatus = getMeetingJoinStatus(m.scheduled_at);
                return joinStatus.canJoin ? (
                  <div className="mt-3">
                    <a href={m.link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                      🎥 {joinStatus.label}
                    </a>
                  </div>
                ) : (
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 text-xs bg-gray-600/40 text-gray-400 px-4 py-2 rounded-lg">
                      ⏳ {joinStatus.label}
                    </span>
                  </div>
                );
              })()}
              {m.passcode && (
                <p className="text-xs text-[var(--color-text-disabled)] mt-1">رمز الدخول: {m.passcode}</p>
              )}
            </div>
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <h4 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">الاجتماعات السابقة</h4>
          {past.map((m) => (
            <div key={m.id} className="border border-[var(--color-card-border)] rounded-lg p-4 opacity-70">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{m.title}</h4>
                  <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">
                    {formatDate(m.scheduled_at)} • {m.duration_minutes} دقيقة
                  </p>
                  {m.notes && <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">{m.notes}</p>}
                </div>
                <StatusBadge status={m.status} />
              </div>
              {m.passcode && (
                <p className="text-xs text-[var(--color-text-disabled)] mt-1">رمز الدخول: {m.passcode}</p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
