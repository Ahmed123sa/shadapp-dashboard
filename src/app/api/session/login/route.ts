import { NextRequest, NextResponse } from 'next/server';
import { LARAVEL_API_BASE, SESSION_COOKIE, SESSION_TYPE_COOKIE, SESSION_ROLE_COOKIE, sessionCookieOptions } from '@/lib/session';

// Admin / account-manager login. Forwards credentials to Laravel, and on
// success stores the Sanctum token in an httpOnly cookie instead of
// returning it to client JS. Only the (non-secret) user object is returned
// to the browser for UI state.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ message: 'Email and password are required.' }, { status: 422 });
  }

  const upstream = await fetch(`${LARAVEL_API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok || !data?.token) {
    return NextResponse.json(data ?? { message: 'Login failed.' }, { status: upstream.status || 401 });
  }

  const response = NextResponse.json({ user: data.user });
  response.cookies.set(SESSION_COOKIE, data.token, sessionCookieOptions());
  response.cookies.set(SESSION_TYPE_COOKIE, 'staff', sessionCookieOptions());
  response.cookies.set(SESSION_ROLE_COOKIE, data.user?.role || '', sessionCookieOptions());
  return response;
}
