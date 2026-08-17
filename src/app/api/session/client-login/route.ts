import { NextRequest, NextResponse } from 'next/server';
import { LARAVEL_API_BASE, SESSION_COOKIE, SESSION_TYPE_COOKIE, sessionCookieOptions } from '@/lib/session';

// Client / sub-user login. Same pattern as /api/session/login — the token
// stays server-side, only the client/sub_user/workspace objects go back to
// the browser.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ message: 'Email and password are required.' }, { status: 422 });
  }

  const upstream = await fetch(`${LARAVEL_API_BASE}/auth/client/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok || !data?.token) {
    return NextResponse.json(data ?? { message: 'Login failed.' }, { status: upstream.status || 401 });
  }

  const response = NextResponse.json({
    login_type: data.login_type,
    client: data.client,
    sub_user: data.sub_user,
    workspace_id: data.workspace_id,
  });
  response.cookies.set(SESSION_COOKIE, data.token, sessionCookieOptions());
  response.cookies.set(SESSION_TYPE_COOKIE, data.login_type === 'sub_user' ? 'sub_user' : 'client', sessionCookieOptions());
  return response;
}
