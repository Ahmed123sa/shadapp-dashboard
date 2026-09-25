import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import NotificationBell from '../NotificationBell';
import api from '@/lib/api';

// plans/notifications-badges-toasts-plan.md ح4 — covers ن4 (message ?? body
// fallback), ن5 (no longer routing by workspace_id when client_id is
// missing), ن10 (60s poll instead of 5 minutes), and ن11 (read-all instead
// of one request per notification).

// The real subscription touches Echo/Pusher (WebSocket), which isn't
// available in jsdom.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToNotifications: vi.fn(() => vi.fn()),
  disconnectEcho: vi.fn(),
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

let mock: MockAdapter;

function notif(overrides: Record<string, unknown>) {
  return {
    id: overrides.id ?? '1',
    data: {
      type: 'contract_sent',
      title: 'عقد جديد',
      ...overrides,
    },
    read_at: null,
    created_at: '2026-01-01T10:00:00Z',
  };
}

beforeEach(() => {
  mock = new MockAdapter(api);
  push.mockClear();
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('NotificationBell', () => {
  it('renders the message field when present', async () => {
    mock.onGet('/notifications').reply(200, {
      notifications: [notif({ id: '1', message: 'تم إرسال العقد', client_id: 5 })],
      unread_count: 1,
    });
    renderWithIntl(<NotificationBell />);

    await userEvent.setup().click(await screen.findByRole('button'));

    expect(await screen.findByText('تم إرسال العقد')).toBeInTheDocument();
  });

  // ن4 — several backend notification types only send 'body', not
  // 'message'. Before this fix the bell rendered an empty line for those.
  it('falls back to the body field when message is missing', async () => {
    mock.onGet('/notifications').reply(200, {
      notifications: [notif({ id: '1', message: undefined, body: 'تذكير: دفعة مستحقة اليوم', client_id: 5 })],
      unread_count: 1,
    });
    renderWithIntl(<NotificationBell />);

    await userEvent.setup().click(screen.getByRole('button'));

    expect(await screen.findByText('تذكير: دفعة مستحقة اليوم')).toBeInTheDocument();
  });

  // ن5 — used to fall back to workspace_id as if it were a client id,
  // routing to /dashboard/clients/{workspace_id} (the wrong client, or a
  // page that doesn't exist). Every notification now carries a real
  // client_id (ح3), and there's nothing to fall back to for one that
  // somehow still doesn't, so it should just point at the dashboard.
  it('does not use workspace_id as a client id when client_id is missing', async () => {
    mock.onGet('/notifications').reply(200, {
      notifications: [notif({ id: '1', message: 'x', workspace_id: 99, client_id: undefined })],
      unread_count: 1,
    });
    renderWithIntl(<NotificationBell />);

    await userEvent.setup().click(screen.getByRole('button'));
    await screen.findByText('x');

    const link = screen.getByRole('link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/dashboard');
  });

  it('routes to the client page when client_id is present', async () => {
    mock.onGet('/notifications').reply(200, {
      notifications: [notif({ id: '1', message: 'x', workspace_id: 99, client_id: 5 })],
      unread_count: 1,
    });
    renderWithIntl(<NotificationBell />);

    await userEvent.setup().click(screen.getByRole('button'));
    await screen.findByText('x');

    const link = screen.getByRole('link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/dashboard/clients/5');
  });

  // ن11 — this used to POST /notifications/{id}/read once per unread
  // notification instead of calling the dedicated read-all endpoint.
  it('mark-all-read calls the read-all endpoint once, not one request per notification', async () => {
    mock.onGet('/notifications').reply(200, {
      notifications: [
        notif({ id: '1', message: 'a', client_id: 5 }),
        notif({ id: '2', message: 'b', client_id: 5 }),
      ],
      unread_count: 2,
    });
    mock.onPost('/notifications/read-all').reply(200, {});
    renderWithIntl(<NotificationBell />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    await screen.findByText('a');

    await user.click(screen.getByText('Mark All as Read'));

    await waitFor(() => {
      const readAllCalls = mock.history.post.filter((r) => r.url === '/notifications/read-all');
      expect(readAllCalls.length).toBe(1);
    });
    const perNotificationReadCalls = mock.history.post.filter((r) => r.url?.match(/\/notifications\/\d+\/read$/) || r.url?.match(/\/notifications\/\w+\/read$/));
    expect(perNotificationReadCalls.length).toBe(0);
  });

  // ن10 — polls every 60 seconds, matching the mobile app, instead of the
  // old 5-minute interval.
  it('polls every 60 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mock.onGet('/notifications').reply(200, { notifications: [], unread_count: 0 });
    renderWithIntl(<NotificationBell />);

    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/notifications').length).toBe(1));

    await vi.advanceTimersByTimeAsync(60000);
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/notifications').length).toBe(2));
  });
});
