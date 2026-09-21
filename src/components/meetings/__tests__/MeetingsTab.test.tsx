import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import MeetingsTab from '../MeetingsTab';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// Characterization suite written BEFORE migrating MeetingsTab off manual
// useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md Round 3,
// Meetings slice). Pins down current API calls + rendered/updated state so
// the migration can be checked against this file instead of assumptions.

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

// Mock window.confirm, used by completeMeeting/cancelMeeting.
const confirmSpy = vi.spyOn(window, 'confirm');

let mock: MockAdapter;

const upcomingMeeting = {
  id: 401,
  workspace_id: 9,
  title: 'Kickoff Call',
  status: 'scheduled',
  scheduled_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days out
  duration_minutes: 30,
  notes: '',
};

function mockLoad(overrides?: { meetings?: unknown[]; contracts?: unknown[] }) {
  mock.onGet('/workspaces/9/meetings').reply(200, { meetings: overrides?.meetings ?? [upcomingMeeting] });
  mock.onGet('/workspaces/9/contracts').reply(200, { contracts: overrides?.contracts ?? [] });
}

beforeEach(() => {
  mock = new MockAdapter(api);
  confirmSpy.mockReturnValue(true);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('MeetingsTab (characterization)', () => {
  it('loads meetings and contracts for the workspace on mount', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad();
    renderWithIntl(<MeetingsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Kickoff Call')).toBeInTheDocument());
    expect(screen.getByText('Upcoming Meetings')).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/meetings')).toBe(true);
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/contracts')).toBe(true);
  });

  it('shows the empty state when there are no meetings', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad({ meetings: [] });
    renderWithIntl(<MeetingsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('No meetings')).toBeInTheDocument());
  });

  it('lets a non-super-admin create a new meeting', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad({ meetings: [] });
    mock.onPost('/workspaces/9/meetings').reply(200, {
      meeting: { id: 900, workspace_id: 9, title: 'Follow-up', status: 'scheduled', scheduled_at: new Date(Date.now() + 86400000).toISOString(), duration_minutes: 30, notes: '' },
    });

    const user = userEvent.setup();
    renderWithIntl(<MeetingsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('+ New Meeting')).toBeInTheDocument());
    await user.click(screen.getByText('+ New Meeting'));

    await user.type(screen.getByPlaceholderText('Meeting title'), 'Follow-up');
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dateInput, '2027-01-15');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/meetings');
      expect(call).toBeTruthy();
      const body = JSON.parse(call!.data);
      expect(body.title).toBe('Follow-up');
    });
    await waitFor(() => expect(screen.getByText('Follow-up')).toBeInTheDocument());
  });

  it('does not create a duplicate meeting when the save button is clicked twice quickly', async () => {
    // Regression test: the save button used to have no disabled/pending
    // state at all, so on a slow backend a user who clicked twice (or
    // double-clicked) before the first request resolved would fire two
    // POSTs and end up with two booked meetings. The fix disables the button
    // on createMutation.isPending, but the handler's own guard uses a ref
    // (isSubmittingRef) rather than isPending — isPending only flips true
    // once React commits a render, which is a tick after .mutate() is
    // called, so two clicks landing in the same tick (as fired below) would
    // both slip past an isPending-only check. The ref is set synchronously.
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad({ meetings: [] });
    mock.onPost('/workspaces/9/meetings').reply(200, {
      meeting: { id: 901, workspace_id: 9, title: 'Double Click', status: 'scheduled', scheduled_at: new Date(Date.now() + 86400000).toISOString(), duration_minutes: 30, notes: '' },
    });

    const user = userEvent.setup();
    renderWithIntl(<MeetingsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('+ New Meeting')).toBeInTheDocument());
    await user.click(screen.getByText('+ New Meeting'));

    await user.type(screen.getByPlaceholderText('Meeting title'), 'Double Click');
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dateInput, '2027-01-15');

    const saveButton = screen.getByText('Save');
    // Fire both clicks back-to-back (not awaited) so the second one can land
    // before a re-render would disable the button — the exact race the
    // in-handler isPending guard exists to close.
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => expect(screen.getByText('Double Click')).toBeInTheDocument());
    const calls = mock.history.post.filter((r) => r.url === '/workspaces/9/meetings');
    expect(calls.length).toBe(1);
  });

  it('lets a non-super-admin complete a scheduled meeting after confirming', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad();
    mock.onPatch('/meetings/401/complete').reply(200, {
      meeting: { ...upcomingMeeting, status: 'completed' },
    });

    const user = userEvent.setup();
    renderWithIntl(<MeetingsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Completed')).toBeInTheDocument());
    await user.click(screen.getByText('Completed'));

    await waitFor(() => {
      expect(mock.history.patch.some((r) => r.url === '/meetings/401/complete')).toBe(true);
    });
    await waitFor(() => expect(screen.getByText('Completed', { selector: 'span' })).toBeInTheDocument());
  });

  it('lets a non-super-admin cancel a scheduled meeting after confirming', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad();
    mock.onPatch('/meetings/401/cancel').reply(200, {
      meeting: { ...upcomingMeeting, status: 'cancelled' },
    });

    const user = userEvent.setup();
    renderWithIntl(<MeetingsTab wsId={9} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(mock.history.patch.some((r) => r.url === '/meetings/401/cancel')).toBe(true);
    });
    await waitFor(() => expect(screen.getByText('Cancelled')).toBeInTheDocument());
  });
});
