import { NextRequest, NextResponse } from 'next/server';
import { LARAVEL_API_BASE, SESSION_COOKIE, SESSION_TYPE_COOKIE } from '@/lib/session';

// Clears the httpOnly session cookie (client JS cannot do this itself).
// For staff (super_admin/account_manager) sessions we also ask Laravel to
// revoke the Sanctum token server-side via /auth/logout.
//
// KNOWN GAP: Laravel has no equivalent revoke endpoint reachable by the
// 'client'/'sub_user' guards (only 'auth:sanctum' i.e. staff can hit
// /auth/logout — see routes/api.php:85). So for client/sub_user sessions
// this only ends the session from the browser's point of view; the
// underlying token stays valid server-side until it naturally expires.
// This matches the pre-existing behavior (the old client-side logout never
// called the backend either) — not a regression, but worth adding a real
// client-facing revoke route to Laravel as a follow-up.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionType = req.cookies.get(SESSION_TYPE_COOKIE)?.value;

  if (token && sessionType === 'staff') {
    try {
      await fetch(`${LARAVEL_API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
    } catch {
      // Best-effort — still clear the local session below even if this fails.
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(SESSION_TYPE_COOKIE);
  return response;
}
