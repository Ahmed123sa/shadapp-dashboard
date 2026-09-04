import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_TYPE_COOKIE } from '@/lib/session';
import { assertProductionEnv } from '@/lib/env-guard';

// Runs once, when this module is first loaded — which Next.js does before
// serving any request. Throwing here means a misconfigured production
// deploy fails to start (with a clear message in the process logs) instead
// of quietly serving traffic pointed at localhost. See lib/env-guard.ts.
assertProductionEnv();

const locales = ['ar', 'en'];
const defaultLocale = 'en';
// NEXT_PUBLIC_API_URL is the *API* base (e.g. http://host:8000/api) — strip
// the /api suffix to get the Laravel origin that actually serves /storage/*.
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');

function getLocale(request: NextRequest): string {
  const cookie = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookie && locales.includes(cookie)) return cookie;

  const acceptLang = request.headers.get('accept-language') || '';
  for (const part of acceptLang.split(',')) {
    const lang = part.trim().split(';')[0].split('-')[0];
    if (locales.includes(lang)) return lang;
  }

  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proxy /storage/* by fetching the file from Laravel and passing it through.
  //
  // KNOWN RESIDUAL RISK: this forwards the visitor's cookies so a future
  // authenticated backend route can use them, but today Laravel's /storage/*
  // (public disk) serves every file with zero access control of its own —
  // credentials or not, anyone who knows/guesses a path can fetch it. This
  // proxy cannot close that gap by itself; it requires either moving these
  // files off the "public" disk visibility onto an authenticated streaming
  // endpoint that checks resource ownership, or serving them via short-lived
  // signed URLs. Track this as a follow-up before relying on file secrecy.
  if (pathname.startsWith('/storage/')) {
    const url = new URL(pathname, API_URL);
    const upstream = await fetch(url.toString(), {
      headers: { cookie: request.headers.get('cookie') ?? '' },
    });
    const headers = new Headers();
    const passHeaders = ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified'];
    for (const key of passHeaders) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  // Real server-side route protection. Previously every guard here was a
  // client-side useEffect redirect (see dashboard/layout.tsx,
  // client-dashboard/page.tsx) — meaning an anonymous visitor was still
  // served the full page HTML/JS and only found out they were unauthorized
  // after hydration. This runs before any page code, gated on the httpOnly
  // session cookie the /api/session/* route handlers set.
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionType = request.cookies.get(SESSION_TYPE_COOKIE)?.value;

  if (pathname.startsWith('/dashboard')) {
    if (!sessionToken || sessionType !== 'staff') {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith('/client-dashboard')) {
    if (!sessionToken || (sessionType !== 'client' && sessionType !== 'sub_user')) {
      const loginUrl = new URL('/client-login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  const locale = getLocale(request);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('X-NEXT-INTL-LOCALE', locale);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.cookies.set('NEXT_LOCALE', locale, {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel).*)'],
};
