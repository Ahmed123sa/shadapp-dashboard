import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientStaffTab from '../ClientStaffTab';
import api from '@/lib/api';

let mock: MockAdapter;

const rows = [
  { id: 30, name: 'Nour Staff', email: 'nour@example.com', avatar_url: null, assigned: true },
  { id: 31, name: 'Omar Staff', email: 'omar@example.com', avatar_url: null, assigned: false },
];

beforeEach(() => { mock = new MockAdapter(api); });
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
});
