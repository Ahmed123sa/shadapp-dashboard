import { describe, it, expect } from 'vitest';
import { CLIENT_TABS, resolveTabParam, visibleClientTabs } from '../client-tabs';

describe('client tabs', () => {
  it('has the six workspace tabs in mockup order', () => {
    expect(CLIENT_TABS.map((t) => t.key)).toEqual(['contracts', 'payments', 'chat', 'approvals', 'files', 'meetings']);
  });

  it('filters by permission — one permission per tab', () => {
    const only = (perm: string) => visibleClientTabs((p) => p === perm).map((t) => t.key);
    expect(only('can_view_contracts')).toEqual(['contracts']);
    expect(only('can_view_payments')).toEqual(['payments']);
    expect(only('can_chat')).toEqual(['chat']);
    expect(only('can_view_approvals')).toEqual(['approvals']);
    expect(only('can_view_files')).toEqual(['files']);
    expect(only('can_view_meetings')).toEqual(['meetings']);
    // Permissions that gate actions, not tabs, reveal nothing by themselves.
    for (const p of ['can_approve_contracts', 'can_upload_payment_proof', 'can_respond_approvals', 'can_upload_files', 'can_join_meetings']) {
      expect(only(p)).toEqual([]);
    }
    expect(visibleClientTabs(() => true)).toHaveLength(6);
    expect(visibleClientTabs(() => false)).toHaveLength(0);
  });

  it('resolves slugs, the old Arabic keys and localized labels', () => {
    expect(resolveTabParam('payments')).toBe('payments');
    expect(resolveTabParam('Payments')).toBe('payments');
    expect(resolveTabParam('المدفوعات')).toBe('payments');
    expect(resolveTabParam('Chat', { chat: ['Chat', 'المحادثة'] })).toBe('chat');
    expect(resolveTabParam('المحادثة', { chat: ['Chat', 'المحادثة'] })).toBe('chat');
  });

  it('returns null for unknown or empty values', () => {
    expect(resolveTabParam('nope')).toBeNull();
    expect(resolveTabParam('')).toBeNull();
    expect(resolveTabParam(null)).toBeNull();
    // Signature/users are pages now, not tabs.
    expect(resolveTabParam('التوقيع')).toBeNull();
  });
});
