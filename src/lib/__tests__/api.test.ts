import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';

vi.mock('../echo', () => ({
  getActiveSocketId: vi.fn(() => null),
}));

// The 429 retry path backs off for real seconds (2s, 4s, 8s). Stubbing
// setTimeout to fire immediately keeps the test fast without touching the
// retry logic itself — only how quickly the delay elapses.
vi.stubGlobal('setTimeout', ((fn: () => void) => {
  fn();
  return 0 as unknown as ReturnType<typeof setTimeout>;
}) as typeof setTimeout);

import api from '../api';
import { getActiveSocketId } from '../echo';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(getActiveSocketId).mockReturnValue(null);
});

afterEach(() => {
  mock.restore();
  vi.unstubAllGlobals();
  vi.stubGlobal('setTimeout', ((fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);
  localStorage.clear();
});

describe('request interceptor', () => {
  it('attaches X-Socket-Id when an active socket exists', async () => {
    vi.mocked(getActiveSocketId).mockReturnValue('socket-123');
    mock.onGet('/ping').reply((config) => {
      expect(config.headers?.['X-Socket-Id']).toBe('socket-123');
      return [200, { ok: true }];
    });

    await api.get('/ping');
  });

  it('omits X-Socket-Id when there is no active socket', async () => {
    mock.onGet('/ping').reply((config) => {
      expect(config.headers?.['X-Socket-Id']).toBeUndefined();
      return [200, { ok: true }];
    });

    await api.get('/ping');
  });
});

describe('response interceptor — 401 handling', () => {
  it('clears the staff session and redirects to /login', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1 }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    delete (window as any).location;
    (window as any).location = { href: '' };
    mock.onGet('/me').reply(401);

    await expect(api.get('/me')).rejects.toBeTruthy();

    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('clears the client session and redirects to /client-login', async () => {
    localStorage.setItem('client', JSON.stringify({ id: 1 }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    delete (window as any).location;
    (window as any).location = { href: '' };
    mock.onGet('/me').reply(401);

    await expect(api.get('/me')).rejects.toBeTruthy();

    expect(localStorage.getItem('client')).toBeNull();
    expect(window.location.href).toBe('/client-login');
  });
});

describe('response interceptor — missing config', () => {
  it('rejects with the original error instead of throwing when err.config is undefined', async () => {
    // A request interceptor throwing (e.g. getActiveSocketId() blowing up)
    // produces a rejection with no .config attached, since axios never
    // finished building the request. Before the guard, `config.__retryCount`
    // below would itself throw a TypeError that replaced this error.
    vi.mocked(getActiveSocketId).mockImplementation(() => {
      throw new Error('socket boom');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(api.get('/whatever')).rejects.toThrow('socket boom');

    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('response interceptor — 429 retry', () => {
  it('retries with backoff and resolves once the server stops rate-limiting', async () => {
    let calls = 0;
    mock.onGet('/limited').reply(() => {
      calls += 1;
      return calls <= 2 ? [429] : [200, { ok: true }];
    });

    const res = await api.get('/limited');

    expect(calls).toBe(3);
    expect(res.data).toEqual({ ok: true });
  });

  it('gives up after 3 retries and rejects', async () => {
    let calls = 0;
    mock.onGet('/always-limited').reply(() => {
      calls += 1;
      return [429];
    });

    await expect(api.get('/always-limited')).rejects.toBeTruthy();
    // Initial attempt + 3 retries.
    expect(calls).toBe(4);
  });
});
