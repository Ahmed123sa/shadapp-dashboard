'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToWorkspace } from '@/lib/echo';
import { chatKeys } from './useChat';
import { contractKeys, paymentKeys } from './usePayments';
import { workspaceKeys } from './useWorkspace';

/**
 * Unified realtime subscription for a workspace's private channel
 * (REALTIME_PLAN.md stage 2). Invalidates the TanStack Query caches for
 * chat, contracts, payments and the workspace detail record itself in
 * response to the corresponding broadcast events, so any component reading
 * those query keys — not just the one that called this hook — picks up the
 * change via `invalidateQueries`.
 *
 * `onWorkspaceStatusChanged` invalidates `workspaceKeys.detail` as of stage
 * 3 (client-dashboard/page.tsx, the only current reader of a single
 * workspace's detail, has been migrated onto `useWorkspace` — see that
 * hook's own file). Before stage 3 this invalidated nothing because no
 * TanStack Query cache held workspace detail yet.
 *
 * This hook only makes updates arrive sooner — the underlying queries'
 * `refetchInterval` polling is left untouched as a safety net (see
 * REALTIME_PLAN.md section 6, risk 1: `refetchOnWindowFocus` is globally
 * disabled, so a missed/dropped socket event with no polling fallback would
 * leave the UI stale until a manual reload).
 */
export function useWorkspaceRealtime(wsId: number | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!wsId) return;

    const unsub = subscribeToWorkspace(wsId, {
      onMessageSent: () => queryClient.invalidateQueries({ queryKey: chatKeys.workspace(wsId) }),
      onContractStatusChanged: () => queryClient.invalidateQueries({ queryKey: contractKeys.workspace(wsId) }),
      onPaymentStatusChanged: () => queryClient.invalidateQueries({ queryKey: paymentKeys.workspace(wsId) }),
      onWorkspaceStatusChanged: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(wsId) }),
    });

    return () => {
      if (unsub) unsub();
    };
  }, [wsId, queryClient]);
}
