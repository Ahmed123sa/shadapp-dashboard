import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientProfileTab from '../ClientProfileTab';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// Characterization suite written BEFORE migrating ClientProfileTab off manual
// useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md Round 3,
// Clients slice). Pins down current API calls + rendered/updated state so
// the migration can be checked against this file instead of assumptions.

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

// LocationPickerModal has its own dedicated characterization suite
// (src/components/clients/__tests__/LocationPickerModal.test.tsx) covering
// the map/search/address logic. Here it's swapped for a trivial stand-in
// that exposes a button to simulate the manager confirming a point, which is
// all ClientProfileTab's own logic (the POST + reload-on-success) cares about.
vi.mock('../LocationPickerModal', () => ({
  default: ({ onConfirm }: { onConfirm: (lat: number, lng: number, address: string) => void }) => (
    <div>
      <p>location picker open</p>
      <button onClick={() => onConfirm(30.111111, 31.222222, 'Some address')}>confirm location</button>
    </div>
  ),
}));

let mock: MockAdapter;

const baseProfile = {
  client: {
    id: 5,
    company_name: 'Acme Corp',
    contact_person: 'John Doe',
    email: 'john@acme.com',
    phone: '0501234567',
    country: 'Egypt',
    industry: 'Tech',
    client_type: 'business',
    avatar_url: null,
    address: '',
  },
  stats: {
    total_contracts: 10, draft_contracts: 2, sent_contracts: 3, completed_contracts: 5,
    meetings_count: 4, approvals_count: 1,
    total_contract_value: 50000, total_paid: 30000, pending_payments: 20000,
  },
  location: null as unknown,
};

function mockProfile(overrides?: Record<string, unknown>) {
  mock.onGet('/clients/5/profile').reply(200, { ...baseProfile, ...overrides });
}

function mockActivity(activity: unknown[] = []) {
  mock.onGet('/clients/5/activity').reply(200, { activity });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientProfileTab (characterization)', () => {
  it('loads the profile and activity on mount and renders the client card + stats', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockProfile();
    mockActivity();
    renderWithIntl(<ClientProfileTab clientId={5} />);

    // "Acme Corp" appears twice (the header <h3> and the Contact Info
    // "Company" row), so scope to the header specifically.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument());
    expect(screen.getByText('John Doe • john@acme.com', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument(); // total_contracts
    expect(screen.getByText('5')).toBeInTheDocument(); // completed_contracts
    expect(screen.getByText('50,000')).toBeInTheDocument(); // total_contract_value
    expect(screen.getByText('30,000')).toBeInTheDocument(); // total_paid
    expect(mock.history.get.some((r) => r.url === '/clients/5/profile')).toBe(true);
    expect(mock.history.get.some((r) => r.url === '/clients/5/activity')).toBe(true);
  });

  it('shows the not-found state when the profile fails to load', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mock.onGet('/clients/5/profile').reply(500);
    mockActivity();
    renderWithIntl(<ClientProfileTab clientId={5} />);

    await waitFor(() => expect(screen.getByText('Client not found')).toBeInTheDocument());
  });

  it('shows the empty activity state when there is no activity', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockProfile();
    mockActivity([]);
    renderWithIntl(<ClientProfileTab clientId={5} />);

    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
  });

  it('renders activity items and navigates to the mapped tab when one is clicked', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockProfile();
    mockActivity([
      { id: '1', kind: 'contract_created', timestamp: '2026-01-01T10:00:00Z', ref_type: 'contract', ref_id: 9, title: 'New Contract' },
    ]);
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<ClientProfileTab clientId={5} onNavigate={onNavigate} />);

    await waitFor(() => expect(screen.getByText('Contract created')).toBeInTheDocument());
    await user.click(screen.getByText('Contract created'));
    expect(onNavigate).toHaveBeenCalledWith('contracts');
  });

  it('hides the edit link and check-in button for a super admin', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 2, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
    mockProfile();
    mockActivity();
    renderWithIntl(<ClientProfileTab clientId={5} />);

    // "Acme Corp" appears twice (the header <h3> and the Contact Info
    // "Company" row), so scope to the header specifically.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument());
    expect(screen.queryByText('Edit Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Set location on map')).not.toBeInTheDocument();
  });

  it('shows the edit link and check-in button for an account manager', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockProfile();
    mockActivity();
    renderWithIntl(<ClientProfileTab clientId={5} />);

    // "Acme Corp" appears twice (the header <h3> and the Contact Info
    // "Company" row), so scope to the header specifically.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument());
    expect(screen.getByText('Edit Profile').closest('a')).toHaveAttribute('href', '/dashboard/clients/5/settings');
    expect(screen.getByText('Set location on map')).toBeInTheDocument();
  });

  it('checks in a location: posts it, shows a success message, closes the picker, and reloads the profile', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockProfile();
    mockActivity();
    mock.onPost('/clients/5/location').reply(200, {});
    const user = userEvent.setup();
    renderWithIntl(<ClientProfileTab clientId={5} />);

    // "Acme Corp" appears twice (the header <h3> and the Contact Info
    // "Company" row), so scope to the header specifically.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument());
    await user.click(screen.getByText('Set location on map'));
    expect(screen.getByText('location picker open')).toBeInTheDocument();

    await user.click(screen.getByText('confirm location'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/clients/5/location');
      expect(call).toBeTruthy();
      const payload = JSON.parse(call!.data as string);
      expect(payload).toEqual({ latitude: 30.111111, longitude: 31.222222, address: 'Some address' });
    });
    await waitFor(() => expect(screen.getByText('Location updated successfully')).toBeInTheDocument());
    expect(screen.queryByText('location picker open')).not.toBeInTheDocument();
    // load() runs again on success -> a second GET to /clients/5/profile.
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/clients/5/profile').length).toBe(2));
  });

  it('shows a failure message and keeps the picker open when the check-in fails', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockProfile();
    mockActivity();
    mock.onPost('/clients/5/location').reply(500);
    const user = userEvent.setup();
    renderWithIntl(<ClientProfileTab clientId={5} />);

    // "Acme Corp" appears twice (the header <h3> and the Contact Info
    // "Company" row), so scope to the header specifically.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument());
    await user.click(screen.getByText('Set location on map'));
    await user.click(screen.getByText('confirm location'));

    await waitFor(() => expect(screen.getByText("Couldn't save the location. Try again.")).toBeInTheDocument());
    expect(screen.getByText('location picker open')).toBeInTheDocument();
    expect(mock.history.get.filter((r) => r.url === '/clients/5/profile').length).toBe(1);
  });
});
