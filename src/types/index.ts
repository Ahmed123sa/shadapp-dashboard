export interface Client {
  id: number;
  // Random per-client identifier the dashboard shows in the browser URL
  // instead of the numeric id (see the backend's 2026_09_07 migration) — a
  // sequential id in the address bar lets anyone glance at it and guess how
  // many clients exist. Every client has one; optional here only because
  // older cached/partial client objects in tests may omit it.
  uuid?: string;
  company_name: string;
  contact_person: string;
  // Computed accessor (Client::getNameAttribute, in $appends) that aliases
  // contact_person — present on every serialized Client, incl. as a chat sender.
  name?: string;
  email: string;
  phone: string;
  manager_id: number;
  status: string;
  country?: string;
  industry?: string;
  client_type: 'business' | 'individual';
  contract_value: number;
  payment_status: string;
  signature_data?: string;
  signed_at?: string;
  avatar_url?: string;
  notes?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  location_address?: string | null;
  location_updated_at?: string | null;
  location_updated_by_ip?: string | null;
  // Free-text address/maps-link fields entered on the client create/settings
  // forms — separate columns from the map-picker's location_address.
  address?: string | null;
  maps_url?: string | null;
  date_of_birth?: string | null;
  workspace?: Workspace | null;
  subUsers: SubUser[];
  payments: Payment[];
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: number;
  workspace_id: number;
  title: string;
  status: ContractStatus;
  contract_type?: string;
  value: string | null;
  currency?: string;
  start_date?: string;
  end_date?: string;
  pdf_url?: string;
  client_signed_at?: string;
  company_signed_at?: string;
  archived_at?: string;
  created_by: number;
  creator?: User;
  workspace?: Workspace;
  clauses: ContractClause[];
  required_documents?: RequiredDocument[];
}

// Represents a required document as returned by the API (always has an id,
// since it's a persisted row). The outgoing create-contract payload that
// builds these from plain strings before saving is a separate, untyped shape
// — it isn't assigned to this interface.
export interface RequiredDocument {
  id: number;
  name: string;
  files?: FileEntry[];
}

export type ContractStatus =
  | 'draft' | 'sent' | 'client_approved'
  | 'edit_requested' | 'company_approved' | 'completed' | 'archived';

export interface ContractClause {
  id: number;
  contract_id: number;
  content: string;
  type: 'fixed' | 'optional' | 'custom';
  sort_order: number;
}

export interface Payment {
  id: number;
  workspace_id: number;
  client_id: number;
  amount: string | number;
  currency?: string;
  method_type: string;
  proof_file_url?: string | string[];
  // 'rejected' | 'scheduled' | 'overdue' cover manager-scheduled installments
  // (see PaymentsTab.tsx / FinancePage), not just the client-submitted flow.
  status: 'pending' | 'approved' | 'rejected' | 'scheduled' | 'overdue';
  due_date?: string | null;
  requested_by_manager?: boolean;
  notes?: string;
  reviewed_by?: number;
  reviewed_at?: string;
  contract_id?: number;
  contract?: Contract;
  client?: Client;
  workspace?: Workspace;
  created_at: string;
}

export interface Approval {
  id: number;
  workspace_id: number;
  title: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'edit_requested';
  reference_no: string;
  responded_at?: string;
  signature?: string;
  requester?: User;
  requester_id?: number;
  certificate?: ApprovalCertificate;
  files?: FileEntry[];
  workspace?: Workspace;
  created_at: string;
}

export interface ApprovalCertificate {
  id: number;
  approval_id: number;
  certificate_url?: string;
  pdf_url?: string;
  generated_at: string;
}

export interface Meeting {
  id: number;
  workspace_id: number;
  title: string;
  zoom_meeting_id?: string;
  link?: string;
  passcode?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  recording_url?: string;
  contract_id?: number;
  approval_id?: number;
  contract?: Contract;
  approval?: Approval;
  created_by?: number;
  creator?: User;
  workspace?: Workspace;
}

export interface ChatMessage {
  id: number;
  workspace_id: number;
  sender_type: string;
  sender_id: number;
  message?: string;
  type: 'text' | 'file' | 'contract' | 'meeting';
  file_url?: string;
  contract_id?: number;
  contract?: Contract;
  sender?: User | Client;
  user_id?: number;
  requires_action: boolean;
  action_taken?: boolean;
  action_result?: string;
  approval?: Approval;
  reply_to?: ChatMessage;
  read_at?: string | null;
  // Present only when type === 'meeting' — see MeetingChip's metadata prop.
  metadata?: {
    meeting_id?: number;
    title?: string;
    scheduled_at?: string;
    duration_minutes?: number;
    link?: string;
    passcode?: string;
    status?: string;
  };
  created_at: string;
}

export interface FileEntry {
  id: number;
  workspace_id: number;
  document_definition_id?: number;
  file_url: string;
  name: string;
  type: string;
  size: number;
  status: 'pending' | 'approved' | 'rejected';
  // Computed server-side (FileController::computeTag) from the linked
  // document definition or contract required-document name — not a stored column.
  tag?: string;
  rejection_reason?: string;
  reviewed_by?: number;
  reviewed_at?: string;
  document_definition?: DocumentDefinition;
  uploaded_by_type: string;
  uploaded_by_id: number;
}

// A payment's proof-of-payment file, shaped by FileController::index() as a
// synthetic file-like entry (id is 'payment-<id>', not a FileEntry row).
// status mirrors Payment.status verbatim (kept as string, not the Payment
// union, since the UI also defensively checks a 'verified' value the backend
// never actually sends).
export interface PaymentProofFile {
  id: string;
  payment_id: number;
  name: string;
  tag?: string;
  file_url?: string | null;
  file_urls?: string[];
  amount: string | number;
  currency?: string;
  status: string;
  created_at: string;
  source: 'payment';
}

export interface DocumentDefinition {
  id: number;
  workspace_id: number;
  name: string;
  description?: string;
  is_required: boolean;
  sort_order: number;
}

export interface Workspace {
  id: number;
  client_id: number;
  manager_id: number;
  status: 'active' | 'inactive';
  activated_at?: string;
  client: Client;
  manager?: User;
  // Only present on the full single-workspace fetch (WorkspaceController::show
  // eager-loads these); not included on the lighter workspace summary nested
  // under a client record.
  contracts?: Contract[];
  payments?: Payment[];
  approvals?: Approval[];
  meetings?: Meeting[];
  files?: FileEntry[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'account_manager';
  official_email?: string;
  signature_data?: string;
  signed_at?: string;
  avatar_url?: string;
  phone?: string;
  date_of_birth?: string;
  // Present on account-manager list rows (AccountManagersPage), a computed
  // count from the managers index endpoint — not on every User payload.
  managed_clients_count?: number;
  // Present on account managers only — super admins never go through the
  // deactivate/activate flow. See DATA_SAFETY_PLAN.md §2.2.
  is_active?: boolean;
  deactivated_at?: string | null;
}

// A scoped, whitelisted data-export request — DATA_SAFETY_PLAN.md §3. See
// App\Models\DataExport (backend) for the source of truth; `download_url`
// only appears here because DataExportController::index() explicitly
// appends it per row (it's a fresh 15-minute signed URL, never cached on
// the model's own $appends — see that controller's docblock).
export interface DataExport {
  id: number;
  scope: 'system' | 'manager' | 'client';
  scope_id: number | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  file_size: number | null;
  error: string | null;
  expires_at: string | null;
  created_at: string;
  download_url: string | null;
}

// A Laravel database notification row (Notifications::index). `data` is the
// notification's payload JSON and varies by notification type — only the
// keys NotificationBell actually reads are declared here.
export interface AppNotification {
  id: string;
  data: {
    type?: string;
    title?: string;
    message?: string;
    client_id?: number;
    workspace_id?: number;
    [key: string]: unknown;
  };
  read_at?: string | null;
  created_at: string;
}

// An audit-log row (AuditLogController::index). `auditable` is genuinely
// polymorphic — its shape depends on `auditable_type` (Contract, Payment,
// Client, Meeting, Approval, FileEntry, Workspace, ...), and AuditLogPage
// branches on that type string at runtime rather than narrowing a union.
// Kept as a loose record rather than forcing an artificial precise union.
export interface AuditLog {
  id: number;
  action: string;
  ip_address?: string | null;
  created_at: string;
  user?: { id: number; name: string } | null;
  client?: { company_name?: string; contact_person?: string; name?: string; client_type?: string } | null;
  auditable_type?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditable?: Record<string, any> | null;
}

// The /reports payload (ReportsController::index) — a dashboard aggregate
// with fields that vary by which filters were applied. All optional since
// ReportsPage reads every field defensively (`reports?.x ?? default`).
export interface ReportsData {
  total_clients?: number;
  contracts_by_status?: Record<string, number | string>;
  payments_by_month?: Record<string, number | string>;
  approval_stats?: { approved?: number | string; rejected?: number | string; pending?: number | string };
  pending_approvals?: number;
  active_workspaces?: number;
  conversion_rate?: number;
  manager_stats?: { name?: string; revenue?: number; clients?: number | string; contracts?: number | string }[];
  recent_logins?: number;
  total_logins?: number;
  avg_logins?: number;
}

export interface SubUser {
  id: number;
  client_id?: number;
  name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  avatar_url?: string | null;
  permissions?: Record<string, boolean>;
}

// The tax_summary block returned alongside a workspace's payments
// (PaymentController::index) — all four fields are always present together,
// computed server-side as PHP floats (SettingsController::taxSummary has the
// identical shape for the client-facing endpoint).
export interface PaymentTaxSummary {
  contracts_total: number;
  tax_percentage: number;
  tax_amount: number;
  grand_total: number;
}

export interface ContractClauseTemplate {
  id: number;
  content: string;
  type: 'fixed' | 'optional';
  category?: string;
  is_active: boolean;
  sort_order: number;
}
