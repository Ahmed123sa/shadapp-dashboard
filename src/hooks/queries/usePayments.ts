'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { reportError } from '@/lib/error-reporting';
import type { Client, Contract, Payment, PaymentTaxSummary, User } from '@/types';

// Query keys are namespaced by domain + workspace so a future migration of
// another slice (e.g. Contracts, DASHBOARD_ASSESSMENT.md Round 3 item 9)
// that also needs `/workspaces/:id/contracts` reads/invalidates the exact
// same cache entry instead of quietly maintaining a second, divergent copy.
export const paymentKeys = {
  workspace: (wsId: number) => ['payments', 'workspace', wsId] as const,
};

export const contractKeys = {
  workspace: (wsId: number) => ['contracts', 'workspace', wsId] as const,
};

type WorkspacePaymentsData = {
  payments: Payment[];
  taxSummary: PaymentTaxSummary | null;
  // Only populated by the client-facing endpoint response (ClientPayments);
  // PaymentsTab's staff view ignores it. Kept on the shared shape rather
  // than a second query so both components read/invalidate the same
  // `/workspaces/:id/payments` cache entry instead of fetching it twice.
  methods: string[];
};

async function fetchWorkspacePayments(wsId: number): Promise<WorkspacePaymentsData> {
  const { data } = await api.get(`/workspaces/${wsId}/payments`);
  return {
    payments: data.payments?.data || data.payments || [],
    taxSummary: data.tax_summary || null,
    methods: data.available_methods || [],
  };
}

async function fetchWorkspaceContracts(wsId: number): Promise<Contract[]> {
  const { data } = await api.get(`/workspaces/${wsId}/contracts`);
  const raw = data.contracts;
  return Array.isArray(raw) ? raw : (raw?.data || []);
}

// Polling interval preserved as-is from the manual `setInterval(load, 30000)`
// PaymentsTab used before this migration (see DASHBOARD_ASSESSMENT.md Round
// 3 / P1 "Polling + WebSockets running in parallel"). Payments have no
// websocket push today, so this stays the mechanism for "someone else
// approved/rejected this, refresh" until that gap is closed separately —
// removing it here would be a behavior change, not just a refactor.
const POLL_INTERVAL_MS = 30000;

export function useWorkspacePayments(wsId: number) {
  return useQuery({
    queryKey: paymentKeys.workspace(wsId),
    queryFn: () => fetchWorkspacePayments(wsId),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useWorkspaceContracts(wsId: number) {
  return useQuery({
    queryKey: contractKeys.workspace(wsId),
    queryFn: () => fetchWorkspaceContracts(wsId),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useReviewPayment(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pid, action }: { pid: number; action: string }) =>
      api.post(`/payments/${pid}/review`, { action }).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.payment) return;
      queryClient.setQueryData<WorkspacePaymentsData | undefined>(paymentKeys.workspace(wsId), (old) =>
        old ? { ...old, payments: old.payments.map((p) => (p.id === data.payment.id ? data.payment : p)) } : old
      );
    },
  });
}

export function useSchedulePayments(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    // contract_id is optional per installment — sent when the workspace's
    // contracts span more than one currency, so the backend can resolve the
    // right one (PaymentController::resolveCurrency() overrides `currency`
    // to the linked contract's regardless, see payment-currency-plan.md).
    mutationFn: (installments: Array<{ amount: string; currency: string; due_date: string; installment_label: string; contract_id?: number }>) =>
      api.post(`/workspaces/${wsId}/payments/schedule`, { installments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.workspace(wsId) });
    },
  });
}

export function useRequestPayment(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { amount: number; currency: string; notes?: string; contract_id?: number }) =>
      api.post(`/workspaces/${wsId}/payments/request`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.workspace(wsId) });
    },
  });
}

export function useDeletePaymentSchedule(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pid: number) => api.delete(`/payments/${pid}/schedule`),
    onSuccess: (_res, pid) => {
      queryClient.setQueryData<WorkspacePaymentsData | undefined>(paymentKeys.workspace(wsId), (old) =>
        old ? { ...old, payments: old.payments.filter((p) => p.id !== pid) } : old
      );
    },
  });
}

// mutationFn takes the already-built FormData (including `_method: PUT` for
// edits) plus the URL, since ClientPayments builds that payload itself
// (proof file, amount, currency, method_type) and the two cases only differ
// by URL/verb — no reason to duplicate that construction in the hook.
type SubmitClientPaymentVars = { url: string; form: FormData; editingPaymentId: number | null };

export function useSubmitClientPayment(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ url, form }: SubmitClientPaymentVars) =>
      api.post(url, form).then((r) => r.data),
    onSuccess: (data, { editingPaymentId }: SubmitClientPaymentVars) => {
      if (!data?.payment) return;
      queryClient.setQueryData<WorkspacePaymentsData | undefined>(paymentKeys.workspace(wsId), (old) => {
        if (!old) return old;
        return {
          ...old,
          payments: editingPaymentId
            ? old.payments.map((p) => (p.id === editingPaymentId ? data.payment : p))
            : [...old.payments, data.payment],
        };
      });
    },
  });
}

// ─── Finance page (org-wide payments list) ──────────────────────────────

export type FinanceFilters = {
  page: number;
  search: string;
  status: string;
  currency: string;
  clientId: string;
  managerId: string;
  dateFrom: string;
  dateTo: string;
};

// Aggregate counters + a paginated payments page from /all-payments. Kept as
// one response type (not split into two queries) because the old FinancePage
// deliberately let `stats` stay stale while `payments`/`pagination` reload —
// splitting them would need two separate placeholderData rules to reproduce
// that, for no real benefit.
type FinanceStats = {
  total_count?: number;
  approved_count?: number;
  pending_count?: number;
  approved_total_sar?: number | string;
  approved_total_usd?: number | string;
  // Every currency an approved payment was made in (SAR/USD included),
  // e.g. { SAR: 1000, USD: 500, EGP: 300 }. Additive alongside the two
  // scalar fields above — used to render a card for any currency beyond
  // SAR/USD without touching the existing ones.
  approved_by_currency?: Record<string, number | string>;
};

type AllPaymentsData = {
  payments: Payment[];
  pagination: { current_page: number; last_page: number; total: number };
  stats: FinanceStats | null;
};

export const allPaymentsKeys = {
  list: (filters: FinanceFilters) => ['payments', 'all-payments', filters] as const,
};

async function fetchAllPayments(filters: FinanceFilters): Promise<AllPaymentsData> {
  const params = new URLSearchParams();
  params.set('page', String(filters.page));
  params.set('per_page', '25');
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.currency) params.set('currency', filters.currency);
  if (filters.clientId) params.set('client_id', filters.clientId);
  if (filters.managerId) params.set('manager_id', filters.managerId);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);

  const { data } = await api.get(`/all-payments?${params.toString()}`);
  const paginated = data.payments;
  return {
    payments: paginated?.data || [],
    pagination: {
      current_page: paginated?.current_page || 1,
      last_page: paginated?.last_page || 1,
      total: paginated?.total || 0,
    },
    stats: data.stats || null,
  };
}

export function useAllPayments(filters: FinanceFilters) {
  return useQuery({
    queryKey: allPaymentsKeys.list(filters),
    queryFn: () => fetchAllPayments(filters),
    // Reproduces the old imperative version's behavior: `stats` and the
    // previous page's rows stayed on screen (untouched) while a refetch was
    // in flight — only a `loading` flag gated the table's own skeleton.
    // Without this, changing a filter would blank stats/pagination back to
    // nothing for a tick before the new response lands.
    placeholderData: (previousData) => previousData,
  });
}

type FinanceFilterOptions = { clients: Client[]; managers: User[] };

async function fetchFinanceFilterOptions(): Promise<FinanceFilterOptions> {
  const clientsPromise = api.get('/clients?per_page=100')
    .then(({ data }) => data.clients?.data || data.clients || [])
    .catch((err) => { reportError('FinancePage.loadClients', err); return []; });

  const managersPromise = api.get('/account-managers')
    .then(({ data }) => data.account_managers || data.users || [])
    .catch(() =>
      api.get('/users')
        .then(({ data }) => data || [])
        .catch((err) => { reportError('FinancePage.loadManagers', err); return []; })
    );

  const [clients, managers] = await Promise.all([clientsPromise, managersPromise]);
  return { clients, managers };
}

// One-time (per session) dropdown data for the finance filter toolbar — the
// account-managers -> users fallback and both error paths are folded into
// the query itself rather than surfaced as query errors, matching the old
// effect's behavior of degrading to empty arrays instead of ever
// error-stating this list.
export function useFinanceFilterOptions() {
  return useQuery({
    queryKey: ['payments', 'finance-filter-options'],
    queryFn: fetchFinanceFilterOptions,
    staleTime: Infinity,
  });
}
