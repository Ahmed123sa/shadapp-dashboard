import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientSubUsers from '../ClientSubUsers';
import api from '@/lib/api';

// subuser-review-plan.md م٤ — sub-users can no longer change their own
// password (backend), so the owning client needs a "set password" flow here
// instead. This pins down that new UI: the button, the inline form, the
// PATCH call, and the success message.

let mock: MockAdapter;

const subUser = {
  id: 5, name: 'Employee One', email: 'employee@acme.com', permissions: { can_view_contracts: true },
};

function mockLoad(overrides?: { subUsers?: unknown[] }) {
  mock.onGet('/clients/7/sub-users').reply(200, { sub_users: overrides?.subUsers ?? [subUser] });
  mock.onGet('/sub-user-permissions').reply(200, { permissions: ['can_view_contracts', 'can_approve_contracts'] });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientSubUsers — password-set flow (م٤ characterization)', () => {
  it('opens an inline password form and PATCHes the new password', async () => {
    mockLoad();
    mock.onPatch('/sub-users/5/password').reply(200, {});

    const user = userEvent.setup();
    renderWithIntl(<ClientSubUsers clientId={7} />);

    await waitFor(() => expect(screen.getByText('Employee One')).toBeInTheDocument());
    await user.click(screen.getByText('Set new password'));

    const passwordInput = screen.getByPlaceholderText('New password');
    await user.type(passwordInput, 'NewPass123');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const call = mock.history.patch.find((r) => r.url === '/sub-users/5/password');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({ password: 'NewPass123' });
    });
    await waitFor(() => expect(screen.getByText('Password changed, and the user was signed out of all devices')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText('New password')).not.toBeInTheDocument();
  });

  it('shows an error message when the password change fails', async () => {
    mockLoad();
    mock.onPatch('/sub-users/5/password').reply(422, { message: 'Password too short' });

    const user = userEvent.setup();
    renderWithIntl(<ClientSubUsers clientId={7} />);

    await waitFor(() => expect(screen.getByText('Employee One')).toBeInTheDocument());
    await user.click(screen.getByText('Set new password'));
    await user.type(screen.getByPlaceholderText('New password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Password too short')).toBeInTheDocument());
  });

  it('cancels the inline password form without calling the API', async () => {
    mockLoad();
    const user = userEvent.setup();
    renderWithIntl(<ClientSubUsers clientId={7} />);

    await waitFor(() => expect(screen.getByText('Employee One')).toBeInTheDocument());
    await user.click(screen.getByText('Set new password'));
    await user.type(screen.getByPlaceholderText('New password'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByPlaceholderText('New password')).not.toBeInTheDocument();
    expect(mock.history.patch.length).toBe(0);
  });
});
