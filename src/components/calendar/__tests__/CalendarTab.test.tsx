import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import CalendarTab from '../CalendarTab';
import api from '@/lib/api';

// 24 Sept 2026 — this calendar used to: read a meeting's UTC timestamp with
// a plain string slice (putting a late-night meeting on the wrong day for
// an Egypt-time viewer), show no status at all for a cancelled/completed
// meeting, only show an approval once the client had answered it (with the
// status left untranslated), skip payments entirely, and drop a contract
// that had neither a start nor an end date. Each of those is pinned down
// below.

let mock: MockAdapter;

function mockLoad(overrides?: {
  meetings?: unknown[];
  contracts?: unknown[];
  approvals?: unknown[];
  payments?: unknown[];
}) {
  mock.onGet('/workspaces/9/meetings').reply(200, { meetings: overrides?.meetings ?? [] });
  mock.onGet('/workspaces/9/contracts').reply(200, { contracts: overrides?.contracts ?? [] });
  mock.onGet('/workspaces/9/approvals').reply(200, { approvals: overrides?.approvals ?? [] });
  mock.onGet('/workspaces/9/payments').reply(200, { payments: overrides?.payments ?? [] });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
});

describe('CalendarTab', () => {
  it('shows the empty state when there are no events', async () => {
    mockLoad();
    renderWithIntl(<CalendarTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('No events')).toBeInTheDocument());
  });

  it('puts a late-night meeting on the viewer\'s local day, not the UTC day', async () => {
    // 23:30 UTC on Oct 1st is 01:30 on Oct 2nd in Egypt (UTC+2 in winter).
    // A plain string slice of the raw timestamp would file this under Oct 1st.
    mockLoad({ meetings: [{ id: 1, title: 'Kickoff', status: 'scheduled', scheduled_at: '2026-12-01T23:30:00.000Z' }] });
    renderWithIntl(<CalendarTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Kickoff')).toBeInTheDocument());
    // Local-time expectation depends on the test runner's TZ; assert against
    // what the browser's own Date resolves to, the same way the component does.
    const expectedDay = new Date('2026-12-01T23:30:00.000Z').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    expect(screen.getByText(expectedDay)).toBeInTheDocument();
  });

  it('shows a status badge for a cancelled meeting', async () => {
    mockLoad({ meetings: [{ id: 1, title: 'Kickoff', status: 'cancelled', scheduled_at: '2026-12-01T10:00:00.000Z' }] });
    renderWithIntl(<CalendarTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Kickoff')).toBeInTheDocument());
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('shows a pending approval that has not been responded to yet, with a translated status', async () => {
    mockLoad({
      approvals: [{ id: 5, title: 'Logo sign-off', status: 'pending', created_at: '2026-12-01T09:00:00.000Z' }],
    });
    renderWithIntl(<CalendarTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Logo sign-off')).toBeInTheDocument());
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows a responded approval on the day it was responded to, with a translated status', async () => {
    mockLoad({
      approvals: [{
        id: 5, title: 'Logo sign-off', status: 'approved',
        created_at: '2026-11-20T09:00:00.000Z', responded_at: '2026-12-01T09:00:00.000Z',
      }],
    });
    renderWithIntl(<CalendarTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Logo sign-off')).toBeInTheDocument());
    expect(screen.getByText('Approved')).toBeInTheDocument();
    const respondedDay = new Date('2026-12-01T09:00:00.000Z').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    expect(screen.getByText(respondedDay)).toBeInTheDocument();
  });

  it('shows a payment', async () => {
    mockLoad({
      payments: [{ id: 7, amount: '5000', currency: 'SAR', status: 'approved', created_at: '2026-12-01T09:00:00.000Z' }],
    });
    renderWithIntl(<CalendarTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Payment: 5000 SAR')).toBeInTheDocument());
  });

  it('shows a contract with neither a start nor an end date, on the day it was signed off', async () => {
    mockLoad({
      contracts: [{
        id: 3, title: 'Retainer', status: 'company_approved',
        created_at: '2026-11-01T09:00:00.000Z', company_signed_at: '2026-12-01T09:00:00.000Z',
      }],
    });
    renderWithIntl(<CalendarTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Retainer')).toBeInTheDocument());
    const signedDay = new Date('2026-12-01T09:00:00.000Z').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    expect(screen.getByText(signedDay)).toBeInTheDocument();
  });

  it('still shows a start/deadline event for a contract that has dates', async () => {
    mockLoad({
      contracts: [{ id: 4, title: 'Design Phase', status: 'sent', start_date: '2026-12-01', end_date: '2026-12-15' }],
    });
    renderWithIntl(<CalendarTab wsId={9} />);

    await waitFor(() => expect(screen.getAllByText('Design Phase', { exact: false }).length).toBe(2));
  });
});
