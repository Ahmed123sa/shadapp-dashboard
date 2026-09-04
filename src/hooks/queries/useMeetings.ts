'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Meeting } from '@/types';

// MeetingsTab (staff view) and ClientMeetings (client view) both hit the
// exact same `/workspaces/:id/meetings` endpoint, so they share this one
// cache entry/key rather than each fetching their own copy.
export const meetingKeys = {
  workspace: (wsId: number) => ['meetings', 'workspace', wsId] as const,
};

async function fetchWorkspaceMeetings(wsId: number): Promise<Meeting[]> {
  const { data } = await api.get(`/workspaces/${wsId}/meetings`);
  return data.meetings?.data || data.meetings || [];
}

export function useWorkspaceMeetings(wsId: number) {
  return useQuery({
    queryKey: meetingKeys.workspace(wsId),
    queryFn: () => fetchWorkspaceMeetings(wsId),
  });
}

type CreateMeetingPayload = {
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string;
  contract_id?: string;
  approval_id?: string;
};

export function useCreateMeeting(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMeetingPayload) =>
      api.post(`/workspaces/${wsId}/meetings`, payload).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.meeting) return;
      queryClient.setQueryData<Meeting[] | undefined>(meetingKeys.workspace(wsId), (old) =>
        old ? [...old, data.meeting] : old
      );
    },
  });
}

export function useCompleteMeeting(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/meetings/${id}/complete`).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.meeting) return;
      queryClient.setQueryData<Meeting[] | undefined>(meetingKeys.workspace(wsId), (old) =>
        old ? old.map((m) => (m.id === data.meeting.id ? data.meeting : m)) : old
      );
    },
  });
}

export function useCancelMeeting(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/meetings/${id}/cancel`).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.meeting) return;
      queryClient.setQueryData<Meeting[] | undefined>(meetingKeys.workspace(wsId), (old) =>
        old ? old.map((m) => (m.id === data.meeting.id ? data.meeting : m)) : old
      );
    },
  });
}
