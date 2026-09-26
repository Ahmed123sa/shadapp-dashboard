import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientWorkspace from '../page';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// Characterization suite written BEFORE migrating ClientWorkspace off manual
// useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md Round 3,
// Clients slice). Pins down current API calls + rendered/updated state so
// the migration can be checked against this file instead of assumptions.
//
// This page hosts 8 tab components (chat/files/contracts/payments/approvals/
// meetings/calendar/profile), each fetching its own data independently. This
// suite only characterizes ClientWorkspace's own behavior (load, tab switch,
// delete) — a permissive catch-all mock is registered last in every test so
// whichever tab happens to be mounted doesn't error out or need its own
// fixture here (those components have their own characterization suites).

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

let searchParams = new URLSearchParams();
const routerReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '5' }),
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: routerReplace }),
}));

let mock: MockAdapter;

const baseClient = {
  id: 5,
  company_name: 'Acme Corp',
  contact_person: 'John Doe',
  email: 'john@acme.com',
  client_type: 'business',
  country: 'Egypt',
  industry: 'Tech',
  avatar_url: null,
  signed_at: null,
  workspace: { id: 22, status: 'active' },
};

function mockClient(overrides?: Record<string, unknown>) {
  mock.onGet('/clients/5').reply(200, { client: { ...baseClient, ...overrides } });
}

// Registered last in every test (axios-mock-adapter checks handlers in
// registration order) so any GET/POST from whichever tab happens to be
// mounted (chat polling, contracts, etc.) resolves harmlessly instead of
// erroring or leaving an unhandled rejection.
function mockFallback() {
  mock.onAny().reply(200, {});
}

beforeEach(() => {
  mock = new MockAdapter(api);
  searchParams = new URLSearchParams();
  routerReplace.mockClear();
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientWorkspace (characterization)', () => {
  it('loads the client on mount and renders the header', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockClient();
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.getByText('John Doe • john@acme.com • Egypt • Tech', { exact: false })).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/clients/5')).toBe(true);
  });

  it('redirects the URL to the client uuid once the client loads', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockClient({ uuid: '8f3a2b1c-0000-4000-8000-000000000009' });
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/dashboard/clients/8f3a2b1c-0000-4000-8000-000000000009'));
  });

  it('preserves the ?tab= query param when redirecting to the client uuid', async () => {
    searchParams = new URLSearchParams('tab=meetings');
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockClient({ uuid: '8f3a2b1c-0000-4000-8000-000000000009' });
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/dashboard/clients/8f3a2b1c-0000-4000-8000-000000000009?tab=meetings'));
  });

  it('does not redirect when the client has no uuid (older/partial data)', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockClient();
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('shows the not-found state when the client fails to load', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mock.onGet('/clients/5').reply(500);
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Client not found')).toBeInTheDocument());
  });

  it('shows the no-workspace state when the client has no workspace', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockClient({ workspace: null });
    // NoWorkspace auto-POSTs /workspaces on mount; fail it so it settles into
    // its own error state instead of calling window.location.reload(), which
    // jsdom doesn't implement.
    mock.onPost('/workspaces').reply(500);
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('No workspace for this client')).toBeInTheDocument());
  });

  it('syncs the active tab from the ?tab= query param on mount', async () => {
    searchParams = new URLSearchParams('tab=meetings');
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockClient();
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    const meetingsBtn = screen.getByRole('button', { name: 'Meetings' });
    expect(meetingsBtn.className).toContain('border-[var(--color-primary)]');
    const chatBtn = screen.getByRole('button', { name: 'Chat' });
    expect(chatBtn.className).not.toContain('border-[var(--color-primary)]');
  });

  it('switches tabs when a tab button is clicked (defaults to chat)', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockClient();
    mockFallback();
    const user = userEvent.setup();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    const chatBtn = screen.getByRole('button', { name: 'Chat' });
    expect(chatBtn.className).toContain('border-[var(--color-primary)]');

    const filesBtn = screen.getByRole('button', { name: 'Files' });
    await user.click(filesBtn);

    expect(filesBtn.className).toContain('border-[var(--color-primary)]');
    expect(chatBtn.className).not.toContain('border-[var(--color-primary)]');
  });

  it('hides the settings link for a super admin, and never renders a delete control for anyone', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 2, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
    mockClient();
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.queryByTitle('Settings')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

  // Client deletion was removed from the dashboard entirely (DATA_SAFETY_PLAN.md
  // §2.1 — clients are never hard-deleted, only archived per §2.3). The three
  // characterization tests that used to live here ("shows settings/delete
  // controls...", "deletes the client after confirming...", "shows an error
  // and closes the dialog...") pinned down a Delete button/ConfirmDialog flow
  // that no longer exists in ClientWorkspace and were removed along with it
  // rather than left failing against a feature that's intentionally gone.
  it('shows the settings link for a non-super-admin, with no delete control next to it', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockClient();
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.getByTitle('Settings').closest('a')).toHaveAttribute('href', '/dashboard/clients/5/settings');
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

  // client-signature-plan.md ن1 — the badge used to read signed_at (a saved
  // profile signature), so a paid, active client with no profile signature
  // showed as "Not Signed". It now reads has_signed_contract (falling back
  // to an active workspace, then to signed_at for an older server response
  // that doesn't send the flag) — see lib/utils.ts's clientHasSignedContract.
  describe('the contracted badge', () => {
    it('shows Contracted for an active workspace, even with no saved signature', async () => {
      vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
      mockClient({ signed_at: null, has_signed_contract: false, workspace: { id: 22, status: 'active' } });
      mockFallback();
      renderWithIntl(<ClientWorkspace />);

      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
      expect(screen.getByText('Contracted')).toBeInTheDocument();
      expect(screen.queryByText('Not Contracted')).not.toBeInTheDocument();
    });

    it('shows Contracted for an inactive workspace when has_signed_contract is true', async () => {
      vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
      mockClient({ signed_at: null, has_signed_contract: true, workspace: { id: 22, status: 'inactive' } });
      mockFallback();
      renderWithIntl(<ClientWorkspace />);

      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
      expect(screen.getByText('Contracted')).toBeInTheDocument();
    });

    it('shows Not Contracted for an inactive workspace with no approved contract and no saved signature', async () => {
      vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
      mockClient({ signed_at: null, has_signed_contract: false, workspace: { id: 22, status: 'inactive' } });
      mockFallback();
      renderWithIntl(<ClientWorkspace />);

      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
      expect(screen.getByText('Not Contracted')).toBeInTheDocument();
    });
  });
});
