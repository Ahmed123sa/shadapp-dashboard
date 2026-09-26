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

async function fetchPendingApprovals(): Promise<PendingApprovalsResponse> {
  const { data } = await api.get('/dashboard/pending-approvals');
  return data;
}

export function usePendingApprovals() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(() => {
      queryClient.invalidateQueries({ queryKey: pendingApprovalsKeys.all });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [queryClient]);

  return useQuery({
    queryKey: pendingApprovalsKeys.all,
    queryFn: fetchPendingApprovals,
    refetchInterval: 60000,
  });
}
