import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientMeetings from '../ClientMeetings';
import api from '@/lib/api';

// Characterization suite written BEFORE migrating ClientMeetings off manual
// useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md Round 3,
// Meetings slice). Shares the same `/workspaces/:id/meetings` endpoint as
// MeetingsTab, so this pins down the client-facing view's own rendering
// (upcoming/past split, no create/complete/cancel actions) beforehand.

let mock: MockAdapter;

const upcomingMeeting = {
  id: 401,
  workspace_id: 9,
  title: 'Kickoff Call',
  status: 'scheduled',
  scheduled_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days out
  duration_minutes: 30,
  notes: 'Bring the deck',
  passcode: '1234',
};

const pastMeeting = {
  id: 402,
  workspace_id: 9,
  title: 'Old Review',
  status: 'completed',
  scheduled_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days ago
  duration_minutes: 45,
  notes: '',
};

function mockLoad(overrides?: { meetings?: unknown[] }) {
  mock.onGet('/workspaces/9/meetings').reply(200, { meetings: overrides?.meetings ?? [upcomingMeeting, pastMeeting] });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientMeetings (characterization)', () => {
  it('loads meetings for the workspace on mount and splits into upcoming/past', async () => {
    mockLoad();
    renderWithIntl(<ClientMeetings wsId={9} />);

    await waitFor(() => expect(screen.getByText('Kickoff Call')).toBeInTheDocument());
    expect(screen.getByText('Upcoming Meetings')).toBeInTheDocument();
    expect(screen.getByText('Old Review')).toBeInTheDocument();
    expect(screen.getByText('Past Meetings')).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/meetings')).toBe(true);
  });

  it('shows the empty state when there are no meetings', async () => {
    mockLoad({ meetings: [] });
    renderWithIntl(<ClientMeetings wsId={9} />);

    await waitFor(() => expect(screen.getByText('No meetings')).toBeInTheDocument());
  });

  it('shows notes and passcode for an upcoming meeting', async () => {
    mockLoad();
    renderWithIntl(<ClientMeetings wsId={9} />);

    await waitFor(() => expect(screen.getByText('Bring the deck')).toBeInTheDocument());
    expect(screen.getByText('Passcode: 1234', { exact: false })).toBeInTheDocument();
  });
});
