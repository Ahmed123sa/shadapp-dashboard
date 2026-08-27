import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, logout, getUser, isAuthenticated } from '../auth';

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    })
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('login', () => {
  it('trims the email, stores the user and returns it', async () => {
    const user = { id: 1, name: 'Ahmed', email: 'a@a.com', role: 'account_manager' as const };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ user }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await login('  a@a.com  ', 'secret');

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@a.com', password: 'secret' });
    expect(result.user).toEqual(user);
    expect(getUser()).toEqual(user);
  });

  it('throws with the server message and attaches the response on failure', async () => {
    mockFetchOnce({ message: 'Invalid credentials' }, false, 401);

    await expect(login('a@a.com', 'wrong')).rejects.toMatchObject({
      message: 'Invalid credentials',
      response: { status: 401 },
    });
  });

  it('clears any previously stored user before attempting login', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 999 }));
    mockFetchOnce({ message: 'nope' }, false, 401);

    await expect(login('a@a.com', 'wrong')).rejects.toThrow();

    expect(localStorage.getItem('user')).toBeNull();
  });
});

describe('logout', () => {
  it('clears the stored user and redirects to /login even if the request fails', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1 }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    delete (window as any).location;
    (window as any).location = { href: '' };

    await logout();

    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.href).toBe('/login');
  });
});

describe('getUser / isAuthenticated', () => {
  it('is false with nothing stored', () => {
    expect(getUser()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('is true once a user is stored', () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'A', email: 'a@a.com', role: 'super_admin' }));
    expect(isAuthenticated()).toBe(true);
  });
});
