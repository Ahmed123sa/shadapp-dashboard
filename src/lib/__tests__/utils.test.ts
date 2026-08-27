import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMeetingJoinStatus, formatMeetingDate } from '../utils';

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
