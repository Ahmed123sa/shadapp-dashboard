'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// CLIENT_ASSISTANT_PLAN.md ٧ — the super admin's page for the client
// assistant. Everything is a thin wrapper over /assistant/*; the server owns
// the rules (which placeholders an answer may use, the limits) and answers 422
// with a message per field, which the editor shows under the field itself.

export type Pair = { ar: string; en: string };

export interface AssistantState {
  state: string;
  ar: string;
  en: string;
  allowed: string[];
  required: string[];
  default: Pair;
}

export interface DataQuestion {
  id: number;
  key: string;
  kind: 'data';
  question: Pair;
  default_question: Pair;
  is_enabled: boolean;
  sort_order: number;
  states: AssistantState[];
}

export interface FaqQuestion {
  id: number;
  kind: 'faq';
  question: Pair;
  answer: Pair;
  action_target: string | null;
  is_enabled: boolean;
  sort_order: number;
}

export interface AssistantSettingsData {
  enabled: boolean;
  settings: { id: number | null; name: Pair; welcome: Pair; welcome_placeholders: string[] };
  questions: DataQuestion[];
  faqs: FaqQuestion[];
  targets: string[];
  limits: { question: number; answer: number; faq_answer: number; faq_max: number; name: number; welcome: number };
}

export const assistantSettingsKeys = { all: ['assistant-settings'] as const };

export function useAssistantSettings() {
  return useQuery({
    queryKey: assistantSettingsKeys.all,
    queryFn: async (): Promise<AssistantSettingsData> => (await api.get('/assistant/questions')).data,
  });
}

function useInvalidating<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assistantSettingsKeys.all }),
  });
}

export function useUpdateAssistantQuestion() {
  return useInvalidating(({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
    api.put(`/assistant/questions/${id}`, payload).then((r) => r.data));
}

export function useCreateAssistantFaq() {
  return useInvalidating((payload: Record<string, unknown>) => api.post('/assistant/questions', payload).then((r) => r.data));
}

export function useDeleteAssistantQuestion() {
  return useInvalidating((id: number) => api.delete(`/assistant/questions/${id}`).then((r) => r.data));
}

export function useReorderAssistantQuestions() {
  return useInvalidating((ids: number[]) => api.post('/assistant/questions/reorder', { ids }).then((r) => r.data));
}

export function useResetAssistantQuestion() {
  return useInvalidating((id: number) => api.post(`/assistant/questions/${id}/reset`).then((r) => r.data));
}

export type PreviewResult = { ar: { text: string; error: string | null }; en: { text: string; error: string | null } };

/** Fills sample numbers into a wording and reports what is wrong with it. Saves nothing. */
export async function previewWording(key: string, state: string, ar: string, en: string): Promise<PreviewResult> {
  const { data } = await api.post('/assistant/preview', { key, state, ar, en });
  return data;
}

/** The first message per field from a 422, keyed the way the server names the field. */
export function fieldErrors(err: unknown): Record<string, string> {
  const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e?.response?.data?.errors ?? {})) out[k] = v[0];
  if (!Object.keys(out).length && e?.response?.data?.message) out._ = e.response.data.message;
  return out;
}
