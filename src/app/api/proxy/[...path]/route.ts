import { NextRequest, NextResponse } from 'next/server';
import { LARAVEL_API_BASE, SESSION_COOKIE } from '@/lib/session';

// Generic same-origin proxy: the browser talks to /api/proxy/*, never
// directly to the Laravel origin, and never holds the bearer token. This
// route reads the httpOnly session cookie server-side and attaches it as
// Authorization when forwarding to Laravel. Request/response bodies are
// streamed through untouched so multipart file uploads work without any
// special-casing here.

const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  'host', 'connection', 'content-length', 'cookie', 'authorization',
]);

async function forward(req: NextRequest, method: string, path: string[]) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const targetUrl = `${LARAVEL_API_BASE}/${path.join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  if (token) headers.set('authorization', `Bearer ${token}`);
  headers.set('accept', headers.get('accept') || 'application/json');

  const hasBody = !['GET', 'HEAD'].includes(method);

  // `duplex: 'half'` isn't in every TS lib.dom.d.ts version's RequestInit
  // yet, but Node's fetch (undici) requires it whenever body is a stream —
  // declare it via an extended type instead of a suppression comment so
  // this doesn't break depending on the exact TypeScript version installed.
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    body: hasBody ? req.body : undefined,
  };
  if (hasBody) init.duplex = 'half';

  const upstream = await fetch(targetUrl, init);

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') responseHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, 'GET', (await params).path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, 'POST', (await params).path);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, 'PUT', (await params).path);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, 'PATCH', (await params).path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, 'DELETE', (await params).path);
}
