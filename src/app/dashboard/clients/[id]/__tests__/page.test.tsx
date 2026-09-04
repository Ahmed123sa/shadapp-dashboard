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
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '5' }),
  useSearchParams: () => searchParams,
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
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientWorkspace (characterization)', () => {
  it('loads the client on mount and renders the header', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockClient();
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.getByText('John Doe • john@acme.com • Egypt • Tech', { exact: false })).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/clients/5')).toBe(true);
  });

  it('shows the not-found state when the client fails to load', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mock.onGet('/clients/5').reply(500);
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Client not found')).toBeInTheDocument());
  });

  it('shows the no-workspace state when the client has no workspace', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
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
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
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
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
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

  it('hides the settings link and delete button for a super admin', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 2, name: 'SA', role: 'super_admin' });
    mockClient();
    mockFallback();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.queryByTitle('Settings')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

  it('shows settings/delete controls for a non-super-admin and opens the confirm dialog', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockClient();
    mockFallback();
    const user = userEvent.setup();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.getByTitle('Settings').closest('a')).toHaveAttribute('href', '/dashboard/clients/5/settings');

    await user.click(screen.getByTitle('Delete'));
    expect(screen.getByText('Delete Client')).toBeInTheDocument();
    expect(screen.getByText('Delete client permanently? This action cannot be undone.')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete Client')).not.toBeInTheDocument();
    expect(mock.history.delete.length).toBe(0);
  });

  it('deletes the client after confirming and redirects to the clients list', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockClient();
    mock.onDelete('/clients/5').reply(200, { success: true });
    mockFallback();

    delete (window as any).location;
    (window as any).location = { href: '' };

    const user = userEvent.setup();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    await user.click(screen.getByTitle('Delete'));
    // The icon-only trigger button has title="Delete" but no text content
    // (just an SVG), so getByText only matches the ConfirmDialog's own
    // confirm button, not the trigger.
    await user.click(screen.getByText('Delete'));

    await waitFor(() => expect(mock.history.delete.some((r) => r.url === '/clients/5')).toBe(true));
    await waitFor(() => expect(window.location.href).toBe('/dashboard/clients'));
  });

  it('shows an error and closes the dialog without redirecting when delete fails', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockClient();
    mock.onDelete('/clients/5').reply(500);
    mockFallback();

    const user = userEvent.setup();
    renderWithIntl(<ClientWorkspace />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    await user.click(screen.getByTitle('Delete'));
    await user.click(screen.getByText('Delete'));

    await waitFor(() => expect(screen.getByText('Failed to delete client. Please try again.')).toBeInTheDocument());
    expect(screen.queryByText('Delete Client')).not.toBeInTheDocument();
  });
});
