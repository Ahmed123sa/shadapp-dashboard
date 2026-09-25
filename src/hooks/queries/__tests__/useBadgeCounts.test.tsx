import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import MockAdapter from 'axios-mock-adapter';
import api from '@/lib/api';
import { useBadgeCounts } from '../useBadgeCounts';
import { subscribeToNotifications } from '@/lib/echo';

// plans/notifications-badges-toasts-plan.md ن8 — the web sidebar never
// called GET /badge-counts at all before ح6. Same mocking approach as
// useWorkspaceRealtime.test.tsx: swap the real Echo/Pusher subscription
// (unavailable in jsdom) for a spy that captures the callback.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToNotifications: vi.fn(),
}));

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

let mock: MockAdapter;

describe('useBadgeCounts', () => {
  let queryClient: QueryClient;
  let unsub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mock = new MockAdapter(api);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    unsub = vi.fn();
    vi.mocked(subscribeToNotifications).mockReturnValue(unsub);
  });

  afterEach(() => {
    mock.restore();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('fetches GET /badge-counts', async () => {
    mock.onGet('/badge-counts').reply(200, { chat: 3, contracts: 0, approvals: 5, payments: 2, files: 0, notifications: 8 });

    const { result } = renderHook(() => useBadgeCounts(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual({ chat: 3, contracts: 0, approvals: 5, payments: 2, files: 0, notifications: 8 }));
  });

  // ن10 — the sidebar polls on the same 60s cadence as the notification bell
  // and the mobile app, not the old 5-minute interval nothing here ever used.
  it('polls every 60 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mock.onGet('/badge-counts').reply(200, { chat: 0, contracts: 0, approvals: 0, payments: 0, files: 0, notifications: 0 });

    renderHook(() => useBadgeCounts(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/badge-counts').length).toBe(1));

    await vi.advanceTimersByTimeAsync(60000);
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/badge-counts').length).toBe(2));
  });

  it('invalidates the badge-counts cache when a realtime notification arrives', () => {
    mock.onGet('/badge-counts').reply(200, { chat: 0, contracts: 0, approvals: 0, payments: 0, files: 0, notifications: 0 });
    renderHook(() => useBadgeCounts(), { wrapper: wrapper(queryClient) });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onNotification = vi.mocked(subscribeToNotifications).mock.calls[0][0];

    onNotification({});

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['badge-counts'] });
  });

  it('unsubscribes on unmount', () => {
    mock.onGet('/badge-counts').reply(200, { chat: 0, contracts: 0, approvals: 0, payments: 0, files: 0, notifications: 0 });
    const { unmount } = renderHook(() => useBadgeCounts(), { wrapper: wrapper(queryClient) });

    unmount();

    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
