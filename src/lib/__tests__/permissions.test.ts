import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import api from '@/lib/api';
import { canDo, isAssistant, refreshAssistantUser, ASSISTANT_PERMISSION_KEYS } from '../permissions';

const assistant = (perms: Record<string, boolean> = {}) => ({ role: 'manager_assistant', assistant_permissions: perms });

describe('permissions helpers', () => {
  it('isAssistant is true only for the manager_assistant role', () => {
    expect(isAssistant(assistant())).toBe(true);
    expect(isAssistant({ role: 'account_manager' })).toBe(false);
    expect(isAssistant({ role: 'super_admin' })).toBe(false);
    expect(isAssistant(null)).toBe(false);
    expect(isAssistant(undefined)).toBe(false);
  });

  it('never limits managers or super admins', () => {
    for (const key of ASSISTANT_PERMISSION_KEYS) {
      expect(canDo({ role: 'account_manager' }, key)).toBe(true);
      expect(canDo({ role: 'super_admin' }, key)).toBe(true);
    }
  });

  it('needs the flag for an assistant, except can_view_clients which is always on', () => {
    const a = assistant({ can_chat: true, can_manage_contracts: false });
    expect(canDo(a, 'can_view_clients')).toBe(true);
    expect(canDo(a, 'can_chat')).toBe(true);
    expect(canDo(a, 'can_manage_contracts')).toBe(false);
    expect(canDo(a, 'can_manage_meetings')).toBe(false);
    expect(canDo(assistant(), 'can_edit_clients')).toBe(false);
  });
});

describe('refreshAssistantUser', () => {
  let mock: MockAdapter;
  beforeEach(() => { mock = new MockAdapter(api); window.localStorage.clear(); });
  afterEach(() => { mock.restore(); window.localStorage.clear(); });

  it('rewrites the stored user with the permissions the manager currently granted', async () => {
    window.localStorage.setItem('user', JSON.stringify({ id: 5, name: 'Sami', ...assistant({ can_chat: false }) }));
    mock.onGet('/auth/me').reply(200, { user: { id: 5, name: 'Sami', ...assistant({ can_chat: true }) } });

    await refreshAssistantUser();

    expect(JSON.parse(window.localStorage.getItem('user')!).assistant_permissions.can_chat).toBe(true);
  });

  it('does not call the API for a non-assistant', async () => {
    window.localStorage.setItem('user', JSON.stringify({ id: 1, role: 'account_manager' }));
    await refreshAssistantUser();
    expect(mock.history.get.length).toBe(0);
  });

  it('keeps the stored user when the request fails', async () => {
    const stored = { id: 5, ...assistant({ can_chat: true }) };
    window.localStorage.setItem('user', JSON.stringify(stored));
    mock.onGet('/auth/me').networkError();

    await refreshAssistantUser();

    expect(JSON.parse(window.localStorage.getItem('user')!)).toEqual(stored);
  });
});
