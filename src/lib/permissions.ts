import api from '@/lib/api';

// Manager assistants (MANAGER_ASSISTANT_PLAN.md): a staff user that belongs to
// one account manager and gets only the permissions that manager chose. These
// helpers are UI conveniences — the backend (assistant.can / not.assistant
// middleware and the policies) is the real gate.

export const ASSISTANT_ROLE = 'manager_assistant';

export type AssistantPermissionKey =
  | 'can_view_clients'
  | 'can_edit_clients'
  | 'can_chat'
  | 'can_manage_contracts'
  | 'can_manage_meetings'
  | 'can_view_files'
  | 'can_review_files'
  | 'can_manage_approvals';

export const ASSISTANT_PERMISSION_KEYS: AssistantPermissionKey[] = [
  'can_view_clients',
  'can_edit_clients',
  'can_chat',
  'can_manage_contracts',
  'can_manage_meetings',
  'can_view_files',
  'can_review_files',
  'can_manage_approvals',
];

interface MaybeAssistant {
  role?: string;
  assistant_permissions?: Partial<Record<AssistantPermissionKey, boolean>> | null;
}

export function isAssistant(user?: MaybeAssistant | null): boolean {
  return user?.role === ASSISTANT_ROLE;
}

/**
 * Whether the user may perform the action behind `key`. Anyone who is not an
 * assistant is never limited by assistant permissions (managers and super
 * admins have their own role rules); an assistant needs the flag, except
 * can_view_clients which is always on.
 */
export function canDo(user: MaybeAssistant | null | undefined, key: AssistantPermissionKey): boolean {
  if (!isAssistant(user)) return true;
  if (key === 'can_view_clients') return true;
  return !!user?.assistant_permissions?.[key];
}

/**
 * The manager can change an assistant's permissions at any time, but the
 * copy of the user kept in localStorage is only written at login. This
 * re-reads /auth/me for an assistant and rewrites it, so buttons follow the
 * current permissions without a new login. No-op for everyone else.
 */
export async function refreshAssistantUser(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('user');
    const stored = raw ? JSON.parse(raw) : null;
    if (!isAssistant(stored)) return;
    const { data } = await api.get('/auth/me');
    if (data?.user) {
      window.localStorage.setItem('user', JSON.stringify({ ...stored, ...data.user }));
    }
  } catch {
    // Offline or expired session: keep what we have; the API still enforces.
  }
}
