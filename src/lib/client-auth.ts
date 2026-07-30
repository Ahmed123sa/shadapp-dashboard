import api from './api';

export interface ClientSession {
  token: string;
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

export async function clientLogin(email: string, password: string): Promise<ClientSession> {
  localStorage.removeItem('client_token');
  localStorage.removeItem('client');
  localStorage.removeItem('sub_user_token');
  localStorage.removeItem('sub_user');
  localStorage.removeItem('sub_user_client');
  const { data } = await api.post('/auth/client/login', { email: email.trim(), password });

  localStorage.setItem('client_token', data.token);

  if (data.login_type === 'sub_user') {
    localStorage.setItem('sub_user_token', data.token);
    localStorage.setItem('sub_user', JSON.stringify(data.sub_user));
    localStorage.setItem('sub_user_client', JSON.stringify(data.client));
    localStorage.setItem('client', JSON.stringify({ ...data.client, is_sub_user: true }));
  } else {
    localStorage.setItem('client', JSON.stringify(data.client));
  }

  return data;
}

export function clientLogout(): void {
  localStorage.removeItem('client_token');
  localStorage.removeItem('client');
  localStorage.removeItem('sub_user_token');
  localStorage.removeItem('sub_user');
  localStorage.removeItem('sub_user_client');
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
  return !!localStorage.getItem('sub_user_token');
}

export function isClientAuthenticated(): boolean {
  return !!localStorage.getItem('client_token');
}

export function hasSubUserPermission(key: string): boolean {
  const sub = getSubUser();
  if (!sub) return true;
  return sub.permissions?.[key] === true;
}
