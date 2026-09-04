import { safeJsonParse } from './utils';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'account_manager';
  official_email?: string;
  signature_data?: string;
  signed_at?: string;
  avatar_url?: string;
}

// The bearer token never touches this file (or localStorage) anymore — it
// lives only in an httpOnly cookie set by /api/session/login. This calls
// that route handler directly (not the /api/proxy axios instance) since
// it's a same-origin Next.js route, not a Laravel API call.
export async function login(email: string, password: string): Promise<{ user: User }> {
  localStorage.removeItem('user');
  const res = await fetch('/api/session/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data?.message || 'Login failed'), { response: { data, status: res.status } });
  }
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export async function logout(): Promise<void> {
  localStorage.removeItem('user');
  try {
    await fetch('/api/session/logout', { method: 'POST' });
  } catch {
    // Best-effort — still redirect below even if this fails.
  }
  window.location.href = '/login';
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  return safeJsonParse<User>(localStorage.getItem('user'), 'user');
}

// This is a UI convenience only (avoids a flash of protected content while
// client components hydrate) — it is NOT the security boundary. The real
// gate is src/proxy.ts checking the httpOnly cookie server-side before the
// page is ever served.
export function isAuthenticated(): boolean {
  return !!getUser();
}
