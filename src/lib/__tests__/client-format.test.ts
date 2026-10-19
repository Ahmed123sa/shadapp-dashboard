import { describe, it, expect } from 'vitest';
import { formatNumber, formatShortDate, formatFileSize, formatTime } from '../client-format';

describe('client-format', () => {
  it('formats numbers per locale and rejects junk', () => {
    expect(formatNumber(16530, 'en')).toBe('16,530');
    expect(formatNumber('1234.5', 'en')).toBe('1,234.5');
    expect(formatNumber(16530, 'ar')).toContain('١٦');
    expect(formatNumber('abc', 'en')).toBe('');
    expect(formatNumber(null, 'en')).toBe('');
  });

  it('formats short dates and tolerates bad input', () => {
    expect(formatShortDate('2026-10-17T10:00:00Z', 'en')).toMatch(/17\s+Oct/);
    expect(formatShortDate('', 'en')).toBe('');
    expect(formatShortDate('not a date', 'en')).toBe('');
  });

  it('formats times', () => {
    expect(formatTime('2026-10-17T14:05:00', 'en')).toMatch(/2:05/);
    expect(formatTime(undefined, 'en')).toBe('');
  });

  it('formats file sizes', () => {
    expect(formatFileSize(0)).toBe('');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(310 * 1024)).toBe('310 KB');
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe('2.4 MB');
    expect(formatFileSize(48 * 1024 * 1024)).toBe('48 MB');
  });
});
