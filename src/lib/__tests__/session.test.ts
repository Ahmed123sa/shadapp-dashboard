import { describe, it, expect, vi, afterEach } from 'vitest';

// LARAVEL_ORIGIN/LARAVEL_API_BASE are computed once, at module load, from
// process.env.NEXT_PUBLIC_API_URL. Testing both branches of that derivation
// means loading the module fresh under each env value rather than importing
// it once at the top of the file.
async function loadWithApiUrl(url: string | undefined) {
  vi.resetModules();
  if (url === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = url;
  }
  return import('../session');
}

const ORIGINAL_URL = process.env.NEXT_PUBLIC_API_URL;

afterEach(() => {
  if (ORIGINAL_URL === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL_URL;
  }
});

describe('LARAVEL_ORIGIN / LARAVEL_API_BASE', () => {
  it('falls back to localhost:8000 when NEXT_PUBLIC_API_URL is unset', async () => {
    const { LARAVEL_ORIGIN, LARAVEL_API_BASE } = await loadWithApiUrl(undefined);
    expect(LARAVEL_ORIGIN).toBe('http://localhost:8000');
    expect(LARAVEL_API_BASE).toBe('http://localhost:8000/api');
  });

  it('strips a trailing /api from a configured URL to derive the origin', async () => {
    const { LARAVEL_ORIGIN, LARAVEL_API_BASE } = await loadWithApiUrl('https://api.shadapp.com/api');
    expect(LARAVEL_ORIGIN).toBe('https://api.shadapp.com');
    expect(LARAVEL_API_BASE).toBe('https://api.shadapp.com/api');
  });

  it('strips a trailing /api/ (with slash) as well', async () => {
    const { LARAVEL_ORIGIN } = await loadWithApiUrl('https://api.shadapp.com/api/');
    expect(LARAVEL_ORIGIN).toBe('https://api.shadapp.com');
  });
});

describe('SESSION_ROLE_COOKIE', () => {
  it('is a distinct cookie name from the session token and session type', async () => {
    const { SESSION_COOKIE, SESSION_TYPE_COOKIE, SESSION_ROLE_COOKIE } = await loadWithApiUrl(undefined);
    expect(SESSION_ROLE_COOKIE).toBe('sa_session_role');
    expect(new Set([SESSION_COOKIE, SESSION_TYPE_COOKIE, SESSION_ROLE_COOKIE]).size).toBe(3);
  });
});

describe('sessionCookieOptions', () => {
  it('is not marked secure outside production', async () => {
    const originalEnv = process.env.NODE_ENV;
    // @ts-expect-error - NODE_ENV is normally readonly in the type, writable at runtime
    process.env.NODE_ENV = 'test';
    const { sessionCookieOptions } = await loadWithApiUrl(undefined);
    const opts = sessionCookieOptions();
    expect(opts.secure).toBe(false);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.maxAge).toBe(60 * 60 * 24);
    // @ts-expect-error - restoring
    process.env.NODE_ENV = originalEnv;
  });

  it('is marked secure in production, so the session cookie is never sent over plain HTTP', async () => {
    const originalEnv = process.env.NODE_ENV;
    // @ts-expect-error - NODE_ENV is typed readonly, but this test needs to set it
    process.env.NODE_ENV = 'production';
    const { sessionCookieOptions } = await loadWithApiUrl(undefined);
    expect(sessionCookieOptions().secure).toBe(true);
    // @ts-expect-error - restoring
    process.env.NODE_ENV = originalEnv;
  });
});
