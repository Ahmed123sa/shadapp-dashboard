'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { StaffPermissions } from '@/lib/staff-permissions';

// A manager's own team of company staff (PLAN_2_MANAGER_TEAMS.md): the page at
// /dashboard/team and the "Team" tab inside a client's workspace read the same
// cache entry, so adding someone or changing a permission shows up in both.

export interface TeamAssignment {
  workspace_id: number;
  client_id: number;
  uuid?: string | null;
  name?: string | null;
  permissions: StaffPermissions;
}

export interface TeamTeamRef { manager_id: number; name: string }

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  other_teams: TeamTeamRef[];
  assignments?: TeamAssignment[];
}

export interface MyTeamData { team: TeamMember[]; others: TeamMember[] }

export const myTeamKeys = {
  all: ['my-team'] as const,
  workspace: (wsId: number) => ['my-team', 'workspace', wsId] as const,
};

export function useMyTeam(enabled = true) {
  return useQuery({
    queryKey: myTeamKeys.all,
    enabled,
    queryFn: async (): Promise<MyTeamData> => {
      const { data } = await api.get('/my-team');
      return { team: data.team || [], others: data.others || [] };
    },
  });
}

export function useAddToTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) await api.post(`/my-team/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-team'] }),
  });
}

export function useRemovalImpact() {
  return useMutation({
    mutationFn: async (id: number): Promise<{ count: number; clients: string[] }> => {
      const { data } = await api.get(`/my-team/${id}/removal-impact`);
      return { count: data.count ?? 0, clients: data.clients || [] };
    },
  });
}

export function useRemoveFromTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/my-team/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-team'] }),
  });
}

/** Link a staff member to a client (or change the permissions of an existing link). */
export function useSaveStaffPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ wsId, staffId, permissions }: { wsId: number; staffId: number; permissions: StaffPermissions }) =>
      api.put(`/workspaces/${wsId}/staff/${staffId}`, { permissions }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-team'] }),
  });
}

export function useUnlinkStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ wsId, staffId }: { wsId: number; staffId: number }) =>
      api.delete(`/workspaces/${wsId}/staff/${staffId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-team'] }),
  });
}
