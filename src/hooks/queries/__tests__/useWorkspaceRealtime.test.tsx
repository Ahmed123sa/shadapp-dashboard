import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useWorkspaceRealtime } from '../useWorkspaceRealtime';
import { subscribeToWorkspace } from '@/lib/echo';
import { chatKeys } from '../useChat';
import { contractKeys, paymentKeys } from '../usePayments';
import { workspaceKeys } from '../useWorkspace';

// The real subscription touches Echo/Pusher (WebSocket), which isn't
// available in jsdom — same mocking approach as ChatTab.test.tsx /
// ClientChat.test.tsx: swap subscribeToWorkspace for a spy that captures the
// callbacks so tests can simulate a push without a real socket.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToWorkspace: vi.fn(),
}));

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useWorkspaceRealtime', () => {
  let queryClient: QueryClient;
  let unsub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    unsub = vi.fn();
    vi.mocked(subscribeToWorkspace).mockReturnValue(unsub);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to the workspace channel with all four callbacks wired', () => {
    renderHook(() => useWorkspaceRealtime(9), { wrapper: wrapper(queryClient) });

    expect(subscribeToWorkspace).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        onMessageSent: expect.any(Function),
        onContractStatusChanged: expect.any(Function),
        onPaymentStatusChanged: expect.any(Function),
        onWorkspaceStatusChanged: expect.any(Function),
      })
    );
  });

  it('invalidates the chat query cache when a message is pushed', () => {
    renderHook(() => useWorkspaceRealtime(9), { wrapper: wrapper(queryClient) });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { onMessageSent } = vi.mocked(subscribeToWorkspace).mock.calls[0][1];

    onMessageSent!({});

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chatKeys.workspace(9) });
  });

  it('invalidates the contracts query cache when a contract status changes', () => {
    renderHook(() => useWorkspaceRealtime(9), { wrapper: wrapper(queryClient) });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { onContractStatusChanged } = vi.mocked(subscribeToWorkspace).mock.calls[0][1];

    onContractStatusChanged!();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contractKeys.workspace(9) });
  });

  it('invalidates the payments query cache when a payment status changes', () => {
    renderHook(() => useWorkspaceRealtime(9), { wrapper: wrapper(queryClient) });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { onPaymentStatusChanged } = vi.mocked(subscribeToWorkspace).mock.calls[0][1];

    onPaymentStatusChanged!({});

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: paymentKeys.workspace(9) });
  });

  it('invalidates the workspace detail query cache when the workspace status changes', () => {
    renderHook(() => useWorkspaceRealtime(9), { wrapper: wrapper(queryClient) });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { onWorkspaceStatusChanged } = vi.mocked(subscribeToWorkspace).mock.calls[0][1];

    onWorkspaceStatusChanged!({ status: 'active' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: workspaceKeys.detail(9) });
  });

  it('does not subscribe when wsId is undefined', () => {
    renderHook(() => useWorkspaceRealtime(undefined), { wrapper: wrapper(queryClient) });

    expect(subscribeToWorkspace).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useWorkspaceRealtime(9), { wrapper: wrapper(queryClient) });

    unmount();

    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
