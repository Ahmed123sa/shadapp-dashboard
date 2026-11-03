'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// CLIENT_ASSISTANT_PLAN.md ٦ — the client's assistant. The server builds every
// sentence in both languages from the client's own data (and from the wording
// the super admin set), so this is a plain read: no logic of its own.

export type AssistantText = { ar: string; en: string };
export type AssistantTarget = 'contracts' | 'payments' | 'chat' | 'approvals' | 'files' | 'meetings';

export interface AssistantQuestion {
  id: number | null;
  key: string | null;
  kind: 'data' | 'faq';
  question: AssistantText;
  answer: AssistantText;
  progress?: { paid: number; total: number };
  actions: { target: AssistantTarget }[];
}

export type AssistantResponse =
  | { enabled: false }
  | {
      enabled: true;
      assistant: { name: AssistantText; welcome: AssistantText };
      questions: AssistantQuestion[];
    };

export const assistantKeys = {
  workspace: (wsId: number) => ['assistant', 'workspace', wsId] as const,
};

async function fetchAssistant(wsId: number): Promise<AssistantResponse> {
  const { data } = await api.get(`/workspaces/${wsId}/assistant`);
  return data;
}

// Always fetched (it also tells the page whether to show the button at all),
// but only re-read on demand: the panel asks for a fresh copy each time it
// opens, so the numbers are never older than the moment the client looks.
export function useClientAssistant(wsId: number | undefined) {
  return useQuery({
    queryKey: assistantKeys.workspace(wsId ?? 0),
    queryFn: () => fetchAssistant(wsId as number),
    enabled: !!wsId,
    staleTime: 60_000,
    retry: false,
  });
}
