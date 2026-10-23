import { describe, it, expect } from 'vitest';
import { accountantMayOpen } from '../accountant-paths';
import { canDo, canReviewPayments, isAccountant } from '../permissions';

describe('accountantMayOpen', () => {
  it('allows finance, clients, a client page, settings', () => {
    expect(accountantMayOpen('/dashboard/finance')).toBe(true);
    expect(accountantMayOpen('/dashboard/finance/')).toBe(true);
    expect(accountantMayOpen('/dashboard/clients')).toBe(true);
    expect(accountantMayOpen('/dashboard/clients/abc-123')).toBe(true);
    expect(accountantMayOpen('/dashboard/settings')).toBe(true);
  });

  it('refuses everything else', () => {
    for (const p of [
      '/dashboard',
      '/dashboard/account-managers',
      '/dashboard/accountants',
      '/dashboard/staff',
      '/dashboard/reports',
      '/dashboard/audit-log',
      '/dashboard/team',
      '/dashboard/clients/abc-123/settings',
    ]) {
      expect(accountantMayOpen(p), p).toBe(false);
    }
  });
});

describe('accountant permissions', () => {
  it('only super admin and accountant review payments', () => {
    expect(canReviewPayments({ role: 'accountant' })).toBe(true);
    expect(canReviewPayments({ role: 'super_admin' })).toBe(true);
    expect(canReviewPayments({ role: 'account_manager' })).toBe(false);
    expect(canReviewPayments({ role: 'manager_assistant' })).toBe(false);
    expect(canReviewPayments(null)).toBe(false);
    expect(isAccountant({ role: 'accountant' })).toBe(true);
  });

  it('accountant cannot manage anything an assistant permission guards', () => {
    expect(canDo({ role: 'accountant' }, 'can_manage_contracts')).toBe(false);
    expect(canDo({ role: 'accountant' }, 'can_chat')).toBe(false);
    expect(canDo({ role: 'accountant' }, 'can_view_clients')).toBe(true);
  });
});
