import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('next/server', () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    headers: Headers;
    cookies = { set: vi.fn() };
    constructor(body: unknown, init?: { status?: number; headers?: HeadersInit }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
    }
    static json(body: unknown, init?: { status?: number }) {
      return new MockNextResponse(body, { status: init?.status ?? 200 });
    }
  }
  return { NextResponse: MockNextResponse };
});

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  // @ts-expect-error - restoring NODE_ENV
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  global.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe('session login routes IP forwarding', () => {
  it('forwards the nginx client IP on /api/session/login', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'tok', user: { id: 1, role: 'super_admin' } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { POST } = await import('../../app/api/session/login/route');
    const req = {
      headers: new Headers({ 'x-real-ip': '197.32.218.17', 'x-forwarded-for': '9.9.9.9, 197.32.218.17' }),
      json: async () => ({ email: 'admin@test.com', password: 'secret' }),
    } as never;

    const res = (await POST(req)) as unknown as { status: number };
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['X-Forwarded-For']).toBe('197.32.218.17');
  });

  it('forwards the nginx client IP on /api/session/client-login', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'tok', login_type: 'client', client: { id: 2 }, workspace_id: 5 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { POST } = await import('../../app/api/session/client-login/route');
    const req = {
      headers: new Headers({ 'x-forwarded-for': '197.35.29.6' }),
      json: async () => ({ email: 'client@test.com', password: 'secret' }),
    } as never;

    const res = (await POST(req)) as unknown as { status: number };
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['X-Forwarded-For']).toBe('197.35.29.6');
  });
});

describe('sentry-example-api production guard', () => {
  it('returns 404 when NODE_ENV is production', async () => {
    // @ts-expect-error - testing production branch
    process.env.NODE_ENV = 'production';
    const { GET } = await import('../../app/api/sentry-example-api/route');
    const res = GET() as unknown as { status: number };
    expect(res.status).toBe(404);
  });
});
