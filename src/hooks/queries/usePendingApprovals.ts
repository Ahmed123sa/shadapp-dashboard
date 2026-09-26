'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { subscribeToNotifications } from '@/lib/echo';
import type { PendingApprovalsResponse } from '@/types';

// pending-approvals-plan.md ك2 — GET /dashboard/pending-approvals, the list
// behind the same "pending approvals" number useBadgeCounts and
// useDashboardStats already show. Same refresh strategy as useBadgeCounts
// (60s poll + refetch on any realtime notification) so the list can't sit
// stale while the badge right next to it already updated — that mismatch is
// exactly ن5 in the plan.
export const pendingApprovalsKeys = {
  all: ['dashboard', 'pending-approvals'] as const,
};

async function fetchPendingApprovals(limit?: number): Promise<PendingApprovalsResponse> {
  const { data } = await api.get('/dashboard/pending-approvals', limit ? { params: { limit } } : undefined);
  return data;
}

// ك4 — the home panel calls this with no argument (backend default: 50,
// oldest-first per group); the full /dashboard?view=approvals page (ك4)
// passes a higher limit so its filter tabs have more than 5 rows to show.
// Query-key only grows a third element when a limit is actually passed, so
// the home panel's cache key is unchanged from ك2/ك3 and
// invalidateQueries({ queryKey: pendingApprovalsKeys.all }) still matches
// every variant (TanStack Query does prefix matching on query keys).
export function usePendingApprovals(limit?: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(() => {
      queryClient.invalidateQueries({ queryKey: pendingApprovalsKeys.all });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [queryClient]);

  return useQuery({
    queryKey: limit ? [...pendingApprovalsKeys.all, limit] : pendingApprovalsKeys.all,
    queryFn: () => fetchPendingApprovals(limit),
    refetchInterval: 60000,
  });
}
