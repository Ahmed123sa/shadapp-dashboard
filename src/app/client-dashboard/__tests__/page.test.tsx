import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientDashboardPage from '../page';
import api from '@/lib/api';
import * as clientAuth from '@/lib/client-auth';
import { subscribeToWorkspace } from '@/lib/echo';

// Characterization suite originally written BEFORE migrating this page off
// manual useState/useEffect/api.get() onto TanStack Query +
// useWorkspaceRealtime (REALTIME_PLAN.md Stage 3). Now updated post-migration
// (Stage 3 steps 2-4 are done): the 10-second workspace poll has been
// replaced with a `subscribeToWorkspace` realtime subscription, so this file
// pins down the *new* observable behavior — same endpoints/rendering/tab
// assertions as before, plus the realtime wiring and the poll's removal —
// instead of the interim assumptions.

// The real subscription touches Echo/Pusher (WebSocket), which isn't
// available in jsdom — same mocking approach as useWorkspaceRealtime's own
// test suite.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToWorkspace: vi.fn(),
}));

vi.mock('@/lib/client-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/client-auth')>()),
  isClientAuthenticated: vi.fn(),
  getClient: vi.fn(),
  clientLogout: vi.fn(),
  isSubUser: vi.fn(),
  hasSubUserPermission: vi.fn(),
  getSubUser: vi.fn(),
}));

const push = vi.fn();
let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

let mock: MockAdapter;

const session = { id: 7, company_name: 'Acme Corp', contact_person: 'Jane', email: 'jane@acme.com', status: 'active', has_signed: true };

function mockClient(overrides?: Record<string, unknown>) {
  mock.onGet('/clients/7').reply(200, {
    client: {
      id: 7,
      company_name: 'Acme Corp',
      signed_at: '2026-01-01T00:00:00Z',
      client_type: 'business',
      workspace: null,
      ...overrides,
    },
  });
}

function mockWorkspace(wsOverrides?: Record<string, unknown>) {
  mock.onGet('/workspaces/22').reply(200, {
    workspace: {
      id: 22,
      status: 'inactive',
      contracts: [],
      payments: [],
      approvals: [],
      ...wsOverrides,
    },
  });
}

// Registered last (axios-mock-adapter checks handlers in registration
// order) so tab components mounted underneath (ClientContracts, etc.) get a
// harmless response instead of an unhandled-rejection/console error — this
// suite only characterizes the page shell, not each tab's own behavior
// (those have their own characterization suites).
function mockFallback() {
  mock.onAny().reply(200, {});
}

beforeEach(() => {
  mock = new MockAdapter(api);
  searchParams = new URLSearchParams();
  push.mockClear();
  vi.mocked(clientAuth.isClientAuthenticated).mockReturnValue(true);
  vi.mocked(clientAuth.getClient).mockReturnValue(session as any);
  vi.mocked(clientAuth.isSubUser).mockReturnValue(false);
  vi.mocked(clientAuth.hasSubUserPermission).mockReturnValue(true);
  vi.mocked(clientAuth.getSubUser).mockReturnValue(null);
  vi.mocked(subscribeToWorkspace).mockReturnValue(vi.fn());
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientDashboardPage (characterization)', () => {
  it('redirects to /client-login when not authenticated', async () => {
    vi.mocked(clientAuth.isClientAuthenticated).mockReturnValue(false);
    vi.mocked(clientAuth.getClient).mockReturnValue(null);
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/client-login'));
  });

  it('loads the client on mount and calls GET /clients/:id', async () => {
    mockClient();
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/clients/7')).toBe(true));
  });

  it('shows the welcome/sign-required screen when the client has not signed yet', async () => {
    mockClient({ signed_at: null });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText('Welcome to ShadApp')).toBeInTheDocument());
    expect(screen.getByText('Register your electronic signature — Required first')).toBeInTheDocument();
  });

  it('shows the waiting-for-workspace screen once signed but before a workspace exists', async () => {
    mockClient({ signed_at: '2026-01-01T00:00:00Z', workspace: null });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText('Your signature has been saved successfully')).toBeInTheDocument());
    expect(screen.getByText('Waiting for workspace creation — your admin will create the contract soon')).toBeInTheDocument();
  });

  it('loads the workspace and renders stats + tabs once a workspace exists', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace({ status: 'inactive', contracts: [{ id: 1, status: 'sent' }], payments: [] });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/workspaces/22')).toBe(true));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Contracts' })).toBeInTheDocument());
    // Contracts stat card reflects the loaded workspace.contracts length.
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('shows the payment-accepted banner when a payment is approved but the workspace is not yet active', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace({ status: 'inactive', payments: [{ id: 5, status: 'approved' }] });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText(/Payment approved — workspace will be activated/)).toBeInTheDocument());
  });

  it('does not show the payment-accepted banner once the workspace is active', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace({ status: 'active', payments: [{ id: 5, status: 'approved' }] });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Contracts' })).toBeInTheDocument());
    expect(screen.queryByText(/Payment approved — workspace will be activated/)).not.toBeInTheDocument();
  });

  it('syncs the active tab from the ?tab= query param on mount', async () => {
    searchParams = new URLSearchParams('tab=Payments');
    mockClient({ workspace: { id: 22 } });
    mockWorkspace();
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Payments' })).toBeInTheDocument());
    const paymentsBtn = screen.getByRole('button', { name: 'Payments' });
    expect(paymentsBtn.className).toContain('border-[var(--color-primary)]');
  });

  it('switches tabs when a tab button is clicked', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace();
    mockFallback();
    const user = userEvent.setup();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Contracts' })).toBeInTheDocument());
    const filesBtn = screen.getByRole('button', { name: 'Files' });
    await user.click(filesBtn);

    expect(filesBtn.className).toContain('border-[var(--color-primary)]');
    const contractsBtn = screen.getByRole('button', { name: 'Contracts' });
    expect(contractsBtn.className).not.toContain('border-[var(--color-primary)]');
  });

  it('subscribes to the workspace realtime channel instead of polling', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace();
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(subscribeToWorkspace).toHaveBeenCalledWith(22, expect.any(Object)));
  });

  it('no longer polls the workspace on an interval — a WorkspaceStatusChanged push refetches it instead', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockClient({ workspace: { id: 22 } });
    mockWorkspace();
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/workspaces/22').length).toBe(1));

    // No refetchInterval left on useWorkspace — advancing past the old 10s
    // cadence must NOT fire another request on its own.
    await vi.advanceTimersByTimeAsync(10000);
    expect(mock.history.get.filter((r) => r.url === '/workspaces/22').length).toBe(1);

    // The realtime push is what refetches it now.
    const { onWorkspaceStatusChanged } = vi.mocked(subscribeToWorkspace).mock.calls[0][1];
    onWorkspaceStatusChanged!({ status: 'active' });
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/workspaces/22').length).toBe(2));

    vi.useRealTimers();
  });
});
