import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import DashboardLayout from '../layout';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// plans/notifications-badges-toasts-plan.md ن8 — the sidebar's NavItem
// already had unused badge/badgeColor fields and the web never called GET
// /badge-counts at all. This locks in the two badges ح6 wires up: approvals
// on Home, chat on My/All Clients — for both the account-manager and
// super-admin nav sets.

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
  isAuthenticated: vi.fn(() => true),
  logout: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => ({ get: () => null }),
}));

// The real subscription touches Echo/Pusher (WebSocket), which isn't
// available in jsdom — same approach as NotificationBell.test.tsx. Both
// NotificationBell (rendered inside the layout header) and useBadgeCounts
// go through this same module.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToNotifications: vi.fn(() => vi.fn()),
  disconnectEcho: vi.fn(),
}));

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
  mock.onGet('/notifications').reply(200, { notifications: [], unread_count: 0 });
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('DashboardLayout sidebar badges', () => {
  it('shows the approvals count on Home and the chat count on My Clients for an account manager', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'AM One', role: 'account_manager' } as any);
    mock.onGet('/badge-counts').reply(200, { chat: 4, contracts: 0, approvals: 2, payments: 0, files: 0, notifications: 0 });

    renderWithIntl(<DashboardLayout>{<div>child</div>}</DashboardLayout>);

    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows the approvals count on Home and the chat count on All Clients for a super admin', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA One', role: 'super_admin' } as any);
    mock.onGet('/badge-counts').reply(200, { chat: 7, contracts: 0, approvals: 12, payments: 0, files: 0, notifications: 0 });

    renderWithIntl(<DashboardLayout>{<div>child</div>}</DashboardLayout>);

    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  // ن8's own cap — every other badge in the app (mobile's tab badges, the
  // notification bell's read-all count) already caps at 99+.
  it('caps a nav badge at 99+', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'AM One', role: 'account_manager' } as any);
    mock.onGet('/badge-counts').reply(200, { chat: 0, contracts: 0, approvals: 150, payments: 0, files: 0, notifications: 0 });

    renderWithIntl(<DashboardLayout>{<div>child</div>}</DashboardLayout>);

    await waitFor(() => expect(screen.getByText('99+')).toBeInTheDocument());
    expect(screen.queryByText('150')).not.toBeInTheDocument();
  });

  it('renders no badge at all when counts are zero', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'AM One', role: 'account_manager' } as any);
    mock.onGet('/badge-counts').reply(200, { chat: 0, contracts: 0, approvals: 0, payments: 0, files: 0, notifications: 0 });

    renderWithIntl(<DashboardLayout>{<div>child</div>}</DashboardLayout>);

    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/badge-counts')).toBe(true));
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
