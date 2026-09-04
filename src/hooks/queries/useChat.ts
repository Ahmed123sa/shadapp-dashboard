'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { reportError } from '@/lib/error-reporting';
import type { ChatMessage } from '@/types';

// Shared by ChatTab (staff) and ClientChat (client view) — both read/write
// the exact same `/workspaces/:id/chat` endpoint, so one cache entry.
export const chatKeys = {
  workspace: (wsId: number) => ['chat', 'workspace', wsId] as const,
};

// Polling interval preserved as-is from the manual `setInterval(load, 60000)`
// both ChatTab and ClientChat used before this migration.
const POLL_INTERVAL_MS = 60000;

async function fetchWorkspaceChat(wsId: number): Promise<ChatMessage[]> {
  const { data } = await api.get(`/workspaces/${wsId}/chat`);
  // Fire-and-forget, exactly like the original: a failed mark-read never
  // fails the load or blocks the messages from rendering, it's just logged.
  api.post(`/workspaces/${wsId}/chat/mark-read`).catch((err) => reportError('useWorkspaceChat.markRead', err));
  return data.messages || [];
}

export function useWorkspaceChat(wsId: number) {
  return useQuery({
    queryKey: chatKeys.workspace(wsId),
    queryFn: () => fetchWorkspaceChat(wsId),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

// The `/workspaces/:id/chat` POST (send) is identical between ChatTab and
// ClientChat — only the FormData contents (reply_to_id, etc.) differ by
// caller, which stays in each component.
export function useSendChatMessage(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.post(`/workspaces/${wsId}/chat`, form).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.message) return;
      queryClient.setQueryData<ChatMessage[] | undefined>(chatKeys.workspace(wsId), (old) =>
        old ? [...old, data.message] : old
      );
    },
  });
}

// Staff-only: toggles the "requires action" flag on a message (ChatTab).
export function useToggleChatAction(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/chat/${id}/require-action`).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.message) return;
      queryClient.setQueryData<ChatMessage[] | undefined>(chatKeys.workspace(wsId), (old) =>
        old ? old.map((m) => (m.id === data.message.id ? data.message : m)) : old
      );
    },
  });
}

// Client-only: responds (approve / request edit) to a message that requires
// action (ClientChat).
export function useRespondChatAction(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      api.post(`/chat/${id}/respond`, { action }).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.message) return;
      queryClient.setQueryData<ChatMessage[] | undefined>(chatKeys.workspace(wsId), (old) =>
        old ? old.map((m) => (m.id === data.message.id ? data.message : m)) : old
      );
    },
  });
}
