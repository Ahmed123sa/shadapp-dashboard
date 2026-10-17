import { describe, it, expect } from 'vitest';
import { staffMayOpen } from '../staff-paths';

describe('staffMayOpen', () => {
  it('allows the client list, a client page and the staff member\'s own settings', () => {
    expect(staffMayOpen('/dashboard/clients')).toBe(true);
    expect(staffMayOpen('/dashboard/clients/')).toBe(true);
    expect(staffMayOpen('/dashboard/clients/8f3a2b1c-0000-4000-8000-000000000009')).toBe(true);
    expect(staffMayOpen('/dashboard/settings')).toBe(true);
  });

  it('refuses everything else', () => {
    for (const path of [
      '/dashboard',
      '/dashboard/clients/5/settings',
      '/dashboard/finance',
      '/dashboard/reports',
      '/dashboard/audit-log',
      '/dashboard/account-managers',
      '/dashboard/team',
      '/dashboard/staff',
      '/dashboard/profile',
      '/dashboard/settings/extra',
    ]) {
      expect(staffMayOpen(path), path).toBe(false);
    }
  });
});
