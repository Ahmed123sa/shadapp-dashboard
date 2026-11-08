'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Video } from 'lucide-react';
import { enterMeeting } from '@/lib/zoom';
import { MEETING_DEFAULT_MINUTES, getMeetingJoinStatus, notifyWriteError } from '@/lib/utils';
import type { Meeting } from '@/types';

// The next meeting of this client, pinned above the chat the way the app does
// it, so staff see it without scrolling to the card. Join shows only in the
// window the same rule gives everywhere: from 15 minutes before it starts
// until it ends.

/** The nearest scheduled meeting that has not ended yet, or null. */
export function nextMeeting(meetings: Meeting[] | undefined, now = Date.now()): Meeting | null {
  const open = (meetings ?? [])
    .filter((m) => m.status === 'scheduled' && m.scheduled_at)
    .filter((m) => {
      const start = new Date(m.scheduled_at).getTime();
      const length = (m.duration_minutes && m.duration_minutes > 0 ? m.duration_minutes : MEETING_DEFAULT_MINUTES) * 60000;
      return Number.isFinite(start) && start + length >= now;
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  return open[0] ?? null;
}

export default function MeetingBanner({
  meetings,
  canJoin,
  currentUserId,
  onEntered,
}: {
  meetings: Meeting[] | undefined;
  canJoin: boolean;
  currentUserId?: number;
  onEntered?: () => void;
}) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [entering, setEntering] = useState(false);
  // Re-read the clock every 30 seconds so the label and the Join button follow time.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const meeting = nextMeeting(meetings);
  if (!meeting) return null;

  const status = getMeetingJoinStatus(meeting.scheduled_at, locale, meeting.duration_minutes);
  const isHost = !meeting.host_user_id || meeting.host_user_id === currentUserId;
  const showJoin = canJoin && status.canJoin && !!meeting.link;

  const enter = async () => {
    if (entering) return;
    setEntering(true);
    try {
      await enterMeeting(meeting.id);
      onEntered?.();
    } catch (err) {
      notifyWriteError(tc, 'MeetingBanner.enter', err);
    } finally {
      setEntering(false);
    }
  };

  return (
    <div
      data-testid="meeting-banner"
      className="flex items-center gap-3 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card)] px-3 py-2"
    >
      <Video size={16} strokeWidth={1.5} className="shrink-0 text-[var(--color-gold-text)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[var(--color-foreground)]">{meeting.title || t('meeting_chip_title')}</p>
        <p className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{status.label}</p>
      </div>
      {showJoin && (
        <button
          type="button"
          onClick={enter}
          disabled={entering}
          className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-[length:var(--fs-1)] font-bold text-white transition-colors hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 active:bg-emerald-800 disabled:opacity-50"
        >
          {entering ? t('meeting_opening') : isHost ? t('meeting_start_as_host') : t('meeting_join')}
        </button>
      )}
    </div>
  );
}
