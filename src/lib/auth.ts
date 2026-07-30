import api from './api';

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

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  const { data } = await api.post('/auth/login', { email: email.trim(), password });
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token');
}
