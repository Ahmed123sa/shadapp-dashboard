import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import MockAdapter from 'axios-mock-adapter';
import api from '@/lib/api';
import { useDashboardStats } from '../useDashboardStats';
import { subscribeToNotifications } from '@/lib/echo';

// plans/pending-approvals-fixes-plan.md ح٢ — GET /dashboard/stats used to be
// fetched once and never refreshed, so the home cards went stale while the
// pending-approvals panel next to them kept updating. Same refresh strategy
// and same mocking approach as useBadgeCounts.test.tsx.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToNotifications: vi.fn(),
}));

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const STATS = {
  clients: { total: 1 }, contracts: { active: 0, awaiting_client: 0 }, payments: { pending: 0 },
  approvals: { pending_requests: 0, pending_contracts: 0, pending_payments: 0, total: 0 },
  revenue_this_month: {}, period: { month: '2026-09', timezone: 'Africa/Cairo' },
};

let mock: MockAdapter;

describe('useDashboardStats', () => {
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

  it('fetches GET /dashboard/stats', async () => {
    mock.onGet('/dashboard/stats').reply(200, STATS);

    const { result } = renderHook(() => useDashboardStats(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual(STATS));
  });

  it('polls every 60 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mock.onGet('/dashboard/stats').reply(200, STATS);

    renderHook(() => useDashboardStats(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/dashboard/stats').length).toBe(1));

    await vi.advanceTimersByTimeAsync(60000);
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/dashboard/stats').length).toBe(2));
  });

  it('invalidates the stats cache when a realtime notification arrives', () => {
    mock.onGet('/dashboard/stats').reply(200, STATS);
    renderHook(() => useDashboardStats(), { wrapper: wrapper(queryClient) });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onNotification = vi.mocked(subscribeToNotifications).mock.calls[0][0];

    onNotification({});

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'stats'] });
  });

  it('unsubscribes on unmount', () => {
    mock.onGet('/dashboard/stats').reply(200, STATS);
    const { unmount } = renderHook(() => useDashboardStats(), { wrapper: wrapper(queryClient) });

    unmount();

    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
