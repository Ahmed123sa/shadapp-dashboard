import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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

const ALL = {
  can_view_chat: true, can_send_chat: true,
  can_view_approvals: true, can_request_approvals: true,
  can_view_meetings: true, can_join_meetings: true,
};

const nour = {
  id: 7, name: 'Nour Hassan', email: 'nour@example.com',
  other_teams: [{ manager_id: 9, name: 'Mariam Fathy' }],
  assignments: [
    { workspace_id: 11, client_id: 1, name: 'Nile Bakery', permissions: { ...ALL, can_send_chat: false, can_view_approvals: false, can_request_approvals: false } },
    { workspace_id: 12, client_id: 2, name: 'Relax', permissions: { ...ALL } },
  ],
};
const salma = { id: 8, name: 'Salma Adel', email: 'salma@example.com', other_teams: [], assignments: [] };
const youssef = { id: 20, name: 'Youssef Ali', email: 'youssef@example.com', other_teams: [{ manager_id: 9, name: 'Mariam Fathy' }] };
const hana = { id: 21, name: 'Hana Mostafa', email: 'hana@example.com', other_teams: [] };

const clientsReply = {
  clients: { data: [
    { id: 1, company_name: 'Nile Bakery', workspace: { id: 11 } },
    { id: 2, company_name: 'Relax', workspace: { id: 12 } },
    { id: 3, company_name: 'Sun Co', workspace: { id: 13 } },
  ] },
};

const loadTeam = (team = [nour, salma], others = [youssef, hana]) => mock.onGet('/my-team').reply(200, { team, others });

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(getUser).mockReturnValue({ id: 2, name: 'Mgr', email: 'm@example.com', role: 'account_manager' } as any);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('Team page', () => {
  it('lists the team with each member\'s clients and permission chips', async () => {
    loadTeam();
    renderWithIntl(<TeamPage />);

    const card = await screen.findByRole('article', { name: 'Nour Hassan' });
    expect(within(card).getByText('Nile Bakery')).toBeInTheDocument();
    expect(within(card).getByText('Relax')).toBeInTheDocument();
    expect(within(card).getByText(/Also in: Mariam Fathy/)).toBeInTheDocument();
    // Nile Bakery: chat view only, approvals off. Relax: everything on.
    expect(within(card).getByText('Chat · view')).toBeInTheDocument();
    expect(within(card).getAllByText('Chat · view + send')).toHaveLength(1);
    expect(card.querySelectorAll('[data-off="true"]')).toHaveLength(1);

    const empty = screen.getByRole('article', { name: 'Salma Adel' });
    expect(within(empty).getByText('Not linked to any of your clients yet.')).toBeInTheDocument();
  });

  it('shows the empty state when nobody is in the team', async () => {
    loadTeam([], [youssef]);
    renderWithIntl(<TeamPage />);
    expect(await screen.findByText('Nobody in your team yet. Add people from company staff.')).toBeInTheDocument();
  });

  it('keeps company staff hidden until asked, and the same button hides it again', async () => {
    loadTeam();
    renderWithIntl(<TeamPage />);
    await screen.findByRole('article', { name: 'Nour Hassan' });
    expect(screen.queryByText('Youssef Ali')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add from company staff' }));
    expect(screen.getByText('Youssef Ali')).toBeInTheDocument();
    expect(screen.getByText('Also in: Mariam Fathy')).toBeInTheDocument();
    expect(screen.getByText('In no team')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hide company staff' }));
    expect(screen.queryByText('Youssef Ali')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add from company staff' })).toBeInTheDocument();
  });

  it('filters the company staff list by name or email', async () => {
    loadTeam();
    renderWithIntl(<TeamPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add from company staff' }));

    await userEvent.type(screen.getByLabelText('Search by name or email…'), 'hana@');
    expect(screen.getByText('Hana Mostafa')).toBeInTheDocument();
    expect(screen.queryByText('Youssef Ali')).not.toBeInTheDocument();
  });

  it('adds several picked staff members to the team in one go', async () => {
    loadTeam();
    mock.onPost(/\/my-team\/\d+/).reply(200, { changed: true });
    renderWithIntl(<TeamPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add from company staff' }));

    const add = screen.getByRole('button', { name: 'Add 0 to my team' });
    expect(add).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Youssef Ali' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hana Mostafa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add 2 to my team' }));

    await waitFor(() => expect(mock.history.post.map((r) => r.url).sort()).toEqual(['/my-team/20', '/my-team/21']));
    // The list closes once they are added.
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Hana Mostafa' })).not.toBeInTheDocument());
  });

  it('asks before removing, naming the clients, and removes only on confirm', async () => {
    loadTeam();
    mock.onGet('/my-team/7/removal-impact').reply(200, { count: 2, clients: ['Nile Bakery', 'Relax'] });
    mock.onDelete('/my-team/7').reply(200, { removed: true, unassigned_count: 2 });
    renderWithIntl(<TeamPage />);

    const card = await screen.findByRole('article', { name: 'Nour Hassan' });
    await userEvent.click(within(card).getByRole('button', { name: 'Remove from team' }));

    expect(await screen.findByText('Remove Nour Hassan from your team?')).toBeInTheDocument();
    expect(screen.getByText(/unlinked from 2 of your clients: Nile Bakery، Relax/)).toBeInTheDocument();
    expect(mock.history.delete.length).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(mock.history.delete.map((r) => r.url)).toEqual(['/my-team/7']));
  });

  it('leaves the member alone when the removal is cancelled', async () => {
    loadTeam();
    mock.onGet('/my-team/8/removal-impact').reply(200, { count: 0, clients: [] });
    renderWithIntl(<TeamPage />);

    const card = await screen.findByRole('article', { name: 'Salma Adel' });
    await userEvent.click(within(card).getByRole('button', { name: 'Remove from team' }));
    expect(await screen.findByText(/aren’t linked to any of your clients/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Remove Salma Adel from your team?')).not.toBeInTheDocument();
    expect(mock.history.delete.length).toBe(0);
  });

  it('unlinks one client without touching the rest', async () => {
    loadTeam();
    mock.onDelete('/workspaces/11/staff/7').reply(200, { changed: true });
    renderWithIntl(<TeamPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Unlink Nile Bakery' }));

    await waitFor(() => expect(mock.history.delete.map((r) => r.url)).toEqual(['/workspaces/11/staff/7']));
  });

  it('links a member to a client with the default permissions (everything on)', async () => {
    loadTeam();
    mock.onGet('/clients').reply(200, clientsReply);
    mock.onPut('/workspaces/13/staff/8').reply(200, { changed: true });
    renderWithIntl(<TeamPage />);

    const card = await screen.findByRole('article', { name: 'Salma Adel' });
    await userEvent.click(within(card).getByRole('button', { name: 'Link to a client' }));

    const drawer = await screen.findByRole('dialog');
    await within(drawer).findByRole('option', { name: 'Sun Co' });
    for (const name of ['See the chat', 'Send messages', 'See approvals', 'Request approvals', 'See meetings', 'Join meetings']) {
      expect(within(drawer).getByRole('switch', { name })).toBeChecked();
    }
    const save = within(drawer).getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await userEvent.selectOptions(within(drawer).getByLabelText('Client'), 'Sun Co');
    await userEvent.click(save);

    await waitFor(() => expect(mock.history.put.length).toBe(1));
    expect(mock.history.put[0].url).toBe('/workspaces/13/staff/8');
    expect(JSON.parse(mock.history.put[0].data).permissions).toEqual(expect.objectContaining({ can_view_chat: true, can_send_chat: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not offer clients the member is already linked to', async () => {
    loadTeam();
    mock.onGet('/clients').reply(200, clientsReply);
    renderWithIntl(<TeamPage />);

    const card = await screen.findByRole('article', { name: 'Nour Hassan' });
    await userEvent.click(within(card).getByRole('button', { name: 'Link to a client' }));

    const drawer = await screen.findByRole('dialog');
    await within(drawer).findByRole('option', { name: 'Sun Co' });
    expect(within(drawer).queryByRole('option', { name: 'Relax' })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('option', { name: 'Nile Bakery' })).not.toBeInTheDocument();
  });

  it('turning "see" off turns the action under it off and locks it', async () => {
    loadTeam();
    mock.onGet('/clients').reply(200, clientsReply);
    mock.onPut('/workspaces/13/staff/8').reply(200, {});
    renderWithIntl(<TeamPage />);

    const card = await screen.findByRole('article', { name: 'Salma Adel' });
    await userEvent.click(within(card).getByRole('button', { name: 'Link to a client' }));
    const drawer = await screen.findByRole('dialog');
    await within(drawer).findByRole('option', { name: 'Sun Co' });
    await userEvent.selectOptions(within(drawer).getByLabelText('Client'), 'Sun Co');

    await userEvent.click(within(drawer).getByRole('switch', { name: 'See the chat' }));
    const send = within(drawer).getByRole('switch', { name: 'Send messages' });
    expect(send).not.toBeChecked();
    expect(send).toBeDisabled();

    await userEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mock.history.put.length).toBe(1));
    const sent = JSON.parse(mock.history.put[0].data).permissions;
    expect(sent.can_view_chat).toBe(false);
    expect(sent.can_send_chat).toBe(false);
    expect(sent.can_view_approvals).toBe(true);
  });

  it('edits the permissions of an existing link with the client fixed', async () => {
    loadTeam();
    mock.onPut('/workspaces/11/staff/7').reply(200, {});
    renderWithIntl(<TeamPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Nile Bakery' }));

    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(drawer).getByText('Nile Bakery')).toBeInTheDocument();
    expect(within(drawer).getByRole('switch', { name: 'Send messages' })).not.toBeChecked();
    expect(within(drawer).getByRole('switch', { name: 'See approvals' })).not.toBeChecked();
    expect(within(drawer).getByRole('switch', { name: 'Request approvals' })).toBeDisabled();

    await userEvent.click(within(drawer).getByRole('switch', { name: 'Send messages' }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mock.history.put.length).toBe(1));
    expect(JSON.parse(mock.history.put[0].data).permissions.can_send_chat).toBe(true);
  });

  it('shows an error when the team cannot be loaded', async () => {
    mock.onGet('/my-team').reply(500);
    renderWithIntl(<TeamPage />);
    expect(await screen.findByText('Could not load your team.')).toBeInTheDocument();
  });
});

describe('Team page access', () => {
  it('does not render or call the API for a non-manager', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' } as any);
    renderWithIntl(<TeamPage />);
    expect(screen.getByText('Only account managers can manage a team.')).toBeInTheDocument();
    expect(mock.history.get.length).toBe(0);
  });

  it('keeps the old assistants panel off while that feature is off', async () => {
    loadTeam();
    mock.onGet('/team').reply(200, { assistants: [] });
    renderWithIntl(<TeamPage />);
    await screen.findByRole('article', { name: 'Nour Hassan' });

    expect(screen.queryByText('Assistants')).not.toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/team')).toBe(false);
  });

  it('shows the assistants panel below the team once the feature is on', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 2, name: 'Mgr', email: 'm@example.com', role: 'account_manager', team_assistants_enabled: true } as any);
    loadTeam();
    mock.onGet('/team').reply(200, { assistants: [{
      id: 5, name: 'Sami Helper', email: 'sami@example.com', phone: null, is_active: true, deactivated_by_parent: false,
      permissions: { can_view_clients: true, can_edit_clients: false, can_chat: true, can_manage_contracts: false, can_manage_meetings: false, can_view_files: false, can_review_files: false, can_manage_approvals: false },
    }] });
    renderWithIntl(<TeamPage />);

    expect(await screen.findByText('Sami Helper')).toBeInTheDocument();
    expect(screen.getByText('Assistants')).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Nour Hassan' })).toBeInTheDocument();
  });
});
