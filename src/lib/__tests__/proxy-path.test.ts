import { describe, it, expect } from 'vitest';
import { hasUnsafePathSegment } from '../proxy-path';

describe('hasUnsafePathSegment', () => {
  it('allows normal API route segments', () => {
    expect(hasUnsafePathSegment(['workspaces', '42', 'contracts'])).toBe(false);
    expect(hasUnsafePathSegment(['auth', 'forgot-password'])).toBe(false);
  });

  it('rejects dot segments, encoded traversal, slashes, and backslashes', () => {
    expect(hasUnsafePathSegment(['workspaces', '..', 'users'])).toBe(true);
    expect(hasUnsafePathSegment(['.'])).toBe(true);
    expect(hasUnsafePathSegment(['%2e%2e'])).toBe(true);
    expect(hasUnsafePathSegment(['foo..bar'])).toBe(true);
    expect(hasUnsafePathSegment(['a%2fb'])).toBe(true);
    expect(hasUnsafePathSegment(['a\\b'])).toBe(true);
    expect(hasUnsafePathSegment(['%E0%A4%A'])).toBe(true);
  });
});
