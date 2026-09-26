import { reportError } from './error-reporting';
import { showToast } from '@/components/ToastNotification';
import type { Client } from '@/types';

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
    return new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

/**
 * Whether a client has approved a contract — distinct from `signed_at`,
 * which only records the client saving a profile signature (see
 * client-signature-plan.md ن1). A paid, active client could otherwise show
 * as "not signed". Mirrors the mobile app's `clientHasSignedContract()`
 * (`lib/core/helpers/client_status.dart`): an active workspace always means
 * a contract was approved (the workspace can't activate without one);
 * `has_signed_contract` is the real signal from GET /clients and
 * GET /clients/{id}; `signed_at` is only a fallback for an older server
 * response that doesn't send the flag yet.
 */
export function clientHasSignedContract(client: Pick<Client, 'workspace' | 'has_signed_contract' | 'signed_at'>): boolean {
  if (client.workspace?.status === 'active') return true;
  if (typeof client.has_signed_contract === 'boolean') return client.has_signed_contract;
  return !!client.signed_at;
}

/**
 * `JSON.parse(localStorage.getItem(key))` without a try/catch throws
 * synchronously during render the moment the stored value is ever
 * malformed (a half-written value from a previous crashed tab, a manual
 * edit in DevTools, a quota error that truncated the write, or just an old
 * shape from a previous app version). getUser()/getClient()/getSubUser()
 * all had this exact unguarded pattern — the user got stuck on the generic
 * error boundary with no way out short of manually clearing storage.
 * Corrupt session data isn't a real error case to surface; it's
 * equivalent to no session at all, so this treats it that way (and clears
 * the bad value so it doesn't keep tripping this on every render).
 */
export function safeJsonParse<T>(raw: string | null, key?: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    reportError('safeJsonParse', err, key ? { key } : undefined);
    if (key && typeof window !== 'undefined') {
      try { localStorage.removeItem(key); } catch { /* storage itself unavailable — nothing more we can do */ }
    }
    return null;
  }
}

/**
 * The fix for the "25 silent-catch sites" pattern found in the tech-lead
 * review: `await api.patch(...).catch(() => ({ data: null }))` followed by
 * `if (data) { ...update UI... }` — on failure this did nothing at all, no
 * toast, no log, the user just saw their action quietly not happen.
 *
 * This centralizes what should happen instead: funnel the error into
 * reportError (same as every other caught error in the app) and surface a
 * generic toast via the existing showToast()/<ToastNotification /> system so
 * the user knows the write didn't go through.
 *
 * `t` is the translator for the `common` namespace (`useTranslations('common')`)
 * — passed in rather than called here because this is a plain function, not a
 * component, and next-intl's hook can only be called from one. `context`
 * should be a short `Component.action` label (e.g. `'ContractsTab.updateStatus'`)
 * — it's both what reportError logs under and the toast's dedup id, so two
 * failures of the *same* action within 15s collapse into one toast instead of
 * stacking up.
 */
export function notifyWriteError(t: (key: string) => string, context: string, error: unknown): void {
  reportError(context, error);
  showToast({
    id: context,
    title: t('write_error_title'),
    message: t('write_error_message'),
  });
}

/**
 * Reads the machine-readable `code` field from an axios error's 422 body
 * (e.g. `code: 'signature_required'` from ContractController::clientAction /
 * ChatController::respond, client-signature-plan.md ن6) without importing
 * axios here — duck-typed on `.response.data`, since axios errors are the
 * only rejection shape this app's api.ts ever produces that carries one.
 * Undefined for a plain Laravel validation-rule failure (never sets `code`)
 * or any non-axios rejection, so callers can safely check `=== 'signature_required'`.
 * Mirrors the mobile app's `ValidationException.code`.
 */
export function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined;
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (!data || typeof data !== 'object') return undefined;
  const code = (data as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** Same duck-typed read as getErrorCode(), for the human-readable `message` field. */
export function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined;
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (!data || typeof data !== 'object') return undefined;
  const message = (data as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}
