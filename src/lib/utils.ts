/**
 * Reads a system-setting flag that the backend stores as a string ('1'/'0').
 *
 * This exact expression was inlined in three places (ContractBuilder,
 * ContractsTab, dashboard/settings) plus a fourth, subtly different one in the
 * mobile app — which accepted 'TRUE' while these did not, since `===` is
 * case-sensitive. Not a live bug (SystemSetting stores '1'/'0'), but four
 * copies of a parser that has to agree is one place to change and three to
 * forget.
 *
 * Tolerant on purpose: a Laravel cast or API Resource change could start
 * sending a real bool or int. Anything unrecognised is false, so the caller
 * keeps its own default when the setting is absent.
 */
const FILE_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';

/**
 * Turns a backend-relative storage path (e.g. `storage/avatars/x.jpg`) into
 * an absolute, browser-loadable URL, or passes an already-absolute URL
 * through unchanged.
 *
 * This exact logic was copy-pasted across 18 files (avatars, chat
 * attachments, contract signatures, approval certificates, payment proofs),
 * each with its own locally-scoped `FILE_BASE`/`resolveFileUrl` — one file
 * had drifted to accept `string | string[]` for `Payment.proof_file_url`
 * (multiple proof uploads) while the other 17 only accepted `string`. This
 * single copy accepts both shapes so every caller can use it unchanged,
 * taking the first entry when an array is passed.
 */
export function resolveFileUrl(url: string | string[] | null | undefined): string {
  if (!url) return '';
  const raw = Array.isArray(url) ? (url[0] || '') : url;
  if (!raw) return '';
  if (raw.startsWith('http')) return raw;
  return `${FILE_BASE}/storage/${raw.replace(/^\/?storage\//, '')}`;
}

export function asSettingFlag(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return String(value).trim().toLowerCase() === '1' || String(value).trim().toLowerCase() === 'true';
}

export interface MeetingJoinStatus {
  canJoin: boolean;
  label: string;
}

export function getMeetingJoinStatus(scheduledAt: string, locale = 'en'): MeetingJoinStatus {
  const now = new Date();
  const start = new Date(scheduledAt);
  const diffMs = start.getTime() - now.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin <= 0) {
    if (diffMin >= -15) return { canJoin: true, label: locale === 'ar' ? 'انضم الآن' : 'Join Now' };
    return { canJoin: false, label: locale === 'ar' ? 'انتهى' : 'Ended' };
  }
  if (diffMin <= 15) return { canJoin: true, label: locale === 'ar' ? `متبقي ${diffMin} دقيقة` : `${diffMin} min left` };
  if (diffMin < 60) return { canJoin: false, label: locale === 'ar' ? `متبقي ${diffMin} دقيقة` : `${diffMin} min left` };
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return { canJoin: false, label: locale === 'ar' ? `متبقي ${diffHrs} ساعة` : `${diffHrs} hr left` };
  return { canJoin: false, label: locale === 'ar' ? `متبقي ${Math.floor(diffHrs / 24)} يوم` : `${Math.floor(diffHrs / 24)} day left` };
}

export function formatMeetingDate(d: string, locale = 'en'): string {
  try {
    return new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}
