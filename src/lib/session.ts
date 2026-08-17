// Shared constants for the httpOnly-cookie session used by the Next.js
// route handlers (src/app/api/session/*, src/app/api/proxy/*) and the
// auth-gating logic in src/proxy.ts. The actual Sanctum bearer token never
// reaches client-side JS — it lives only in SESSION_COOKIE, which is
// httpOnly and can only be read/written on the server.

export const SESSION_COOKIE = 'sa_session';
export const SESSION_TYPE_COOKIE = 'sa_session_type'; // 'staff' | 'client' | 'sub_user' — non-secret, lets proxy.ts and route handlers tell guards apart without decoding the token.

export const LARAVEL_ORIGIN = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
).replace(/\/api\/?$/, '');

export const LARAVEL_API_BASE = `${LARAVEL_ORIGIN}/api`;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    // Matches config/sanctum.php's `expiration` (1440 minutes = 24h) on the
    // backend. If that value changes, update this too — a longer cookie
    // lifetime than the token's actual validity just means stale requests
    // fail with 401 (handled) rather than any real exposure, but keeping
    // them in sync avoids confusing "logged out for no reason" UX.
    maxAge: 60 * 60 * 24,
  };
}
