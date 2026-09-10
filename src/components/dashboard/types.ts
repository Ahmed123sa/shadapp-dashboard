import type { useTranslations } from 'next-intl';

// These mirror the shapes DashboardHome's own API calls return (/clients,
// /all-contracts, /all-payments, /all-meetings, /account-managers,
// /approvals/pending) rather than the shared @/types definitions — several
// dashboard-specific fields (e.g. FileFile's nested workspace.client) aren't
// present on the shared types, so they're kept local intentionally.

export type Client = {
  id: number; company_name: string; contact_person: string; email: string;
  status: string; contract_value: string; payment_status: string; signed_at: string | null;
  client_type?: string;
  avatar_url?: string | null;
  // Present on every /clients and /account-managers/{id} response (the
  // column is backfilled for existing rows and auto-generated for new
  // ones - see Client::resolveRouteBinding()) - lets client links use the
  // uuid instead of the numeric id, skipping the redirect ClientWorkspace
  // otherwise does on load.
  uuid?: string;
  workspace: { id: number; status: string } | null;
  latest_contract?: { id: number; status: string; value: string } | null;
  updated_at: string;
};

export type Contract = {
  id: number; title: string; status: string; contract_type?: string; value: string; currency: string;
  created_at?: string;
  workspace?: { id: number; client?: { company_name: string; id: number } };
};

export type Payment = {
  id: number; amount: string; currency: string; method_type: string; status: string;
  workspace?: { id: number; client?: { company_name: string; id: number } };
  contract?: { title: string; id: number } | null;
  created_at: string;
};

export type Meeting = {
  id: number; title: string; scheduled_at: string; duration_minutes: number;
  status: string; notes?: string;
  workspace?: { id: number; client?: { company_name: string; id: number } };
  contract?: { id: number } | null;
  created_at: string;
};

export type FileFile = {
  id: number; name: string; type: string; size: number; file_url: string; status: string;
  workspace?: { id: number; client?: { company_name: string; id: number } };
  uploaded_by?: { name: string } | null;
  created_at: string;
};

export type Manager = {
  id: number; name: string; email: string; avatar_url: string | null;
  managed_clients_count: number;
  pending_count?: number;
  clients?: Client[];
};

export type Approval = {
  id: number; title: string; description: string; status: string;
  workspace?: { id: number; client?: { company_name: string; id: number; uuid?: string } };
  created_at: string;
};

export type PaginatedResponse<T> = { data: T[]; current_page: number; last_page: number; per_page: number; total: number };

// The next-intl translate function, passed down as a prop between these
// subcomponents rather than each calling useTranslations() itself.
export type TFunc = ReturnType<typeof useTranslations>;
