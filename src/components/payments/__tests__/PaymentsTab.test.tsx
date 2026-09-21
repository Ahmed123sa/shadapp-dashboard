import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import PaymentsTab from '../PaymentsTab';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import type { Client } from '@/types';

// Characterization suite written BEFORE migrating PaymentsTab off manual
// useEffect+setState (and its 30s setInterval poll) onto TanStack Query, per
// DASHBOARD_ASSESSMENT.md Round 3. These tests pin down the component's
// *current* observable behavior — API calls made, what renders, what state
// updates after each mutation — so the migration can be verified against
// this file instead of against assumptions about what "should" still work.

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
}));

let mock: MockAdapter;

const client: Client = {
  id: 1,
  company_name: 'Acme Corp',
  contact_person: 'John Doe',
  email: 'john@acme.test',
  phone: '0000000000',
  manager_id: 2,
  status: 'active',
  client_type: 'business',
  contract_value: 10000,
  payment_status: 'pending',
  subUsers: [],
  payments: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const pendingPayment = {
  id: 501,
  workspace_id: 9,
  client_id: 1,
  amount: '2500.00',
  currency: 'SAR',
  method_type: 'bank_transfer',
  status: 'pending',
  created_at: '2026-08-01T00:00:00Z',
};

const scheduledPayment = {
  id: 502,
  workspace_id: 9,
  client_id: 1,
  amount: '1000.00',
  currency: 'SAR',
  method_type: 'bank_transfer',
  status: 'scheduled',
  due_date: '2026-09-15',
  requested_by_manager: true,
  created_at: '2026-08-01T00:00:00Z',
};

function mockInitialLoad(payments: unknown[] = [pendingPayment]) {
  mock.onGet('/workspaces/9/payments').reply(200, { payments, tax_summary: null });
  mock.onGet('/workspaces/9/contracts').reply(200, { contracts: [] });
}

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  mock.restore();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('PaymentsTab (characterization)', () => {
  it('loads payments and contracts for the workspace on mount', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockInitialLoad();

    renderWithIntl(<PaymentsTab wsId={9} client={client} />);

    await waitFor(() => expect(screen.getByText('Payment 1st')).toBeInTheDocument());
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/payments')).toBe(true);
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/contracts')).toBe(true);
  });

  it('shows Request/Schedule buttons for a non-super-admin manager but not review actions', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockInitialLoad();

    renderWithIntl(<PaymentsTab wsId={9} client={client} />);

    await waitFor(() => expect(screen.getByText('Request Payment')).toBeInTheDocument());
    expect(screen.getByText('Schedule Payments')).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
  });

  it('lets a super admin approve a pending payment, updating it in place', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 9, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
    mockInitialLoad();
    mock.onPost('/payments/501/review').reply(200, {
      payment: { ...pendingPayment, status: 'approved' },
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<PaymentsTab wsId={9} client={client} />);

    await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument());
    await user.click(screen.getByText('Approve'));

    await waitFor(() => {
      const reviewCall = mock.history.post.find((r) => r.url === '/payments/501/review');
      expect(reviewCall).toBeTruthy();
      expect(JSON.parse(reviewCall!.data)).toEqual({ action: 'approved' });
    });
    // Status text flips from pending -> approved without a full reload.
    await waitFor(() => expect(screen.queryByText('Approve')).not.toBeInTheDocument());
  });

  it('submits a payment request and refetches the payments list', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockInitialLoad([]);
    mock.onPost('/workspaces/9/payments/request').reply(200, {});

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<PaymentsTab wsId={9} client={client} />);

    await waitFor(() => expect(screen.getByText('Request Payment')).toBeInTheDocument());
    await user.click(screen.getByText('Request Payment'));

    const amountInput = await screen.findByPlaceholderText('0.00');
    await user.type(amountInput, '750');
    await user.click(screen.getByText('Send Request'));

    await waitFor(() => {
      const reqCall = mock.history.post.find((r) => r.url === '/workspaces/9/payments/request');
      expect(reqCall).toBeTruthy();
      expect(JSON.parse(reqCall!.data)).toMatchObject({ amount: 750, currency: 'SAR' });
    });
    // Component re-fetches the list after a successful request.
    await waitFor(() => {
      expect(mock.history.get.filter((r) => r.url === '/workspaces/9/payments').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('deletes a manager-scheduled payment after confirmation and removes it from the list', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockInitialLoad([scheduledPayment]);
    mock.onDelete('/payments/502/schedule').reply(200, {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<PaymentsTab wsId={9} client={client} />);

    await waitFor(() => expect(screen.getByText('Delete')).toBeInTheDocument());
    await user.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mock.history.delete.some((r) => r.url === '/payments/502/schedule')).toBe(true);
    });
    await waitFor(() => expect(screen.queryByText('Delete')).not.toBeInTheDocument());
    confirmSpy.mockRestore();
  });

  it('polls the workspace payments/contracts every 30s', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockInitialLoad();

    renderWithIntl(<PaymentsTab wsId={9} client={client} />);
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/workspaces/9/payments').length).toBe(1));

    await vi.advanceTimersByTimeAsync(30000);
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/workspaces/9/payments').length).toBe(2));
  });
});
