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
  const raw = localStorage.getItem('client');
  return raw ? JSON.parse(raw) : null;
}

export function getSubUser(): NonNullable<ClientSession['sub_user']> | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('sub_user');
  return raw ? JSON.parse(raw) : null;
}

export function isSubUser(): boolean {
  return !!getSubUser();
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
