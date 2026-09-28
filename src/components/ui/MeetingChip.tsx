'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getMeetingJoinStatus, formatMeetingDate, notifyWriteError } from '@/lib/utils';
import { enterMeeting } from '@/lib/zoom';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface MeetingChipProps {
  metadata: {
    meeting_id?: number;
    title?: string;
    scheduled_at?: string;
    duration_minutes?: number;
    link?: string;
    passcode?: string;
    status?: string;
    rescheduled?: boolean;
  };
  staffEntry?: boolean;
  isHost?: boolean;
  onEntered?: () => void;
}

export default function MeetingChip({
  metadata,
  staffEntry = false,
  isHost = true,
  onEntered,
}: MeetingChipProps) {
  const [entering, setEntering] = useState(false);
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const locale = useLocale();
  const title = metadata.title || t('meeting_chip_title');
  const link = metadata.link;
  const scheduledAt = metadata.scheduled_at;
  const duration = metadata.duration_minutes;
  const status = metadata.status || 'scheduled';

  const joinStatus = scheduledAt ? getMeetingJoinStatus(scheduledAt, locale) : null;

  const handleStaffEnter = async () => {
    if (!metadata.meeting_id || entering) return;
    setEntering(true);
    try {
      await enterMeeting(metadata.meeting_id);
      onEntered?.();
    } catch (err) {
      notifyWriteError(tc, 'MeetingChip.enterMeeting', err);
    } finally {
      setEntering(false);
    }
  };

  return (
    <div className="max-w-xs border border-[#1a5276]/30 rounded-lg p-3 bg-[#0d2137]">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#1a5276]/30 border border-[#1a5276]/40 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">📹</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{title}</p>
          {/* The backend posts a fresh card flagged metadata.rescheduled
              when a meeting's time changes, so the client notices. */}
          {metadata.rescheduled && status === 'scheduled' && (
            <span className="inline-block mt-1 text-[length:var(--fs-1)] font-semibold px-2 py-0.5 rounded-full bg-[#1a5276]/20 border border-[#1a5276]/40 text-[#5dade2]">
              {t('meeting_chip_rescheduled')}
            </span>
          )}
          {scheduledAt && (
            <p className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)] mt-0.5">
              {formatMeetingDate(scheduledAt, locale)}{duration ? ` • ${duration}m` : ''}
            </p>
          )}
        </div>
        {joinStatus && link && status === 'scheduled' && joinStatus.canJoin && (
          staffEntry && metadata.meeting_id ? (
            <button
              type="button"
              onClick={handleStaffEnter}
              disabled={entering}
              className="flex-shrink-0 text-[length:var(--fs-1)] font-bold bg-emerald-600 text-white px-2 py-1 rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {entering ? t('meeting_opening') : isHost ? t('meeting_start_as_host') : t('meeting_join')}
            </button>
          ) : (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-[length:var(--fs-1)] font-bold bg-emerald-600 text-white px-2 py-1 rounded-md hover:bg-emerald-700 transition-colors"
            >
              {t('meeting_chip_join_now')}
            </a>
          )
        )}
        {/* 23 Sept 2026 — a completed/cancelled meeting used to fall into
            the countdown/"Ended" span below (e.g. a cancelled meeting still
            showing "2h left"). It now gets the same StatusBadge as the
            meetings tab; the backend keeps metadata.status in sync. */}
        {status !== 'scheduled' && <StatusBadge status={status} className="flex-shrink-0" />}
        {joinStatus && status === 'scheduled' && (!link || !joinStatus.canJoin) && (
          <span className={`flex-shrink-0 text-[length:var(--fs-1)] px-2 py-1 rounded-md ${
            joinStatus.label === t('meeting_chip_ended')
              ? 'bg-gray-600/40 text-gray-400'
              : 'bg-[#1a5276]/20 text-[#5dade2]'
          }`}>
            {joinStatus.label}
          </span>
        )}
      </div>
      {metadata.passcode && (
        <p className="text-[length:var(--fs-1)] text-[var(--color-text-disabled)] mt-1.5">{t('meeting_chip_passcode', { code: metadata.passcode })}</p>
      )}
    </div>
  );
}
