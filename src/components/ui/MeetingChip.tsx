'use client';

import { useTranslations, useLocale } from 'next-intl';
import { getMeetingJoinStatus, formatMeetingDate } from '@/lib/utils';

interface MeetingChipProps {
  metadata: {
    meeting_id?: number;
    title?: string;
    scheduled_at?: string;
    duration_minutes?: number;
    link?: string;
    passcode?: string;
    status?: string;
  };
}

export default function MeetingChip({ metadata }: MeetingChipProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const title = metadata.title || t('meeting_chip_title');
  const link = metadata.link;
  const scheduledAt = metadata.scheduled_at;
  const duration = metadata.duration_minutes;
  const status = metadata.status || 'scheduled';

  const joinStatus = scheduledAt ? getMeetingJoinStatus(scheduledAt, locale) : null;

  return (
    <div className="max-w-xs border border-[#1a5276]/30 rounded-lg p-3 bg-[#0d2137]">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#1a5276]/30 border border-[#1a5276]/40 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">📹</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{title}</p>
          {scheduledAt && (
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
              {formatMeetingDate(scheduledAt, locale)}{duration ? ` • ${duration}m` : ''}
            </p>
          )}
        </div>
        {joinStatus && link && status === 'scheduled' && joinStatus.canJoin && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-[10px] font-bold bg-emerald-600 text-white px-2 py-1 rounded-md hover:bg-emerald-700 transition-colors"
          >
            {t('meeting_chip_join_now')}
          </a>
        )}
        {joinStatus && (!link || !joinStatus.canJoin || status !== 'scheduled') && (
          <span className={`flex-shrink-0 text-[10px] px-2 py-1 rounded-md ${
            joinStatus.label === t('meeting_chip_ended')
              ? 'bg-gray-600/40 text-gray-400'
              : 'bg-[#1a5276]/20 text-[#5dade2]'
          }`}>
            {joinStatus.label}
          </span>
        )}
      </div>
      {metadata.passcode && (
        <p className="text-[10px] text-[var(--color-text-disabled)] mt-1.5">{t('meeting_chip_passcode', { code: metadata.passcode })}</p>
      )}
    </div>
  );
}
