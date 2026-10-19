'use client';

import { useTranslations, useLocale } from 'next-intl';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { getMeetingJoinStatus, formatMeetingDate } from '@/lib/utils';
import { useWorkspaceMeetings } from '@/hooks/queries/useMeetings';
import { canDo } from '@/lib/client-auth';
import { Icon, StatusDot, type DotTone } from '@/components/client-portal/ui';
import type { Meeting } from '@/types';

const TONE: Record<string, DotTone> = { scheduled: 'wait', completed: 'ok', cancelled: 'faint' };

function CalendarBadge({ iso, locale }: { iso: string; locale: string }) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short' });
  const day = d.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric' });
  return (
    <div className="cal">
      <div className="m">{month}</div>
      <div className="dd">{day}</div>
    </div>
  );
}

export default function ClientMeetings({ wsId }: { wsId: number }) {
  const t = useTranslations('dashboard');
  const tp = useTranslations('client_portal');
  const locale = useLocale();

  const meetingsQuery = useWorkspaceMeetings(wsId);
  const meetings = meetingsQuery.data ?? [];
  const loading = meetingsQuery.isLoading;
  const error = meetingsQuery.isError && meetingsQuery.data === undefined ? t('meeting_load_failed') : '';
  // Joining a call maps to can_join_meetings; viewing the list does not.
  const canJoin = canDo('can_join_meetings');

  const formatDate = (d: string) => formatMeetingDate(d, locale);
  const statusLabel = (s: Meeting['status']) => ({ scheduled: tp('m_scheduled'), completed: tp('m_done'), cancelled: tp('m_cancelled') } as Record<string, string>)[s] ?? s;

  if (loading) return <TableSkeleton />;
  if (error) return <p className="locked" style={{ padding: '40px 0', justifyContent: 'center', width: '100%' }}>{error}</p>;

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
    <div className="ledger">
      {meetings.length === 0 ? (
        <p className="locked" style={{ padding: '48px 0', justifyContent: 'center', width: '100%' }}>{t('meeting_no_meetings')}</p>
      ) : null}

      {upcoming.length > 0 && (
        <>
          <div className="section-h" style={{ marginTop: 0 }}>{t('meeting_upcoming_heading')}</div>
          {upcoming.map((m) => {
            const join = m.link ? getMeetingJoinStatus(m.scheduled_at, locale) : null;
            return (
              <div key={m.id} className="meetbig" style={{ marginBottom: 12 }}>
                <CalendarBadge iso={m.scheduled_at} locale={locale} />
                <div>
                  <div className="t">{m.title}</div>
                  <div className="m2">{formatDate(m.scheduled_at)} · {t('meeting_minutes', { minutes: m.duration_minutes })}</div>
                  {m.notes && <div className="m2">{m.notes}</div>}
                  {m.passcode && <div className="m2">{t('meeting_passcode', { code: m.passcode })}</div>}
                </div>
                <div className="acts">
                  {join && canJoin && (join.canJoin ? (
                    <a className="btn primary" href={m.link} target="_blank" rel="noopener noreferrer">
                      <Icon name="video" />
                      {join.label}
                    </a>
                  ) : (
                    <span className="locked">{join.label}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {past.length > 0 && (
        <>
          <div className="section-h">{t('meeting_past_heading')}</div>
          {past.map((m) => (
            <div key={m.id} className="rowx" style={{ marginBottom: 12 }}>
              <div>
                <div className="title">{m.title}</div>
                <div className="sub">{formatDate(m.scheduled_at)} · {t('meeting_minutes', { minutes: m.duration_minutes })}</div>
                {m.notes && <div className="sub">{m.notes}</div>}
                {m.passcode && <div className="sub">{t('meeting_passcode', { code: m.passcode })}</div>}
              </div>
              <span />
              <span className="st2"><StatusDot tone={TONE[m.status] ?? 'faint'} />{statusLabel(m.status)}</span>
              <div className="acts" />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
