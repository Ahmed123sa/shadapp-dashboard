import { describe, it, expect } from 'vitest';
import { formatNotificationTime } from '../notification-time';

// Local-time dates, so the "today / yesterday" edges do not depend on the
// machine's time zone.
const NOW = new Date(2026, 10, 8, 18, 0, 0); // 8 Nov 2026, 18:00
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;
const ARABIC_DIGIT = /[٠-٩]/;
const LATIN_DIGIT = /[0-9]/;

const en = (iso: string) => formatNotificationTime(iso, 'en', 'Just now', NOW);
const ar = (iso: string) => formatNotificationTime(iso, 'ar', 'الآن', NOW);

describe('formatNotificationTime', () => {
  it('says just now for the last minute, and for a clock slightly ahead', () => {
    expect(en(ago(20_000))).toBe('Just now');
    expect(en(ago(-5_000))).toBe('Just now');
    expect(ar(ago(20_000))).toBe('الآن');
  });

  it('counts minutes inside the last hour', () => {
    expect(en(ago(5 * MIN))).toBe('5 minutes ago');
    expect(ar(ago(5 * MIN))).toMatch(ARABIC_DIGIT);
  });

  it('shows the time for earlier today', () => {
    const today = new Date(2026, 10, 8, 15, 40).toISOString();
    expect(en(today)).toMatch(/^3:40\sPM$/);
    expect(ar(today)).toMatch(ARABIC_DIGIT);
  });

  it('says yesterday for the day before, whatever the hour', () => {
    expect(en(new Date(2026, 10, 7, 23, 50).toISOString())).toBe('Yesterday');
    expect(en(new Date(2026, 10, 7, 0, 10).toISOString())).toBe('Yesterday');
    expect(ar(new Date(2026, 10, 7, 12, 0).toISOString())).toBe('أمس');
  });

  it('shows a short date this year and adds the year for older ones', () => {
    expect(en(new Date(2026, 10, 1, 9, 0).toISOString())).toBe('Nov 1');
    expect(en(new Date(2025, 10, 8, 9, 0).toISOString())).toBe('Nov 8, 2025');
  });

  it('never prints Arabic digits in English, nor Latin digits in Arabic', () => {
    const older = new Date(2026, 9, 3, 9, 0).toISOString();
    expect(en(older)).not.toMatch(ARABIC_DIGIT);
    expect(ar(older)).not.toMatch(LATIN_DIGIT);
  });

  it('returns nothing for a broken date', () => {
    expect(en('not a date')).toBe('');
  });
});
