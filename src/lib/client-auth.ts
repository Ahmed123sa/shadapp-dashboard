import { safeJsonParse } from './utils';

export interface ClientSession {
  login_type: 'client' | 'sub_user';
  client: {
    id: number;
    company_name: string;
    contact_person: string;
    email: string;
    status: string;
    has_signed: boolean;
    avatar_url?: string;
    // Only present once clientLogin() stores it for a sub-user session (see
    // below) — isSubUser() reads this rather than "is sub_user present and
    // parseable", so a corrupt/missing sub_user permissions record can't be
    // mistaken for "not a sub-user at all" (see isSubUser()'s comment).
    is_sub_user?: boolean;
  };
  sub_user?: {
    id: number;
    name: string;
    email: string;
    permissions: Record<string, boolean>;
    avatar_url?: string;
  };
  workspace_id: number | null;
}

// The bearer token never touches this file (or localStorage) anymore — it
// lives only in an httpOnly cookie set by /api/session/client-login. This
// calls that route handler directly (not the /api/proxy axios instance)
// since it's a same-origin Next.js route, not a Laravel API call.
export async function clientLogin(email: string, password: string): Promise<ClientSession> {
  localStorage.removeItem('client');
  localStorage.removeItem('sub_user');
  localStorage.removeItem('sub_user_client');
  const res = await fetch('/api/session/client-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data?.message || 'Login failed'), { response: { data, status: res.status } });
  }

  if (data.login_type === 'sub_user') {
    localStorage.setItem('sub_user', JSON.stringify(data.sub_user));
    localStorage.setItem('sub_user_client', JSON.stringify(data.client));
    localStorage.setItem('client', JSON.stringify({ ...data.client, is_sub_user: true }));
  } else {
    localStorage.setItem('client', JSON.stringify(data.client));
  }

  return data;
}

export async function clientLogout(): Promise<void> {
  localStorage.removeItem('client');
  localStorage.removeItem('sub_user');
  localStorage.removeItem('sub_user_client');
  try {
    await fetch('/api/session/logout', { method: 'POST' });
  } catch {
    // Best-effort — still redirect below even if this fails.
  }
  window.location.href = '/client-login';
}

export function getClient(): ClientSession['client'] | null {
  if (typeof window === 'undefined') return null;
  return safeJsonParse<ClientSession['client']>(localStorage.getItem('client'), 'client');
}

export function getSubUser(): NonNullable<ClientSession['sub_user']> | null {
  if (typeof window === 'undefined') return null;
  return safeJsonParse<NonNullable<ClientSession['sub_user']>>(localStorage.getItem('sub_user'), 'sub_user');
}

// Deliberately keyed off `client.is_sub_user` rather than "does getSubUser()
// return something truthy". The latter used to double as the sub-user
// signal, which meant a corrupt or missing `sub_user` permissions record
// (safeJsonParse now returns null for both, rather than throwing) would read
// as "this is a primary client" and skip the permission check entirely —
// exactly the fail-open bug hasSubUserPermission's own comment warns about.
// The `client` record's `is_sub_user` flag is set once at login time and
// doesn't depend on the separate `sub_user` record parsing cleanly later.
export function isSubUser(): boolean {
  return !!getClient()?.is_sub_user;
}

// UI convenience only, same caveat as isAuthenticated() in lib/auth.ts —
// the real gate is the httpOnly cookie checked server-side in src/proxy.ts.
export function isClientAuthenticated(): boolean {
  return !!getClient();
}

// A primary client account (not a sub-user) is never permission-restricted,
// so it always passes. A sub-user, however, must fail closed: if we can't
// positively confirm the permission is granted (missing/corrupt session),
// deny — don't default to open. (The previous version returned `true`
// whenever `getSubUser()` was null, which also fired for genuine sub-users
// with a missing/corrupt permissions object — a fail-open bug flagged in
// the earlier review. Gating on isSubUser() first fixes that without
// breaking primary clients, who have no sub_user record at all.)
export function hasSubUserPermission(key: string): boolean {
  if (!isSubUser()) return true;
  const sub = getSubUser();
  return sub?.permissions?.[key] === true;
}

// SUBUSER_PLAN.md §5.3: the `sub_user` record above is written once at
// login and never touched again, so a permission the client revokes mid-
// session stays visible to the sub-user (as a tab they can still click,
// even though every action behind it now 403s per Phase 2) until they log
// out and back in. useSubUserPermissions() (hooks/queries/useSubUsers.ts)
// fetches GET /sub-users/{id} on every dashboard load and calls this to
// overwrite the cached copy with what the server has right now —
// hasSubUserPermission() then reads the refreshed value on the next
// render. Only `permissions` is replaced; the rest of the cached `sub_user`
// record (name, email, avatar) is left as-is.
export function syncSubUserPermissions(permissions: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  const sub = getSubUser();
  if (!sub) return;
  localStorage.setItem('sub_user', JSON.stringify({ ...sub, permissions }));
}
