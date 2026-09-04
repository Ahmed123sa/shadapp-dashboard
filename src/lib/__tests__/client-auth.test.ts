import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clientLogin,
  clientLogout,
  getClient,
  getSubUser,
  isSubUser,
  isClientAuthenticated,
  hasSubUserPermission,
} from '../client-auth';

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

describe('clientLogin', () => {
  it('stores the client under "client" for a primary client login', async () => {
    const client = { id: 1, company_name: 'Acme', contact_person: 'A', email: 'a@a.com', status: 'active', has_signed: true };
    mockFetchOnce({ login_type: 'client', client, workspace_id: 5 });

    const result = await clientLogin('a@a.com', 'secret');

    expect(result.client).toEqual(client);
    expect(getClient()).toEqual(client);
    expect(getSubUser()).toBeNull();
  });

  it('stores sub_user, sub_user_client and a flagged client for a sub-user login', async () => {
    const client = { id: 1, company_name: 'Acme', contact_person: 'A', email: 'a@a.com', status: 'active', has_signed: true };
    const sub_user = { id: 9, name: 'Sub', email: 's@a.com', permissions: { view_files: true } };
    mockFetchOnce({ login_type: 'sub_user', client, sub_user, workspace_id: 5 });

    await clientLogin('s@a.com', 'secret');

    expect(getSubUser()).toEqual(sub_user);
    // The stored "client" record must carry is_sub_user so the rest of the
    // app can tell a sub-user session from a primary one without a second
    // lookup.
    expect(getClient()).toEqual({ ...client, is_sub_user: true });
  });

  it('throws with the server message when the response is not ok', async () => {
    mockFetchOnce({ message: 'بيانات الدخول غير صحيحة' }, false, 422);

    await expect(clientLogin('a@a.com', 'wrong')).rejects.toThrow('بيانات الدخول غير صحيحة');
  });

  it('clears any previous session before attempting login', async () => {
    localStorage.setItem('client', JSON.stringify({ id: 999 }));
    localStorage.setItem('sub_user', JSON.stringify({ id: 999 }));
    mockFetchOnce({ message: 'nope' }, false, 401);

    await expect(clientLogin('a@a.com', 'wrong')).rejects.toThrow();

    // A failed login must not leave a stale, previously-logged-in session
    // sitting in localStorage looking valid.
    expect(localStorage.getItem('client')).toBeNull();
    expect(localStorage.getItem('sub_user')).toBeNull();
  });
});

describe('clientLogout', () => {
  it('clears all client-related session keys and redirects to /client-login', async () => {
    localStorage.setItem('client', JSON.stringify({ id: 1 }));
    localStorage.setItem('sub_user', JSON.stringify({ id: 2 }));
    localStorage.setItem('sub_user_client', JSON.stringify({ id: 1 }));
    mockFetchOnce({});

    delete (window as any).location;
    (window as any).location = { href: '' };

    await clientLogout();

    expect(localStorage.getItem('client')).toBeNull();
    expect(localStorage.getItem('sub_user')).toBeNull();
    expect(localStorage.getItem('sub_user_client')).toBeNull();
    expect(window.location.href).toBe('/client-login');
  });

  it('still redirects even if the logout request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    delete (window as any).location;
    (window as any).location = { href: '' };

    await clientLogout();

    expect(window.location.href).toBe('/client-login');
  });
});

describe('hasSubUserPermission', () => {
  it('always allows a primary client (not a sub-user)', () => {
    localStorage.setItem('client', JSON.stringify({ id: 1 }));
    expect(hasSubUserPermission('view_files')).toBe(true);
  });

  it('allows a sub-user only for permissions explicitly granted', () => {
    localStorage.setItem('client', JSON.stringify({ id: 1, is_sub_user: true }));
    localStorage.setItem('sub_user', JSON.stringify({ id: 9, permissions: { view_files: true } }));

    expect(hasSubUserPermission('view_files')).toBe(true);
    expect(hasSubUserPermission('manage_payments')).toBe(false);
  });

  // Regression test: an earlier version returned true whenever
  // getSubUser() was null, which also fired for a genuine sub-user with a
  // missing/corrupt permissions object — a fail-open bug. A sub-user with
  // no readable permissions must be denied, not defaulted to allowed.
  it('fails closed for a sub-user with a missing permissions object', () => {
    localStorage.setItem('client', JSON.stringify({ id: 1, is_sub_user: true }));
    localStorage.setItem('sub_user', JSON.stringify({ id: 9 }));

    expect(isSubUser()).toBe(true);
    expect(hasSubUserPermission('view_files')).toBe(false);
  });

  // Before safeJsonParse existed, corrupt JSON in localStorage made
  // JSON.parse throw uncaught, so "fails closed" meant "crashes the caller"
  // — a crude but effective way to stop a bad permission check from
  // resolving to true. Now getSubUser() catches that and returns null
  // instead (see lib/utils.ts), so this must fail closed by *denying* the
  // permission rather than by throwing. isSubUser() reading client.is_sub_user
  // (not sub_user's own presence) is what keeps that denial correct instead
  // of the corrupt record being mistaken for "not a sub-user at all".
  it('fails closed for a sub-user with a corrupt session (unparseable JSON)', () => {
    localStorage.setItem('client', JSON.stringify({ id: 1, is_sub_user: true }));
    localStorage.setItem('sub_user', 'not-json');

    expect(() => hasSubUserPermission('view_files')).not.toThrow();
    expect(hasSubUserPermission('view_files')).toBe(false);
  });
});

describe('isClientAuthenticated', () => {
  it('is false with no stored client', () => {
    expect(isClientAuthenticated()).toBe(false);
  });

  it('is true once a client is stored', () => {
    localStorage.setItem('client', JSON.stringify({ id: 1 }));
    expect(isClientAuthenticated()).toBe(true);
  });
});
