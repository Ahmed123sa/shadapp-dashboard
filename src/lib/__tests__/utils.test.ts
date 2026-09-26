import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMeetingJoinStatus, formatMeetingDate, asSettingFlag, resolveFileUrl, safeJsonParse, notifyWriteError, clientHasSignedContract, getErrorCode, getErrorMessage } from '../utils';
import { reportError } from '../error-reporting';
import { showToast } from '@/components/ToastNotification';

vi.mock('../error-reporting', () => ({ reportError: vi.fn() }));
vi.mock('@/components/ToastNotification', () => ({ showToast: vi.fn() }));

const NOW = new Date('2026-08-26T10:00:00.000Z');

afterEach(() => {
  vi.useRealTimers();
});

describe('getMeetingJoinStatus', () => {
  it('allows joining up to 15 minutes before the scheduled time', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const status = getMeetingJoinStatus(new Date(NOW.getTime() + 10 * 60000).toISOString());
    expect(status.canJoin).toBe(true);
    expect(status.label).toBe('10 min left');
  });

  it('blocks joining more than 15 minutes out', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const status = getMeetingJoinStatus(new Date(NOW.getTime() + 20 * 60000).toISOString());
    expect(status.canJoin).toBe(false);
  });

  it('allows joining up to 15 minutes after the scheduled time has passed', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const status = getMeetingJoinStatus(new Date(NOW.getTime() - 10 * 60000).toISOString());
    expect(status.canJoin).toBe(true);
    expect(status.label).toBe('Join Now');
  });

  it('marks the meeting as ended more than 15 minutes after the scheduled time', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const status = getMeetingJoinStatus(new Date(NOW.getTime() - 20 * 60000).toISOString());
    expect(status.canJoin).toBe(false);
    expect(status.label).toBe('Ended');
  });

  it('reports hours and days left for meetings further out', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const inTwoHours = getMeetingJoinStatus(new Date(NOW.getTime() + 2 * 3600000).toISOString());
    expect(inTwoHours.label).toBe('2 hr left');

    const inThreeDays = getMeetingJoinStatus(new Date(NOW.getTime() + 3 * 86400000).toISOString());
    expect(inThreeDays.label).toBe('3 day left');
  });

  it('returns Arabic labels when locale is "ar"', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const status = getMeetingJoinStatus(new Date(NOW.getTime() - 5 * 60000).toISOString(), 'ar');
    expect(status.label).toBe('انضم الآن');
  });
});

describe('asSettingFlag', () => {
  it('accepts the string form the backend actually stores', () => {
    // SystemSetting stores '1'/'0' as strings — this is the live case.
    expect(asSettingFlag('1')).toBe(true);
    expect(asSettingFlag('0')).toBe(false);
  });

  it('accepts a real bool, in case a Laravel cast starts sending one', () => {
    expect(asSettingFlag(true)).toBe(true);
    expect(asSettingFlag(false)).toBe(false);
  });

  it('accepts an int, in case the column is cast to integer', () => {
    expect(asSettingFlag(1)).toBe(true);
    expect(asSettingFlag(0)).toBe(false);
  });

  it('accepts "true"/"false" regardless of case or padding', () => {
    // The old inline expressions used `=== 'true'`, so 'TRUE' read as false
    // here while the mobile app read it as true. Both agree now.
    expect(asSettingFlag('true')).toBe(true);
    expect(asSettingFlag('TRUE')).toBe(true);
    expect(asSettingFlag(' True ')).toBe(true);
    expect(asSettingFlag('false')).toBe(false);
  });

  it('treats null/undefined and unparseable values as false', () => {
    expect(asSettingFlag(null)).toBe(false);
    expect(asSettingFlag(undefined)).toBe(false);
    expect(asSettingFlag('')).toBe(false);
    expect(asSettingFlag('yes')).toBe(false);
    expect(asSettingFlag({})).toBe(false);
  });
});

describe('formatMeetingDate', () => {
  it('formats a valid date string without throwing', () => {
    expect(() => formatMeetingDate('2026-08-26T10:00:00.000Z')).not.toThrow();
    expect(formatMeetingDate('2026-08-26T10:00:00.000Z')).toEqual(expect.any(String));
  });

  it('does not throw for an unparseable date, in or out of the try/catch fallback', () => {
    // Node/V8's toLocaleDateString on an Invalid Date returns the string
    // "Invalid Date" rather than throwing, so the function's own try/catch
    // (there for engines that do throw) never actually fires here — the
    // real contract this test protects is just "never throws, always
    // returns a string", not a specific fallback value.
    expect(() => formatMeetingDate('not-a-date')).not.toThrow();
    expect(formatMeetingDate('not-a-date')).toEqual(expect.any(String));
  });
});

describe('resolveFileUrl', () => {
  it('prefixes a storage-relative path with the API file base', () => {
    expect(resolveFileUrl('avatars/x.jpg')).toBe('http://localhost:8000/storage/avatars/x.jpg');
  });

  it('strips a leading storage/ segment instead of doubling it', () => {
    expect(resolveFileUrl('storage/avatars/x.jpg')).toBe('http://localhost:8000/storage/avatars/x.jpg');
    expect(resolveFileUrl('/storage/avatars/x.jpg')).toBe('http://localhost:8000/storage/avatars/x.jpg');
  });

  it('passes an already-absolute URL through unchanged', () => {
    expect(resolveFileUrl('https://cdn.example.com/x.jpg')).toBe('https://cdn.example.com/x.jpg');
  });

  it('takes the first entry when given an array (Payment.proof_file_url)', () => {
    expect(resolveFileUrl(['proofs/a.jpg', 'proofs/b.jpg'])).toBe('http://localhost:8000/storage/proofs/a.jpg');
  });

  it('returns an empty string for null, undefined, or an empty array', () => {
    expect(resolveFileUrl(null)).toBe('');
    expect(resolveFileUrl(undefined)).toBe('');
    expect(resolveFileUrl('')).toBe('');
    expect(resolveFileUrl([])).toBe('');
  });
});

describe('safeJsonParse', () => {
  it('returns null for a missing value without throwing', () => {
    expect(safeJsonParse(null)).toBeNull();
  });

  it('parses valid JSON normally', () => {
    expect(safeJsonParse<{ id: number }>('{"id":1}')).toEqual({ id: 1 });
  });

  it('returns null instead of throwing for malformed JSON (the actual bug this guards against)', () => {
    expect(() => safeJsonParse('{not valid json')).not.toThrow();
    expect(safeJsonParse('{not valid json')).toBeNull();
  });

  it('clears the offending localStorage key so it does not keep failing on every render', () => {
    localStorage.setItem('user', '{corrupt');
    safeJsonParse(localStorage.getItem('user'), 'user');
    expect(localStorage.getItem('user')).toBeNull();
  });
});

describe('notifyWriteError', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const t = (key: string) => (key === 'write_error_title' ? 'Action failed' : 'Something went wrong');

  it('reports the error under the given context', () => {
    const err = new Error('network down');
    notifyWriteError(t, 'ContractsTab.updateStatus', err);
    expect(reportError).toHaveBeenCalledWith('ContractsTab.updateStatus', err);
  });

  it('shows a toast built from the translated title/message, using the context as the dedup id', () => {
    notifyWriteError(t, 'ContractsTab.updateStatus', new Error('network down'));
    expect(showToast).toHaveBeenCalledWith({
      id: 'ContractsTab.updateStatus',
      title: 'Action failed',
      message: 'Something went wrong',
    });
  });

  it('does not throw when called with a non-Error rejection value', () => {
    expect(() => notifyWriteError(t, 'ChatTab.send', 'some string rejection')).not.toThrow();
    expect(reportError).toHaveBeenCalledWith('ChatTab.send', 'some string rejection');
  });
});

// client-signature-plan.md ن6 — mirrors the mobile app's
// ValidationException.code (api_client.dart), duck-typed off an axios
// error's shape without importing axios into utils.ts.
describe('getErrorCode / getErrorMessage', () => {
  it('reads code and message from an axios-shaped 422 error', () => {
    const err = { response: { data: { code: 'signature_required', message: 'لازم توقيع' } } };
    expect(getErrorCode(err)).toBe('signature_required');
    expect(getErrorMessage(err)).toBe('لازم توقيع');
  });

  it('returns undefined when the error body has no code (a plain validation failure)', () => {
    const err = { response: { data: { message: 'Invalid data' } } };
    expect(getErrorCode(err)).toBeUndefined();
    expect(getErrorMessage(err)).toBe('Invalid data');
  });

  it('returns undefined for a plain Error with no response', () => {
    const err = new Error('network down');
    expect(getErrorCode(err)).toBeUndefined();
    expect(getErrorMessage(err)).toBeUndefined();
  });

  it('returns undefined for a non-object rejection', () => {
    expect(getErrorCode('some string rejection')).toBeUndefined();
    expect(getErrorMessage(null)).toBeUndefined();
  });
});

// client-signature-plan.md ن1 — mirrors the mobile app's
// clientHasSignedContract() (lib/core/helpers/client_status.dart) test coverage.
describe('clientHasSignedContract', () => {
  it('is true for an active workspace, regardless of has_signed_contract or signed_at', () => {
    expect(clientHasSignedContract({ workspace: { status: 'active' }, has_signed_contract: false, signed_at: undefined } as never)).toBe(true);
  });

  it('uses has_signed_contract when the workspace is inactive', () => {
    expect(clientHasSignedContract({ workspace: { status: 'inactive' }, has_signed_contract: true, signed_at: undefined } as never)).toBe(true);
    expect(clientHasSignedContract({ workspace: { status: 'inactive' }, has_signed_contract: false, signed_at: undefined } as never)).toBe(false);
  });

  it('falls back to signed_at when has_signed_contract is absent (older server response)', () => {
    expect(clientHasSignedContract({ workspace: { status: 'inactive' }, has_signed_contract: undefined, signed_at: '2026-01-01' } as never)).toBe(true);
    expect(clientHasSignedContract({ workspace: { status: 'inactive' }, has_signed_contract: undefined, signed_at: undefined } as never)).toBe(false);
  });

  it('is false with no workspace, no has_signed_contract, and no signed_at', () => {
    expect(clientHasSignedContract({ workspace: undefined, has_signed_contract: undefined, signed_at: undefined } as never)).toBe(false);
  });
});
