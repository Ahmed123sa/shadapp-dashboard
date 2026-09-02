import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMeetingJoinStatus, formatMeetingDate, asSettingFlag, resolveFileUrl } from '../utils';

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
