import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientSettingsPage from '../page';
import api from '@/lib/api';

// Characterization suite written BEFORE migrating ClientSettingsPage off
// manual useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md
// Round 3, Clients slice). Pins down current API calls + rendered/updated
// state so the migration can be checked against this file instead of
// assumptions.
//
// The important behavior to preserve here: the client is fetched ONCE on
// mount and copied into local `form` state — it must NOT be re-synced
// reactively from a later background refetch (that would clobber in-progress
// edits), unlike the "always-live-derived" pattern used elsewhere.

const routerBack = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '5' }),
  useRouter: () => ({ back: routerBack }),
}));

let mock: MockAdapter;

const baseClient = {
  id: 5,
  company_name: 'Acme Corp',
  contact_person: 'John Doe',
  email: 'john@acme.com',
  phone: '0501234567',
  country: 'Egypt',
  industry: 'Tech',
  notes: 'VIP client',
  date_of_birth: '1990-05-01',
  client_type: 'business',
  address: '',
  maps_url: '',
  avatar_url: null,
};

function mockClient(overrides?: Record<string, unknown>) {
  mock.onGet('/clients/5').reply(200, { client: { ...baseClient, ...overrides } });
}

beforeEach(() => {
  mock = new MockAdapter(api);
  routerBack.mockClear();
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientSettingsPage (characterization)', () => {
  it('loads the client once on mount and seeds the form', async () => {
    mockClient();
    renderWithIntl(<ClientSettingsPage />);

    await waitFor(() => expect(screen.getByText('Edit: Acme Corp')).toBeInTheDocument());
    expect((screen.getByLabelText('Company Name') as HTMLInputElement).value).toBe('Acme Corp');
    expect((screen.getByLabelText('Contact Person') as HTMLInputElement).value).toBe('John Doe');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('john@acme.com');
    expect((screen.getByLabelText('Phone') as HTMLInputElement).value).toBe('0501234567');
    expect((screen.getByLabelText('Date of Birth') as HTMLInputElement).value).toBe('1990-05-01');
    expect(mock.history.get.filter((r) => r.url === '/clients/5').length).toBe(1);
  });

  it('shows the not-found state when the client fails to load', async () => {
    mock.onGet('/clients/5').reply(500);
    renderWithIntl(<ClientSettingsPage />);

    await waitFor(() => expect(screen.getByText('Client not found')).toBeInTheDocument());
  });

  it('goes back when the back link is clicked', async () => {
    mockClient();
    const user = userEvent.setup();
    renderWithIntl(<ClientSettingsPage />);

    await waitFor(() => expect(screen.getByText('Edit: Acme Corp')).toBeInTheDocument());
    await user.click(screen.getByText('Back', { exact: false }));
    expect(routerBack).toHaveBeenCalled();
  });

  it('saves the edited fields without a password key when the password is left blank', async () => {
    mockClient();
    mock.onPut('/clients/5').reply(200, {});
    const user = userEvent.setup();
    renderWithIntl(<ClientSettingsPage />);

    await waitFor(() => expect(screen.getByText('Edit: Acme Corp')).toBeInTheDocument());
    const companyInput = screen.getByLabelText('Company Name');
    await user.clear(companyInput);
    await user.type(companyInput, 'Acme Corp International');

    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      const call = mock.history.put.find((r) => r.url === '/clients/5');
      expect(call).toBeTruthy();
      const payload = JSON.parse(call!.data as string);
      expect(payload.company_name).toBe('Acme Corp International');
      expect(payload.contact_person).toBe('John Doe');
      expect('password' in payload).toBe(false);
    });
    await waitFor(() => expect(screen.getByText('Changes saved successfully')).toBeInTheDocument());
  });

  it('includes the password in the payload when one is entered', async () => {
    mockClient();
    mock.onPut('/clients/5').reply(200, {});
    const user = userEvent.setup();
    renderWithIntl(<ClientSettingsPage />);

    await waitFor(() => expect(screen.getByText('Edit: Acme Corp')).toBeInTheDocument());
    await user.type(screen.getByLabelText('Change Password'), 'NewPassw0rd');
    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      const call = mock.history.put.find((r) => r.url === '/clients/5');
      const payload = JSON.parse(call!.data as string);
      expect(payload.password).toBe('NewPassw0rd');
    });
  });

  it('uploads the avatar before saving when a new photo is picked', async () => {
    (URL as unknown as { createObjectURL: (f: File) => string }).createObjectURL = vi.fn(() => 'blob:mock');
    mockClient();
    mock.onPost('/clients/5/profile').reply(200, {});
    mock.onPut('/clients/5').reply(200, {});
    const user = userEvent.setup();
    renderWithIntl(<ClientSettingsPage />);

    await waitFor(() => expect(screen.getByText('Edit: Acme Corp')).toBeInTheDocument());
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const avatarFile = new File(['fake-image'], 'avatar.png', { type: 'image/png' });
    await user.upload(fileInput, avatarFile);

    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === '/clients/5/profile')).toBe(true));
    await waitFor(() => expect(mock.history.put.some((r) => r.url === '/clients/5')).toBe(true));
    const profileCall = mock.history.post.find((r) => r.url === '/clients/5/profile');
    const fd = profileCall!.data as FormData;
    expect(fd.get('avatar')).toBeInstanceOf(File);
    expect(fd.get('contact_person')).toBe('John Doe');

    delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
  });

  it('shows the server error message when saving fails', async () => {
    mockClient();
    mock.onPut('/clients/5').reply(422, { message: 'Email already taken' });
    const user = userEvent.setup();
    renderWithIntl(<ClientSettingsPage />);

    await waitFor(() => expect(screen.getByText('Edit: Acme Corp')).toBeInTheDocument());
    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Email already taken')).toBeInTheDocument());
  });

  it('falls back to a generic error message when the server gives none', async () => {
    mockClient();
    mock.onPut('/clients/5').reply(500);
    const user = userEvent.setup();
    renderWithIntl(<ClientSettingsPage />);

    await waitFor(() => expect(screen.getByText('Edit: Acme Corp')).toBeInTheDocument());
    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Failed to save changes')).toBeInTheDocument());
  });

  it('switches the client type and includes it in the saved payload', async () => {
    mockClient();
    mock.onPut('/clients/5').reply(200, {});
    const user = userEvent.setup();
    renderWithIntl(<ClientSettingsPage />);

    await waitFor(() => expect(screen.getByText('Edit: Acme Corp')).toBeInTheDocument());
    // The "Individual" button renders the word twice (the translated label
    // span plus a hardcoded English sub-label span), so getByText would be
    // ambiguous — grab either match and click its enclosing button instead.
    const individualBtn = screen.getAllByText('Individual')[0].closest('button')!;
    await user.click(individualBtn);
    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      const call = mock.history.put.find((r) => r.url === '/clients/5');
      const payload = JSON.parse(call!.data as string);
      expect(payload.client_type).toBe('individual');
    });
  });
});
