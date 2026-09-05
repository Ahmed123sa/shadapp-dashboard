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

// No refetchInterval here (unlike usePayments/useChat's 30s/60s polls,
// which stay as a safety net per REALTIME_PLAN.md section 6 risk 1). This
// query started out with the old manual `setInterval(..., 10000)` behavior
// during Stage 3's hook migration, then had that poll removed in the same
// stage once client-dashboard/page.tsx's `useWorkspaceRealtime` call was
// verified to invalidate `workspaceKeys.detail` on every
// `WorkspaceStatusChanged`/`ContractStatusChanged` broadcast (see
// useWorkspaceRealtime.ts) — the poll's entire purpose (catching the
// activation moment + first-contract stage updates, REALTIME_PLAN.md
// section 1.3) is now covered by those events instead.
export function useWorkspace(wsId: number | undefined) {
  return useQuery({
    queryKey: workspaceKeys.detail(wsId ?? 0),
    queryFn: () => fetchWorkspace(wsId as number),
    enabled: !!wsId,
  });
}
