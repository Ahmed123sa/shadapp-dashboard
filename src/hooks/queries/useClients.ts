'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Client } from '@/types';

export const clientKeys = {
  list: (page: number, query: string) => ['clients', 'list', page, query] as const,
  detail: (id: number | string) => ['clients', 'detail', id] as const,
  profile: (id: number | string) => ['clients', 'profile', id] as const,
  activity: (id: number | string) => ['clients', 'activity', id] as const,
};

// ─── Clients list (ClientsPage) ──────────────────────────────

export type ClientsListData = { clients: Client[]; totalPages: number };

async function fetchClients(page: number, query: string): Promise<ClientsListData> {
  const params = new URLSearchParams({ page: String(page), per_page: '30' });
  if (query) params.set('q', query);
  const { data } = await api.get(`/clients?${params}`);
  return {
    clients: data.clients?.data || data.clients || [],
    totalPages: data.clients?.last_page || 1,
  };
}

// `query` is whatever the caller wants fetched with this page — ClientsPage
// deliberately passes '' for pagination clicks even with an active search
// (a pre-existing quirk being preserved as-is, not fixed here: paginating
// silently drops the current search term, see the original fetchClients(p)
// call with no second argument).
export function useClients(page: number, query: string) {
  return useQuery({
    queryKey: clientKeys.list(page, query),
    queryFn: () => fetchClients(page, query),
    // Without this, every keystroke in the search box (once the 400ms
    // debounce fires) changes the query key and briefly clears `data`,
    // which made ClientsPage fall into its isFetching branch and swap the
    // whole page - search input included - for a loading skeleton. The
    // input's DOM node got unmounted mid-search, so it lost focus and the
    // user had to click back in after every character. Keeping the
    // previous page's data visible during a refetch avoids that: only the
    // very first load (no data at all yet) should show a full-page
    // skeleton, not every subsequent search/pagination fetch.
    placeholderData: keepPreviousData,
  });
}

export function useCreateClient() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/clients', payload).then((r) => r.data),
  });
}

// Shared by ClientsPage's create form and ClientSettingsPage's photo
// change — both POST the same `/clients/:id/profile` endpoint, just with
// different extra FormData fields alongside `avatar`.
export function useUploadClientAvatar() {
  return useMutation({
    mutationFn: ({ id, formData }: { id: number | string; formData: FormData }) =>
      api.post(`/clients/${id}/profile`, formData).then((r) => r.data),
  });
}

// ─── Single client record — shared by ClientWorkspace (header/tabs) and
// ClientSettingsPage (seeds its local edit form once, see that page's own
// migration notes) ──────────────────────────────

async function fetchClient(id: number | string): Promise<Client> {
  const { data } = await api.get(`/clients/${id}`);
  return data.client;
}

// `enabled` defaults to true (existing callers all pass a route-param id
// that's never falsy). client-dashboard/page.tsx (REALTIME_PLAN.md Stage 3)
// is the first caller that may not have an id yet — the client session is
// read from localStorage after mount, so this needs to stay off until then
// instead of firing a request against `/clients/undefined`.
export function useClient(id: number | string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => fetchClient(id),
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateClient(id: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put(`/clients/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(id) });
    },
  });
}

// ─── ClientProfileTab ──────────────────────────────

// The /clients/{id}/profile aggregate response — a bespoke bundle distinct
// from the plain Client record (adds computed stats + the location check-in).
export type ClientProfileStats = {
  total_contracts: number; draft_contracts: number; sent_contracts: number;
  completed_contracts: number; meetings_count: number; approvals_count: number;
  total_contract_value?: number | string; total_paid?: number | string; pending_payments?: number | string;
};
export type ClientProfileLocation = {
  latitude?: number | string | null; longitude?: number | string | null;
  updated_at?: string | null; address?: string | null; maps_url?: string | null;
};
export type ClientProfileResponse = { client: Client; stats: ClientProfileStats; location?: ClientProfileLocation | null };

async function fetchClientProfile(clientId: number): Promise<ClientProfileResponse> {
  const { data } = await api.get(`/clients/${clientId}/profile`);
  return data;
}

export function useClientProfile(clientId: number) {
  return useQuery({
    queryKey: clientKeys.profile(clientId),
    queryFn: () => fetchClientProfile(clientId),
  });
}

export type ActivityEvent = {
  id: string;
  kind: string;
  timestamp: string;
  ref_type: 'contract' | 'payment' | 'approval' | 'meeting';
  ref_id: number;
  title: string;
  amount?: number;
  currency?: string;
};

async function fetchClientActivity(clientId: number): Promise<ActivityEvent[]> {
  const { data } = await api.get(`/clients/${clientId}/activity`);
  return data.activity || [];
}

export function useClientActivity(clientId: number) {
  return useQuery({
    queryKey: clientKeys.activity(clientId),
    queryFn: () => fetchClientActivity(clientId),
  });
}

// On success the original called its own `load()` again (a full profile
// refetch) rather than patching the cache locally — invalidating here
// reproduces that exactly, including re-fetching stats that a new location
// wouldn't otherwise change.
export function useCheckInClientLocation(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { latitude: number; longitude: number; address?: string }) =>
      api.post(`/clients/${clientId}/location`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.profile(clientId) });
    },
  });
}
