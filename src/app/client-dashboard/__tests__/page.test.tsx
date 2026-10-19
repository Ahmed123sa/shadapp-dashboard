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
// test suite. subscribeToNotifications/disconnectEcho are mocked too now
// that this page mounts <NotificationBell /> (ن9) in its header, which
// calls both on mount/unmount.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToWorkspace: vi.fn(),
  subscribeToNotifications: vi.fn(() => vi.fn()),
  disconnectEcho: vi.fn(),
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
      status: 'active',
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
  // jsdom has no canvas; the signature pad just skips painting when null.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
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

  // Until the workspace is active the client is in onboarding (mobile rule:
  // see lib/client-onboarding.ts); the workspace tabs only open afterwards.
  it('stage 0: an unsigned client is asked to add a signature', async () => {
    mockClient({ signed_at: null });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText('Add your signature')).toBeInTheDocument());
    expect(screen.getByText('Welcome, Acme Corp')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Contracts' })).not.toBeInTheDocument();
  });

  it('stage 1: signed but no workspace yet shows the waiting-for-contract card', async () => {
    mockClient({ signed_at: '2026-01-01T00:00:00Z', workspace: null });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText('Your contract is being prepared')).toBeInTheDocument());
  });

  it('stage 1: an inactive workspace with nothing sent also waits for the contract', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace({ status: 'inactive' });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText('Your contract is being prepared')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Contracts' })).not.toBeInTheDocument();
  });

  it('stage 2: a sent contract opens the review screen', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace({ status: 'inactive', contracts: [{ id: 1, status: 'sent' }] });
    mock.onGet('/workspaces/22/contracts').reply(200, {
      contracts: [{ id: 1, title: 'Menu & identity', status: 'sent', value: '14500', currency: 'EGP', clauses: [], required_documents: [] }],
    });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText('Review your contract')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Menu & identity')).toBeInTheDocument());
  });

  it('stage 3: a client-approved contract waits for the company', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace({ status: 'inactive', contracts: [{ id: 1, status: 'client_approved' }] });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText('Waiting for company approval')).toBeInTheDocument());
  });

  it('stage 4: a company-approved contract opens the payment screen', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace({ status: 'inactive', contracts: [{ id: 1, status: 'company_approved' }] });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText('Complete your first payment')).toBeInTheDocument());
  });

  it('stage 5: a submitted payment shows the payment-review card', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace({ status: 'inactive', contracts: [{ id: 1, status: 'company_approved' }], payments: [{ id: 5, status: 'pending', amount: '16530', currency: 'EGP', method_type: 'instapay' }] });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText('We’re reviewing your payment')).toBeInTheDocument());
  });

  it('stage 6: an edit request shows the quote of what was asked', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace({ status: 'inactive', contracts: [{ id: 1, status: 'edit_requested', edit_reason: 'Two instalments please' }] });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText('Edit requested')).toBeInTheDocument());
    expect(screen.getByText('Two instalments please')).toBeInTheDocument();
  });

  it('loads the workspace and renders stats + tabs once the workspace is active', async () => {
    mockClient({ workspace: { id: 22 } });
    mockWorkspace({ status: 'active', contracts: [{ id: 1, status: 'sent' }], payments: [] });
    mockFallback();
    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/workspaces/22')).toBe(true));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Contracts' })).toBeInTheDocument());
    // Contracts stat card reflects the loaded workspace.contracts length.
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Add your signature')).not.toBeInTheDocument();
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

  // SUBUSER_PLAN.md §5.3 — the tab list used to trust whatever permissions
  // were cached in localStorage at login (`hasSubUserPermission`), which
  // meant a permission the client granted mid-session stayed hidden until
  // the sub-user logged out and back in. The page now refetches
  // GET /sub-users/{id} on load and filters tabs from that instead.
  it('refreshes a sub-users tab visibility from the server instead of the stale cached permissions', async () => {
    vi.mocked(clientAuth.isSubUser).mockReturnValue(true);
    vi.mocked(clientAuth.getSubUser).mockReturnValue({
      id: 5,
      name: 'Employee',
      email: 'employee@acme.com',
      permissions: { can_view_contracts: true }, // stale cache: no can_view_payments yet
    } as any);
    // Stand in for the real (unmocked) hasSubUserPermission so the fallback
    // path used before the server response arrives reflects the stale cache.
    vi.mocked(clientAuth.hasSubUserPermission).mockImplementation((key: string) => key === 'can_view_contracts');
    mock.onGet('/sub-users/5').reply(200, {
      sub_user: { id: 5, name: 'Employee', permissions: { can_view_contracts: true, can_view_payments: true } },
    });
    mockClient({ workspace: { id: 22 } });
    mockWorkspace();
    mockFallback();

    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Contracts' })).toBeInTheDocument());
    // Server just granted can_view_payments — the tab must show up without
    // requiring a fresh login.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Payments' })).toBeInTheDocument());
    expect(mock.history.get.some((r) => r.url === '/sub-users/5')).toBe(true);
  });

  it('hides the Users (colleagues) tab for a sub-user even though it has no permission gate', async () => {
    vi.mocked(clientAuth.isSubUser).mockReturnValue(true);
    vi.mocked(clientAuth.getSubUser).mockReturnValue({
      id: 5,
      name: 'Employee',
      email: 'employee@acme.com',
      permissions: {},
    } as any);
    mock.onGet('/sub-users/5').reply(200, { sub_user: { id: 5, name: 'Employee', permissions: {} } });
    mockClient({ workspace: { id: 22 } });
    mockWorkspace();
    mockFallback();

    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText(/Employee/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Users' })).not.toBeInTheDocument();
  });

  // subuser-review-plan.md م٥ — the client's e-signature is theirs alone
  // (م٣ on the backend); a sub-user must not see the Signature tab, or the
  // primary-client-only pre-signature form, at all.
  it('hides the Signature tab for a sub-user even though it has no permission gate', async () => {
    vi.mocked(clientAuth.isSubUser).mockReturnValue(true);
    vi.mocked(clientAuth.getSubUser).mockReturnValue({
      id: 5, name: 'Employee', email: 'employee@acme.com', permissions: {},
    } as any);
    mock.onGet('/sub-users/5').reply(200, { sub_user: { id: 5, name: 'Employee', permissions: {} } });
    mockClient({ workspace: { id: 22 } });
    mockWorkspace();
    mockFallback();

    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText(/Employee/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Signature' })).not.toBeInTheDocument();
  });

  it('shows a simple waiting card (no signature form, no stages) for a sub-user before the workspace is active', async () => {
    vi.mocked(clientAuth.isSubUser).mockReturnValue(true);
    vi.mocked(clientAuth.getSubUser).mockReturnValue({
      id: 5, name: 'Employee', email: 'employee@acme.com', permissions: {},
    } as any);
    mockClient({ signed_at: null });
    mockFallback();

    renderWithIntl(<ClientDashboardPage />);

    await waitFor(() => expect(screen.getByText('Your workspace is being prepared')).toBeInTheDocument());
    expect(screen.queryByText('Add your signature')).not.toBeInTheDocument();
    expect(screen.queryByText('Step 1 of 6')).not.toBeInTheDocument();
  });
});
