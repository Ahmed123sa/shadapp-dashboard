import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import DashboardHome from '../page';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// Characterization test written before splitting dashboard/page.tsx (665
// lines) into smaller files. It locks in the four branches DashboardHome
// switches between (isSA x grid/list view) so the extraction can be
// verified mechanically instead of by eyeballing the diff.

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
  isAuthenticated: vi.fn(() => true),
}));

// 26 Sept 2026 — SAManagersView now renders PendingApprovalsPanel
// (pending-approvals-plan.md ك2), which calls subscribeToNotifications on
// mount. Mocked for the same reason useBadgeCounts.test.tsx mocks it: no
// real Echo/Pusher connection is available in jsdom.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToNotifications: vi.fn(() => null),
}));

// `view` is read from useSearchParams — mutable per-test via currentView so
// each test can pick which of the four branches it exercises.
let currentView = '';
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: (key: string) => (key === 'view' ? currentView || null : null) }),
}));

let mock: MockAdapter;

const client = {
  id: 1,
  company_name: 'Acme Corp',
  contact_person: 'John Doe',
  email: 'john@acme.com',
  status: 'active',
  contract_value: '1000',
  payment_status: 'paid',
  signed_at: null,
  client_type: 'business',
  avatar_url: null,
  workspace: { id: 5, status: 'active' },
  updated_at: '2026-08-30T10:00:00Z',
};

const contract = {
  id: 1,
  title: 'Contract A',
  status: 'company_approved',
  contract_type: 'main',
  value: '5000',
  currency: 'SAR',
  created_at: '2026-08-30T10:00:00Z',
  workspace: { id: 5, client: { company_name: 'Acme Corp', id: 1 } },
};

const payment = {
  id: 1,
  amount: '2000',
  currency: 'SAR',
  method_type: 'bank_transfer',
  status: 'approved',
  created_at: '2026-08-30T10:00:00Z',
  workspace: { id: 5, client: { company_name: 'Acme Corp', id: 1 } },
  contract: { id: 1, title: 'Contract A' },
};

const meeting = {
  id: 1,
  title: 'Kickoff Meeting',
  scheduled_at: '2026-08-30T10:00:00Z',
  duration_minutes: 30,
  status: 'scheduled',
  created_at: '2026-08-30T10:00:00Z',
  workspace: { id: 5, client: { company_name: 'Acme Corp', id: 1 } },
};

const manager = {
  id: 9,
  name: 'Manager Mike',
  email: 'mike@shad.app',
  avatar_url: null,
  managed_clients_count: 4,
  pending_count: 1,
};

const approval = {
  id: 1,
  title: 'Approval One',
  description: '',
  status: 'pending',
  workspace: { id: 5, client: { company_name: 'Acme Corp', id: 1 } },
  created_at: '2026-08-30T10:00:00Z',
};

beforeEach(() => {
  currentView = '';
  mock = new MockAdapter(api);
  mock.onGet(/\/clients/).reply(200, { clients: { data: [client] } });
  mock.onGet(/\/all-contracts/).reply(200, { contracts: { data: [contract], last_page: 1, total: 1 } });
  mock.onGet(/\/all-payments/).reply(200, { payments: { data: [payment], last_page: 1, total: 1 } });
  mock.onGet(/\/all-meetings/).reply(200, { meetings: { data: [meeting], last_page: 1, total: 1 } });
  mock.onGet(/\/notifications/).reply(200, { unread_count: 3, unread_clients_count: 2 });
  mock.onGet(/\/account-managers/).reply(200, { managers: [manager] });
  mock.onGet(/\/approvals\/pending/).reply(200, { approvals: [approval] });
  // AMView/SAManagersView both read their summary cards from this now
  // (server-side-stats-plan.md) instead of computing them from the lists
  // above; the numbers themselves aren't what this characterization test
  // checks, just that the page still renders its labels and lists.
  mock.onGet(/\/dashboard\/stats/).reply(200, {
    clients: { total: 1 }, contracts: { active: 1, awaiting_client: 0 },
    payments: { pending: 0 },
    approvals: { pending_requests: 1, pending_contracts: 0, pending_payments: 0, total: 1 },
    revenue_this_month: { SAR: 2000 }, period: { month: '2026-08', timezone: 'Africa/Cairo' },
  });
  // pending-approvals-plan.md ك2 — SAManagersView's "Pending Approvals"
  // section now reads this endpoint via PendingApprovalsPanel instead of
  // the pendingApprovals prop built from /approvals/pending above.
  mock.onGet(/\/dashboard\/pending-approvals/).reply(200, {
    awaiting_you: { contracts: [], payments: [] },
    awaiting_client: {
      contracts: [],
      approvals: [{
        id: 1, type: 'approval', title: 'Approval One', status: 'pending',
        workspace_id: 5, created_at: '2026-08-30T10:00:00Z',
        client: { id: 1, uuid: 'acme-uuid', company_name: 'Acme Corp' },
      }],
    },
    counts: { pending_requests: 1, pending_contracts: 0, pending_payments: 0, total: 1 },
  });
});

afterEach(() => {
  mock.restore();
  vi.mocked(getUser).mockReset();
});

describe('DashboardHome', () => {
  it('AM grid view: shows stats and the client table', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 2, name: 'AM', email: 'am@example.com', role: 'account_manager' });
    renderWithIntl(<DashboardHome />);

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    // "My Clients" is used twice on this view: once as the stat card label,
    // once as the client table's section header — both are correct.
    expect(screen.getAllByText('My Clients').length).toBe(2);
    expect(screen.getByText('Active Contracts')).toBeInTheDocument();
    expect(screen.getByText('Pending Payments')).toBeInTheDocument();
    expect(screen.getByText('Unread Messages')).toBeInTheDocument();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('AM list view (contracts): renders the paginated contracts table', async () => {
    currentView = 'contracts';
    vi.mocked(getUser).mockReturnValue({ id: 2, name: 'AM', email: 'am@example.com', role: 'account_manager' });
    renderWithIntl(<DashboardHome />);

    expect(await screen.findByText('Contract A')).toBeInTheDocument();
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
  });

  it('SA grid view: shows the manager table and pending approvals', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
    renderWithIntl(<DashboardHome />);

    expect(await screen.findByText('Manager Mike')).toBeInTheDocument();
    expect(screen.getByText('Total Clients')).toBeInTheDocument();
    expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
    expect(await screen.findByText('Approval One')).toBeInTheDocument();
  });

  it('SA list view (meetings): delegates to the paginated meetings table', async () => {
    currentView = 'meetings';
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
    renderWithIntl(<DashboardHome />);

    expect(await screen.findByText('Kickoff Meeting')).toBeInTheDocument();
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
  });
});
