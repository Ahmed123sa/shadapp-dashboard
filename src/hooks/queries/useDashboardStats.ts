'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DashboardStats } from '@/types';

// 24 Sept 2026 — GET /dashboard/stats (server-side-stats-plan.md). Both
// SAManagersView and AMView used to compute their summary cards themselves
// from whatever list they'd already fetched for other reasons (allContracts,
// allPayments, ...), each capped at 30-100 rows — so the numbers were wrong
// once real data grew past that cap, and the two views could disagree with
// each other over the exact same concept ("pending approvals" had three
// different definitions across this codebase; see the plan's §2.2). This
// hook is the single source both views read from instead.
export const dashboardStatsKeys = {
  all: ['dashboard', 'stats'] as const,
};

async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get('/dashboard/stats');
  return data;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardStatsKeys.all,
    queryFn: fetchDashboardStats,
  });
}
