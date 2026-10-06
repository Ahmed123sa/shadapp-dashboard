import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import TeamPage from '../page';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
  isAuthenticated: vi.fn(() => true),
}));

let mock: MockAdapter;

const perms = (over: Record<string, boolean> = {}) => ({
  can_view_clients: true, can_edit_clients: false, can_chat: false, can_manage_contracts: false,
  can_manage_meetings: false, can_view_files: false, can_review_files: false, can_manage_approvals: false, ...over,
});

const sami = { id: 7, name: 'Sami Helper', email: 'sami@example.com', phone: null, is_active: true, deactivated_by_parent: false, permissions: perms({ can_chat: true }) };

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(getUser).mockReturnValue({ id: 2, name: 'Mgr', email: 'm@example.com', role: 'account_manager' } as any);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('TeamPage', () => {
  it('lists the manager\'s assistants with their granted permissions', async () => {
    mock.onGet('/team').reply(200, { assistants: [sami] });
    renderWithIntl(<TeamPage />);

    expect(await screen.findByText('Sami Helper')).toBeInTheDocument();
    expect(screen.getByText('sami@example.com')).toBeInTheDocument();
  });

  it('shows the empty state when there are no assistants', async () => {
    mock.onGet('/team').reply(200, { assistants: [] });
    renderWithIntl(<TeamPage />);
    expect(await screen.findByText('You have no assistants yet.')).toBeInTheDocument();
  });

  it('does not render or call the API for a non-manager', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' } as any);
    renderWithIntl(<TeamPage />);
    expect(screen.getByText('Only account managers can manage a team.')).toBeInTheDocument();
    expect(mock.history.get.length).toBe(0);
  });

  it('keeps can_view_clients ticked and locked in the create form', async () => {
    mock.onGet('/team').reply(200, { assistants: [] });
    renderWithIntl(<TeamPage />);
    await userEvent.click(await screen.findByRole('button', { name: /New assistant/ }));

    const boxes = screen.getAllByRole('checkbox');
    // first box is "email the login details" (on by default), then the permissions
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).toBeChecked();
    expect(boxes[1]).toBeDisabled();
    expect(boxes.slice(2).every((b) => !(b as HTMLInputElement).checked)).toBe(true);
  });

  it('creates an assistant with the ticked permissions', async () => {
    mock.onGet('/team').reply(200, { assistants: [] });
    mock.onPost('/team').reply(201, { assistant: sami });
    renderWithIntl(<TeamPage />);
    await userEvent.click(await screen.findByRole('button', { name: /New assistant/ }));

    await userEvent.type(screen.getByLabelText('Name'), 'Sami Helper');
    await userEvent.type(screen.getByLabelText('Email'), 'sami@example.com');
    await userEvent.type(document.querySelector('input[type="password"]') as HTMLInputElement, 'Str0ng!Pass#1');
    await userEvent.click(screen.getAllByRole('checkbox')[3]); // can_chat (0 = send email, 1 = can_view_clients)
    await userEvent.click(screen.getByRole('button', { name: 'Create assistant' }));

    await waitFor(() => expect(mock.history.post.length).toBe(1));
    const body = JSON.parse(mock.history.post[0].data);
    expect(body.email).toBe('sami@example.com');
    expect(body.permissions.can_chat).toBe(true);
    expect(body.permissions.can_manage_contracts).toBe(false);
    expect(body.send_email).toBe(true);
  });

  it('can switch the login-details email off', async () => {
    mock.onGet('/team').reply(200, { assistants: [] });
    mock.onPost('/team').reply(201, { assistant: sami });
    renderWithIntl(<TeamPage />);
    await userEvent.click(await screen.findByRole('button', { name: /New assistant/ }));
    await userEvent.type(screen.getByLabelText('Name'), 'Sami Helper');
    await userEvent.type(screen.getByLabelText('Email'), 'sami@example.com');
    await userEvent.type(document.querySelector('input[type="password"]') as HTMLInputElement, 'Str0ng!Pass#1');
    await userEvent.click(screen.getByLabelText('Email the login details to this person'));
    await userEvent.click(screen.getByRole('button', { name: 'Create assistant' }));

    await waitFor(() => expect(mock.history.post.length).toBe(1));
    expect(JSON.parse(mock.history.post[0].data).send_email).toBe(false);
  });

  it('shows the backend validation message when creation fails', async () => {
    mock.onGet('/team').reply(200, { assistants: [] });
    mock.onPost('/team').reply(422, { errors: { email: ['The email has already been taken.'] } });
    renderWithIntl(<TeamPage />);
    await userEvent.click(await screen.findByRole('button', { name: /New assistant/ }));
    await userEvent.type(screen.getByLabelText('Name'), 'X');
    await userEvent.type(screen.getByLabelText('Email'), 'x@example.com');
    await userEvent.type(document.querySelector('input[type="password"]') as HTMLInputElement, 'Str0ng!Pass#1');
    await userEvent.click(screen.getByRole('button', { name: 'Create assistant' }));

    expect(await screen.findByText('The email has already been taken.')).toBeInTheDocument();
  });

  it('deactivates an assistant after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mock.onGet('/team').reply(200, { assistants: [sami] });
    mock.onPost('/team/7/deactivate').reply(200, { assistant: { ...sami, is_active: false } });
    renderWithIntl(<TeamPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === '/team/7/deactivate')).toBe(true));
  });

  it('explains an assistant that is off only because the manager is', async () => {
    mock.onGet('/team').reply(200, { assistants: [{ ...sami, is_active: false, deactivated_by_parent: true }] });
    renderWithIntl(<TeamPage />);
    expect(await screen.findByText('Switched off with the manager')).toBeInTheDocument();
  });

  it('loads an assistant\'s activity', async () => {
    mock.onGet('/team').reply(200, { assistants: [sami] });
    mock.onGet('/team/7/activity').reply(200, { logs: { data: [{ id: 1, action: 'contract.sent', created_at: '2026-10-05T10:00:00Z', client: { company_name: 'Acme' } }] } });
    renderWithIntl(<TeamPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Activity' }));

    expect(await screen.findByText('contract.sent')).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
  });
});
