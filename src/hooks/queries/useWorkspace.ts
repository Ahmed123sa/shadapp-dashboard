'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Workspace } from '@/types';

// REALTIME_PLAN.md Stage 3 — the query key useWorkspaceRealtime's
// onWorkspaceStatusChanged invalidates once client-dashboard/page.tsx (the
// only current reader of a single workspace's detail) migrates onto
// TanStack Query.
export const workspaceKeys = {
  detail: (wsId: number) => ['workspaces', 'detail', wsId] as const,
};

async function fetchWorkspace(wsId: number): Promise<Workspace> {
  const { data } = await api.get(`/workspaces/${wsId}`);
  return data.workspace;
}

// While the workspace is not active yet the client is walking through
// onboarding, and every step there (contract sent, approved by the company,
// payment reviewed...) lives in this record. A missed or absent realtime
// event (no socket in local dev, a dropped connection) would leave the client
// stuck on the old step, so it polls every 4s — the same rule useClient uses
// — and stops as soon as the workspace is active, where realtime events and
// the per-tab queries take over.
export function useWorkspace(wsId: number | undefined) {
  return useQuery({
    queryKey: workspaceKeys.detail(wsId ?? 0),
    queryFn: () => fetchWorkspace(wsId as number),
    enabled: !!wsId,
    refetchInterval: (query) => (query.state.data && query.state.data.status !== 'active' ? 4000 : false),
  });
}
