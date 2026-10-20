import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientStaffTab from '../ClientStaffTab';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

let mock: MockAdapter;

const rows = [
  { id: 30, name: 'Nour Staff', email: 'nour@example.com', avatar_url: null, assigned: true },
  { id: 31, name: 'Omar Staff', email: 'omar@example.com', avatar_url: null, assigned: false },
];

beforeEach(() => { mock = new MockAdapter(api); vi.mocked(getUser).mockReturnValue(undefined as any); });
afterEach(() => { mock.restore(); vi.clearAllMocks(); });

describe('ClientStaffTab', () => {
  it('lists every active staff member and how many are on this client', async () => {
    mock.onGet('/workspaces/22/staff').reply(200, { staff: rows });
    renderWithIntl(<ClientStaffTab wsId={22} />);

    expect(await screen.findByText('Nour Staff')).toBeInTheDocument();
    expect(screen.getByText('Omar Staff')).toBeInTheDocument();
    expect(screen.getByText('1 person assigned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Nour Staff' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign Omar Staff' })).toBeInTheDocument();
  });

  it('assigns a member with PUT and flips their button', async () => {
    mock.onGet('/workspaces/22/staff').reply(200, { staff: rows });
    mock.onPut('/workspaces/22/staff/31').reply(200, { changed: true });
    renderWithIntl(<ClientStaffTab wsId={22} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Assign Omar Staff' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Omar Staff' })).toBeInTheDocument());
    expect(mock.history.put.length).toBe(1);
    expect(screen.getByText('2 people assigned')).toBeInTheDocument();
  });

  it('removes a member with DELETE', async () => {
    mock.onGet('/workspaces/22/staff').reply(200, { staff: rows });
    mock.onDelete('/workspaces/22/staff/30').reply(200, { changed: true });
    renderWithIntl(<ClientStaffTab wsId={22} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Nour Staff' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Assign Nour Staff' })).toBeInTheDocument());
    expect(mock.history.delete.length).toBe(1);
  });

  it('keeps the button as it was and shows the error when the change is refused', async () => {
    mock.onGet('/workspaces/22/staff').reply(200, { staff: rows });
    mock.onPut('/workspaces/22/staff/31').reply(422, { message: 'الموظف ده متأرشف.' });
    renderWithIntl(<ClientStaffTab wsId={22} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Assign Omar Staff' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('الموظف ده متأرشف.');
    expect(screen.getByRole('button', { name: 'Assign Omar Staff' })).toBeInTheDocument();
  });

  it('shows the empty state when there are no active staff', async () => {
    mock.onGet('/workspaces/22/staff').reply(200, { staff: [] });
    renderWithIntl(<ClientStaffTab wsId={22} />);
    expect(await screen.findByText(/no active staff members yet/i)).toBeInTheDocument();
  });

  it('shows a load error', async () => {
    mock.onGet('/workspaces/22/staff').reply(403, { message: 'no' });
    renderWithIntl(<ClientStaffTab wsId={22} />);
    expect(await screen.findByText('Could not load the team.')).toBeInTheDocument();
  });

  describe('as an account manager', () => {
    const all = { can_view_chat: true, can_send_chat: true, can_view_approvals: true, can_request_approvals: true, can_view_meetings: true, can_join_meetings: true };
    const mgrRows = [
      { id: 30, name: 'Nour Staff', email: 'nour@example.com', assigned: true, in_my_team: true, permissions: { ...all, can_send_chat: false } },
      { id: 31, name: 'Omar Staff', email: 'omar@example.com', assigned: false, in_my_team: true, permissions: null },
      { id: 32, name: 'Old Staff', email: 'old@example.com', assigned: true, in_my_team: false, permissions: all },
    ];
    beforeEach(() => { vi.mocked(getUser).mockReturnValue({ id: 2, name: 'Mgr', email: 'm@example.com', role: 'account_manager' } as any); });

    it('shows permissions chips, the Team page link and the not-in-my-team row apart', async () => {
      mock.onGet('/workspaces/22/staff').reply(200, { staff: mgrRows });
      renderWithIntl(<ClientStaffTab wsId={22} />);

      expect(await screen.findByText('Nour Staff')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Open Team page' })).toHaveAttribute('href', '/dashboard/team');
      expect(screen.getAllByTestId('permission-chips').length).toBe(2);
      expect(screen.getByText('Not in your team')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add to my team Old Staff' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Edit permissions/ })).not.toBeInTheDocument();
    });

    it('adds the outsider to my team with POST /my-team/{id}', async () => {
      mock.onGet('/workspaces/22/staff').reply(200, { staff: mgrRows });
      mock.onPost('/my-team/32').reply(200, {});
      renderWithIntl(<ClientStaffTab wsId={22} />);

      await userEvent.click(await screen.findByRole('button', { name: 'Add to my team Old Staff' }));

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to my team Old Staff' })).not.toBeInTheDocument());
      expect(mock.history.post.length).toBe(1);
    });

    it('unassigning an outsider removes the row', async () => {
      mock.onGet('/workspaces/22/staff').reply(200, { staff: mgrRows });
      mock.onDelete('/workspaces/22/staff/32').reply(200, { changed: true });
      renderWithIntl(<ClientStaffTab wsId={22} />);

      await userEvent.click(await screen.findByRole('button', { name: 'Remove Old Staff' }));

      await waitFor(() => expect(screen.queryByText('Old Staff')).not.toBeInTheDocument());
    });
  });

  it('lets a super admin edit permissions of an assigned member', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' } as any);
    mock.onGet('/workspaces/22/staff').reply(200, { staff: [{ ...rows[0], permissions: null }] });
    renderWithIntl(<ClientStaffTab wsId={22} clientName="Acme" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit permissions Nour Staff' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
