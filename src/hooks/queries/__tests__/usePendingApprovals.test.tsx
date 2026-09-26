import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import MockAdapter from 'axios-mock-adapter';
import api from '@/lib/api';
import { usePendingApprovals } from '../usePendingApprovals';
import { subscribeToNotifications } from '@/lib/echo';
import type { PendingApprovalsResponse } from '@/types';

// pending-approvals-plan.md ك2 — same mocking approach as
// useBadgeCounts.test.tsx: swap the real Echo/Pusher subscription
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

function emptyResponse(): PendingApprovalsResponse {
  return {
    awaiting_you: { contracts: [], payments: [] },
    awaiting_client: { contracts: [], approvals: [] },
    counts: { pending_requests: 0, pending_contracts: 0, pending_payments: 0, total: 0 },
  };
}

let mock: MockAdapter;

describe('usePendingApprovals', () => {
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

  it('fetches GET /dashboard/pending-approvals', async () => {
    const response = emptyResponse();
    response.counts.total = 3;
    mock.onGet('/dashboard/pending-approvals').reply(200, response);

    const { result } = renderHook(() => usePendingApprovals(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual(response));
  });

  // Same 60s cadence as useBadgeCounts, so the list can't sit stale while
  // the badge next to it already refreshed.
  it('polls every 60 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mock.onGet('/dashboard/pending-approvals').reply(200, emptyResponse());

    renderHook(() => usePendingApprovals(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/dashboard/pending-approvals').length).toBe(1));

    await vi.advanceTimersByTimeAsync(60000);
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/dashboard/pending-approvals').length).toBe(2));
  });

  it('invalidates the pending-approvals cache when a realtime notification arrives', () => {
    mock.onGet('/dashboard/pending-approvals').reply(200, emptyResponse());
    renderHook(() => usePendingApprovals(), { wrapper: wrapper(queryClient) });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onNotification = vi.mocked(subscribeToNotifications).mock.calls[0][0];

    onNotification({});

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'pending-approvals'] });
  });

  it('unsubscribes on unmount', () => {
    mock.onGet('/dashboard/pending-approvals').reply(200, emptyResponse());
    const { unmount } = renderHook(() => usePendingApprovals(), { wrapper: wrapper(queryClient) });

    unmount();

    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
