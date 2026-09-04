'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Approval } from '@/types';

// ApprovalsTab (staff view) and ClientApprovals (client view) both hit the
// exact same `/workspaces/:id/approvals` endpoint and render the same list,
// so they share this one cache entry/key rather than each fetching their
// own copy — a create or respond from either surface patches data the
// other is already looking at.
export const approvalKeys = {
  workspace: (wsId: number) => ['approvals', 'workspace', wsId] as const,
};

async function fetchWorkspaceApprovals(wsId: number): Promise<Approval[]> {
  const { data } = await api.get(`/workspaces/${wsId}/approvals`);
  return data.approvals?.data || data.approvals || [];
}

export function useWorkspaceApprovals(wsId: number) {
  return useQuery({
    queryKey: approvalKeys.workspace(wsId),
    queryFn: () => fetchWorkspaceApprovals(wsId),
  });
}

export function useSendApproval(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) =>
      api.post(`/workspaces/${wsId}/approvals`, form).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.approval) return;
      queryClient.setQueryData<Approval[] | undefined>(approvalKeys.workspace(wsId), (old) =>
        old ? [data.approval, ...old] : old
      );
    },
  });
}

export function useRespondApproval(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      api.post(`/approvals/${id}/respond`, { action }).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.approval) return;
      queryClient.setQueryData<Approval[] | undefined>(approvalKeys.workspace(wsId), (old) =>
        old ? old.map((a) => (a.id === data.approval.id ? data.approval : a)) : old
      );
    },
  });
}
