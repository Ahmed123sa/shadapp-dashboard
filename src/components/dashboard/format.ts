import type { TFunc } from './types';

export function timeAgo(dateStr: string, locale: string, t: TFunc): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('just_now');
  if (mins < 60) return t('minutes_ago', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('hours_ago', { count: hrs });
  const days = Math.floor(hrs / 24);
  return t('days_ago', { count: days });
}

export function formatDate(dateStr: string, locale: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatTime(dateStr: string, locale: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatFileSize(bytes: number, locale: string, t: TFunc): string {
  if (!bytes) return `0 ${t('bytes_unit')}`;
  const units = [t('bytes_unit'), t('kb_unit'), t('mb_unit'), t('gb_unit')];
  let idx = 0;
  let size = bytes;
  while (size >= 1024 && idx < units.length - 1) { size /= 1024; idx++; }
  return `${size.toFixed(idx > 0 ? 1 : 0)} ${units[idx]}`;
}
