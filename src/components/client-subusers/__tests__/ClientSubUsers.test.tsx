import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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

describe('ClientSubUsers — Luxe form (ع٥)', () => {
  const ALL = [
    'can_chat', 'can_view_contracts', 'can_approve_contracts', 'can_view_payments', 'can_upload_payment_proof',
    'can_view_approvals', 'can_respond_approvals', 'can_view_files', 'can_upload_files', 'can_view_meetings', 'can_join_meetings',
  ];

  function load(subUsers: unknown[] = [subUser]) {
    mock.onGet('/clients/7/sub-users').reply(200, { sub_users: subUsers });
    mock.onGet('/sub-user-permissions').reply(200, { permissions: ALL });
  }

  it('shows all 11 permission switches in 6 groups and creates with phone, send_email and chosen permissions', async () => {
    load([]);
    mock.onPost('/clients/7/sub-users').reply(201, { sub_user: { id: 9, name: 'New Person', email: 'new@acme.com', permissions: {} } });
    mock.onPatch('/sub-users/9/permissions').reply(200, { sub_user: { id: 9, permissions: { can_chat: true } } });
    const user = userEvent.setup();
    renderWithIntl(<ClientSubUsers clientId={7} />);

    await user.click(await screen.findByRole('button', { name: 'Add member' }));
    expect(screen.getAllByRole('switch')).toHaveLength(12); // 11 permissions + send-login
    for (const g of ['Chat', 'Contracts', 'Payments', 'Approvals', 'Files', 'Meetings']) {
      expect(screen.getAllByText(g).length).toBeGreaterThan(0);
    }

    await user.type(screen.getByLabelText('Full name'), 'New Person');
    await user.type(screen.getByLabelText('Email'), 'new@acme.com');
    await user.type(screen.getByLabelText('Phone'), '0100');
    await user.type(screen.getByLabelText('Password'), 'Passw0rd1');
    await user.click(screen.getByRole('switch', { name: 'Chat' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const post = mock.history.post.find((r) => r.url === '/clients/7/sub-users');
      expect(JSON.parse(post!.data)).toEqual({ name: 'New Person', email: 'new@acme.com', password: 'Passw0rd1', phone: '0100', send_email: true });
      const patch = mock.history.patch.find((r) => r.url === '/sub-users/9/permissions');
      const perms = JSON.parse(patch!.data).permissions;
      expect(Object.keys(perms)).toHaveLength(11);
      expect(perms.can_chat).toBe(true);
      expect(perms.can_upload_files).toBe(false);
    });
    await waitFor(() => expect(screen.getByText('New Person')).toBeInTheDocument());
  });

  it('can turn the login email off', async () => {
    load([]);
    mock.onPost('/clients/7/sub-users').reply(201, { sub_user: { id: 9, name: 'A', email: 'a@acme.com', permissions: {} } });
    const user = userEvent.setup();
    renderWithIntl(<ClientSubUsers clientId={7} />);

    await user.click(await screen.findByRole('button', { name: 'Add member' }));
    await user.type(screen.getByLabelText('Full name'), 'A');
    await user.type(screen.getByLabelText('Email'), 'a@acme.com');
    await user.type(screen.getByLabelText('Password'), 'Passw0rd1');
    await user.click(screen.getByRole('switch', { name: 'Email the login details to this person' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const post = mock.history.post.find((r) => r.url === '/clients/7/sub-users');
      expect(JSON.parse(post!.data).send_email).toBe(false);
    });
    expect(mock.history.patch.length).toBe(0); // no permissions chosen -> no PATCH
  });

  it('edits profile and permissions', async () => {
    load();
    mock.onPut('/sub-users/5/profile').reply(200, { sub_user: { id: 5, name: 'Renamed', email: 'employee@acme.com' } });
    mock.onPatch('/sub-users/5/permissions').reply(200, { sub_user: { id: 5, permissions: { can_view_contracts: true, can_chat: true } } });
    const user = userEvent.setup();
    renderWithIntl(<ClientSubUsers clientId={7} />);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const name = screen.getByLabelText('Full name');
    await user.clear(name);
    await user.type(name, 'Renamed');
    await user.click(screen.getByRole('switch', { name: 'Chat' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mock.history.put.find((r) => r.url === '/sub-users/5/profile')).toBeTruthy());
    await waitFor(() => expect(mock.history.patch.find((r) => r.url === '/sub-users/5/permissions')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Renamed')).toBeInTheDocument());
  });

  it('deletes only after confirming, with no status column', async () => {
    load();
    mock.onDelete('/sub-users/5').reply(200, {});
    const user = userEvent.setup();
    renderWithIntl(<ClientSubUsers clientId={7} />);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(mock.history.delete.length).toBe(0);
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mock.history.delete.some((r) => r.url === '/sub-users/5')).toBe(true));
    await waitFor(() => expect(screen.queryByText('Employee One')).not.toBeInTheDocument());
  });

  it('cancelling the delete dialog keeps the user', async () => {
    load();
    const user = userEvent.setup();
    renderWithIntl(<ClientSubUsers clientId={7} />);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(mock.history.delete.length).toBe(0);
    expect(screen.getByText('Employee One')).toBeInTheDocument();
  });
});

