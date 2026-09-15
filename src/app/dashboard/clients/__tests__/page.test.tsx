import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientsPage from '../page';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// Characterization suite written BEFORE migrating ClientsPage off manual
// useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md Round 3,
// Clients slice). Pins down current API calls + rendered/updated state so
// the migration can be checked against this file instead of assumptions.

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

let mock: MockAdapter;

const clientA = {
  id: 1,
  company_name: 'Acme Corp',
  contact_person: 'John Doe',
  email: 'john@acme.com',
  status: 'active',
  contract_value: '1000',
  payment_status: 'paid',
  signed_at: null,
  client_type: 'business',
  workspace: { id: 11, status: 'active' },
  updated_at: '2026-01-01',
};

const clientB = {
  id: 2,
  company_name: 'Beta LLC',
  contact_person: 'Jane Roe',
  email: 'jane@beta.com',
  status: 'inactive',
  contract_value: '500',
  payment_status: 'pending',
  signed_at: null,
  client_type: 'individual',
  workspace: null,
  updated_at: '2026-01-02',
};

function mockList(overrides?: { clients?: unknown[]; last_page?: number }) {
  mock.onGet(/\/clients(\?.*)?$/).reply(200, {
    clients: { data: overrides?.clients ?? [clientA, clientB], last_page: overrides?.last_page ?? 1 },
  });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientsPage (characterization)', () => {
  it('loads clients on mount', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockList();
    renderWithIntl(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.getByText('Beta LLC')).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/clients?page=1&per_page=30')).toBe(true);
  });

  it('debounces search input and refetches with the query', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockList();
    const user = userEvent.setup();
    renderWithIntl(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    mockList({ clients: [clientA] });

    const search = screen.getByPlaceholderText('Search by name, email, or phone...');
    await user.type(search, 'acme');

    await waitFor(
      () => expect(mock.history.get.some((r) => r.url === '/clients?page=1&per_page=30&q=acme')).toBe(true),
      { timeout: 2000 }
    );
  });

  it('paginates without carrying the search query along (existing behavior)', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockList({ last_page: 2 });
    const user = userEvent.setup();
    renderWithIntl(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByText('Next'));

    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/clients?page=2&per_page=30')).toBe(true));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('shows the create button for a non-super-admin and hides it for a super admin', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockList();
    const { unmount } = renderWithIntl(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.getByText('+ New Client')).toBeInTheDocument();
    unmount();

    vi.mocked(getUser).mockReturnValue({ id: 2, name: 'SA', role: 'super_admin' });
    mockList();
    renderWithIntl(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.queryByText('+ New Client')).not.toBeInTheDocument();
  });

  it('creates a new client with an auto-generated password, uploads the avatar, and prepends it to the list', async () => {
    // jsdom doesn't implement createObjectURL; the component calls it
    // synchronously when a file is picked, so it needs a stub to not throw.
    (URL as unknown as { createObjectURL: (f: File) => string }).createObjectURL = vi.fn(() => 'blob:mock');
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockList({ clients: [clientA] });
    const newClient = { ...clientB, id: 3, company_name: 'Gamma Inc' };
    mock.onPost('/clients').reply(200, {
      client: newClient,
      credentials: { email: 'gamma@example.com', password: 'Xy9!aBcD' },
    });
    mock.onPost('/clients/3/profile').reply(200, {});

    const user = userEvent.setup();
    renderWithIntl(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    await user.click(screen.getByText('+ New Client'));
    await waitFor(() => expect(screen.getByText('Create Client')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Official company name'), 'Gamma Inc');
    await user.type(screen.getByPlaceholderText('Account responsible name'), 'Gamma Contact');
    await user.type(screen.getByPlaceholderText('email@example.com'), 'gamma@example.com');
    await user.type(screen.getByPlaceholderText('05xxxxxxxx'), '0501234567');

    const avatarInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const avatarFile = new File(['fake-image'], 'avatar.png', { type: 'image/png' });
    await user.upload(avatarInput, avatarFile);

    await user.click(screen.getByText('Create Client'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/clients');
      expect(call).toBeTruthy();
      const payload = JSON.parse(call!.data as string);
      expect(payload.company_name).toBe('Gamma Inc');
      expect(payload.contact_person).toBe('Gamma Contact');
      expect(payload.email).toBe('gamma@example.com');
      expect(payload.phone).toBe('0501234567');
      // autoPassword is on by default -> the `password` key is stripped
      // entirely from the payload, not sent as an empty string.
      expect('password' in payload).toBe(false);
    });

    await waitFor(() => expect(mock.history.post.some((r) => r.url === '/clients/3/profile')).toBe(true));
    await waitFor(() => expect(screen.getByText('Client created successfully')).toBeInTheDocument());
    expect(screen.getByText('gamma@example.com', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Gamma Inc')).toBeInTheDocument();

    delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
  });

  // Client deletion was removed from the dashboard entirely (DATA_SAFETY_PLAN.md
  // §2.1 — clients are never hard-deleted, only archived per §2.3). The two
  // characterization tests that used to live here ("deletes a client after
  // confirming...", "does not delete when the confirm() dialog is
  // dismissed") pinned down a Delete button/confirm() flow that no longer
  // exists in ClientsPage and were removed along with it rather than left
  // failing against a feature that's intentionally gone.
  it('does not render a delete control anywhere in the clients table', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockList();
    renderWithIntl(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });
});
