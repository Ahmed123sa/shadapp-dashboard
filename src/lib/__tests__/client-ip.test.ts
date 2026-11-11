import { describe, it, expect } from 'vitest';
import { extractClientIp, forwardClientIpHeaders } from '../client-ip';

describe('extractClientIp', () => {
  it('prefers x-real-ip set directly by nginx', () => {
    const headers = new Headers({
      'x-real-ip': '197.32.218.17',
      'x-forwarded-for': '9.9.9.9, 197.32.218.17',
    });
    expect(extractClientIp(headers)).toBe('197.32.218.17');
  });

  it('uses the rightmost valid IP from x-forwarded-for when x-real-ip is absent', () => {
    const headers = new Headers({
      'x-forwarded-for': '1.1.1.1, 197.35.29.6',
    });
    expect(extractClientIp(headers)).toBe('197.35.29.6');
  });

  it('ignores malformed or non-IP values', () => {
    const headers = new Headers({
      'x-real-ip': 'not an ip!',
      'x-forwarded-for': 'bad-value, 2001:db8::1',
    });
    expect(extractClientIp(headers)).toBe('2001:db8::1');
  });

  it('returns null when neither header carries a valid IP', () => {
    expect(extractClientIp(new Headers())).toBeNull();
    expect(extractClientIp(new Headers({ 'x-real-ip': 'evil header\r\n' }))).toBeNull();
  });

  it('builds X-Forwarded-For header object for upstream fetch', () => {
    const req = { headers: new Headers({ 'x-real-ip': '197.32.218.17' }) } as never;
    expect(forwardClientIpHeaders(req)).toEqual({ 'X-Forwarded-For': '197.32.218.17' });
    expect(forwardClientIpHeaders({ headers: new Headers() } as never)).toEqual({});
  });
});
