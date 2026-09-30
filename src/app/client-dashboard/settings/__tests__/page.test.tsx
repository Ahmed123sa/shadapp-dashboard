import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientSettingsPage from '../page';
import api from '@/lib/api';

// subuser-review-plan.md م٤ — this page used to be entirely unaware that a
// sub-user could reach it: it always read/wrote the *client's* record. It now
// branches on isSubUser()/getSubUser() (read from localStorage, same as the
// real app) to load/save the sub-user's own `/sub-users/{id}` record instead,
// with email locked and a note to contact the account owner.

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
  localStorage.clear();
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
  localStorage.clear();
});

function setPrimaryClientSession() {
  localStorage.setItem('client', JSON.stringify({
    id: 7, company_name: 'Acme Corp', contact_person: 'Jane', email: 'jane@acme.com', status: 'active', has_signed: true,
  }));
}

function setSubUserSession() {
  localStorage.setItem('client', JSON.stringify({
    id: 7, company_name: 'Acme Corp', contact_person: 'Jane', email: 'jane@acme.com', status: 'active', has_signed: true, is_sub_user: true,
  }));
  localStorage.setItem('sub_user', JSON.stringify({
    id: 5, name: 'Employee One', email: 'employee@acme.com', permissions: {},
  }));
}

describe('ClientSettingsPage — sub-user branch (م٤ characterization)', () => {
  it('loads the sub-user\'s own record, shows an editable phone field, and locks the email with a note', async () => {
    setSubUserSession();
    mock.onGet('/sub-users/5').reply(200, {
      sub_user: { id: 5, name: 'Employee One', email: 'employee@acme.com', phone: '0100000000', date_of_birth: '1995-05-01' },
    });
    renderWithIntl(<ClientSettingsPage />);

    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/sub-users/5')).toBe(true));
    const emailInput = await screen.findByDisplayValue('employee@acme.com') as HTMLInputElement;
    expect(emailInput).toBeDisabled();
    expect(screen.getByText('To change your email or password, contact the account owner')).toBeInTheDocument();

    const phoneInput = screen.getByLabelText('Phone') as HTMLInputElement;
    expect(phoneInput).not.toBeDisabled();
    expect(phoneInput.value).toBe('0100000000');
  });

  it('saves the sub-user\'s profile (name/phone/dob) to /sub-users/{id}/profile without touching email', async () => {
    setSubUserSession();
    mock.onGet('/sub-users/5').reply(200, {
      sub_user: { id: 5, name: 'Employee One', email: 'employee@acme.com', phone: '0100000000' },
    });
    mock.onPost('/sub-users/5/profile').reply(200, { sub_user: { id: 5, name: 'Employee Updated' } });

    const user = userEvent.setup();
    renderWithIntl(<ClientSettingsPage />);

    const phoneInput = await screen.findByLabelText('Phone') as HTMLInputElement;
    await user.clear(phoneInput);
    await user.type(phoneInput, '0111111111');
    await user.click(screen.getByText('Save Settings'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/sub-users/5/profile');
      expect(call).toBeTruthy();
      const form = call!.data as FormData;
      expect(form.get('phone')).toBe('0111111111');
      expect(form.has('email')).toBe(false);
    });
  });

  it('does not show a phone field for a primary client and loads /clients/{id} instead', async () => {
    setPrimaryClientSession();
    mock.onGet('/clients/7').reply(200, {
      client: { id: 7, contact_person: 'Jane', email: 'jane@acme.com' },
    });
    renderWithIntl(<ClientSettingsPage />);

    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/clients/7')).toBe(true));
    expect(screen.queryByLabelText('Phone')).not.toBeInTheDocument();
    expect(screen.queryByText('To change your email or password, contact the account owner')).not.toBeInTheDocument();
  });
});
