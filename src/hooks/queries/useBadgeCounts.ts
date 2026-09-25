'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { subscribeToNotifications } from '@/lib/echo';
import type { BadgeCounts } from '@/types';

// plans/notifications-badges-toasts-plan.md ن8 — the sidebar's NavItem
// already had unused `badge`/`badgeColor` fields (app/dashboard/layout.tsx),
// but nothing ever called GET /badge-counts on the web, so no badge ever
// rendered even though the mobile app's home tab has shown the same numbers
// (chat/approvals) for a while. Polls every 60s like the mobile app and the
// notification bell (ن10), and also refetches on any realtime notification
// so a new chat message or approval doesn't wait a full minute to show up.
export const badgeCountsKeys = {
  all: ['badge-counts'] as const,
};

async function fetchBadgeCounts(): Promise<BadgeCounts> {
  const { data } = await api.get('/badge-counts');
  return data;
}

export function useBadgeCounts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(() => {
      queryClient.invalidateQueries({ queryKey: badgeCountsKeys.all });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [queryClient]);

  return useQuery({
    queryKey: badgeCountsKeys.all,
    queryFn: fetchBadgeCounts,
    refetchInterval: 60000,
  });
}
