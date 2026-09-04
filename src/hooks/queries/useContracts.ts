'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { asSettingFlag } from '@/lib/utils';
import { contractKeys, useWorkspaceContracts } from './usePayments';
import type { Contract, ContractClauseTemplate } from '@/types';

// ContractsTab, ClientContracts, MeetingsTab (contract picker) and Payments
// all read `/workspaces/:id/contracts` — re-exporting the Payments-slice
// hook/key here rather than duplicating a second query for the identical
// endpoint, so every consumer shares one cache entry.
export { contractKeys, useWorkspaceContracts };

async function fetchContractClauseTemplates(): Promise<ContractClauseTemplate[]> {
  const { data } = await api.get('/contract-clause-templates');
  return data.templates || [];
}

// Shared (not workspace-scoped) read used by both ContractsTab and
// ContractBuilder — same cache entry for both, matching the endpoint.
export function useContractClauseTemplates() {
  return useQuery({
    queryKey: ['contracts', 'clause-templates'],
    queryFn: fetchContractClauseTemplates,
  });
}

async function fetchShowContractDates(): Promise<boolean> {
  const { data } = await api.get('/settings');
  const cd = data.settings?.show_contract_dates?.value;
  return cd !== undefined ? asSettingFlag(cd) : true;
}

// Neither original caller (ContractsTab's Promise.all, ContractBuilder's own
// effect) ever surfaced a failure of this specific fetch as a page error —
// both just kept the `true` default and logged it. Matching that means this
// query's own `isError` is intentionally never read by either migrated
// component; a failure here is invisible to the user, same as before.
export function useShowContractDatesSetting() {
  return useQuery({
    queryKey: ['contracts', 'show-dates-setting'],
    queryFn: fetchShowContractDates,
  });
}

export function useCreateContract(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post(`/workspaces/${wsId}/contracts`, payload).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.contract) return;
      queryClient.setQueryData<Contract[] | undefined>(contractKeys.workspace(wsId), (old) =>
        old ? [...old, data.contract] : old
      );
    },
  });
}

// Generic verb-in-URL actions (send, archive, resend, ...) used by the
// staff-facing ContractsTab.
export function useContractAction(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      api.post(`/contracts/${id}/${action}`).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.contract) return;
      queryClient.setQueryData<Contract[] | undefined>(contractKeys.workspace(wsId), (old) =>
        old ? old.map((c) => (c.id === data.contract.id ? data.contract : c)) : old
      );
    },
  });
}

export function useCompanyApproveContract(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { use_saved_signature: true } | { signature: string } }) =>
      api.post(`/contracts/${id}/company-approve`, payload).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.contract) return;
      queryClient.setQueryData<Contract[] | undefined>(contractKeys.workspace(wsId), (old) =>
        old ? old.map((c) => (c.id === data.contract.id ? data.contract : c)) : old
      );
    },
  });
}

// Client-facing action endpoint (`action` in the body, not the URL) — a
// distinct endpoint from useContractAction's, used by ClientContracts.
export function useClientContractAction(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      api.post(`/contracts/${id}/client-action`, { action }).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.contract) return;
      queryClient.setQueryData<Contract[] | undefined>(contractKeys.workspace(wsId), (old) =>
        old ? old.map((c) => (c.id === data.contract.id ? data.contract : c)) : old
      );
    },
  });
}
