import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import StaffPage from '../page';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
  isAuthenticated: vi.fn(() => true),
}));

let mock: MockAdapter;

const nour = { id: 30, name: 'Nour Staff', email: 'nour@example.com', phone: null, date_of_birth: null, avatar_url: null, is_active: true, archived_at: null, assigned_clients_count: 2 };
const old = { id: 31, name: 'Old Timer', email: 'old@example.com', phone: null, date_of_birth: null, avatar_url: null, is_active: false, archived_at: '2026-10-01T10:00:00Z', assigned_clients_count: 0 };

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' } as any);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('StaffPage', () => {
  it('lists staff with how many clients each is on', async () => {
    mock.onGet('/company-staff').reply(200, { staff: [nour] });
    renderWithIntl(<StaffPage />);

    expect(await screen.findByText('Nour Staff')).toBeInTheDocument();
    expect(screen.getByText('nour@example.com')).toBeInTheDocument();
    expect(screen.getByText('2 clients assigned')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    mock.onGet('/company-staff').reply(200, { staff: [] });
    renderWithIntl(<StaffPage />);
    expect(await screen.findByText('No staff members yet.')).toBeInTheDocument();
  });

  it('neither renders nor calls the API for anyone but the super admin', () => {
    vi.mocked(getUser).mockReturnValue({ id: 2, name: 'Mgr', email: 'm@example.com', role: 'account_manager' } as any);
    renderWithIntl(<StaffPage />);
    expect(screen.getByText('Only the super admin can manage company staff.')).toBeInTheDocument();
    expect(mock.history.get.length).toBe(0);
  });

  it('asks for archived members only when the toggle is on', async () => {
    mock.onGet('/company-staff').reply((config) => [200, { staff: config.params?.include_archived ? [nour, old] : [nour] }]);
    renderWithIntl(<StaffPage />);
    await screen.findByText('Nour Staff');
    expect(screen.queryByText('Old Timer')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Show archived'));
    expect(await screen.findByText('Old Timer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();
  });

  it('creates a staff member and reloads the list', async () => {
    mock.onGet('/company-staff').reply(200, { staff: [] });
    mock.onPost('/company-staff').reply(201, { staff: nour });
    renderWithIntl(<StaffPage />);

    await userEvent.click(await screen.findByRole('button', { name: /New staff member/ }));
    await userEvent.type(screen.getByLabelText('Name'), 'Nour Staff');
    await userEvent.type(screen.getByLabelText('Email'), 'nour@example.com');
    await userEvent.type(screen.getByLabelText(/^Password/), 'Secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Add staff member' }));

    await waitFor(() => expect(mock.history.post.length).toBe(1));
    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toMatchObject({ name: 'Nour Staff', email: 'nour@example.com', password: 'Secret123', send_email: true });
    expect(await screen.findByText('Staff member added. Login details were emailed.')).toBeInTheDocument();
  });

  it('archives a member after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mock.onGet('/company-staff').reply(200, { staff: [nour] });
    mock.onPost('/company-staff/30/archive').reply(200, { staff: { ...nour, archived_at: '2026-10-17' } });
    renderWithIntl(<StaffPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Archive' }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === '/company-staff/30/archive')).toBe(true));
    expect(await screen.findByText('Staff member archived.')).toBeInTheDocument();
  });

  it('does not archive when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mock.onGet('/company-staff').reply(200, { staff: [nour] });
    renderWithIntl(<StaffPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    expect(mock.history.post.length).toBe(0);
  });

  it('shows the clients a member is assigned to', async () => {
    mock.onGet('/company-staff').reply(200, { staff: [nour] });
    mock.onGet('/company-staff/30/clients').reply(200, {
      clients: [{ workspace_id: 4, client_id: 9, uuid: 'abc', name: 'Acme Corp', manager: { id: 2, name: 'Mona Manager' } }],
    });
    renderWithIntl(<StaffPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Clients' }));

    const link = await screen.findByRole('link', { name: 'Acme Corp' });
    expect(link).toHaveAttribute('href', '/dashboard/clients/abc');
    expect(screen.getByText('Mona Manager')).toBeInTheDocument();
  });

  it('shows the server\'s validation message when saving fails', async () => {
    mock.onGet('/company-staff').reply(200, { staff: [] });
    mock.onPost('/company-staff').reply(422, { errors: { email: ['The email has already been taken.'] } });
    renderWithIntl(<StaffPage />);

    await userEvent.click(await screen.findByRole('button', { name: /New staff member/ }));
    await userEvent.type(screen.getByLabelText('Name'), 'X');
    await userEvent.type(screen.getByLabelText('Email'), 'dup@example.com');
    await userEvent.type(screen.getByLabelText(/^Password/), 'Secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Add staff member' }));

    expect(await screen.findByText('The email has already been taken.')).toBeInTheDocument();
  });
});
