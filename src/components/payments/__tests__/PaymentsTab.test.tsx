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

function mockInitialLoad(payments: unknown[] = [pendingPayment], contracts: unknown[] = []) {
  mock.onGet('/workspaces/9/payments').reply(200, { payments, tax_summary: null });
  mock.onGet('/workspaces/9/contracts').reply(200, { contracts });
}

const egpContract = {
  id: 71, workspace_id: 9, title: 'EGP Contract', status: 'company_approved',
  value: '5000', currency: 'EGP', created_by: 2,
};

const usdContract = {
  id: 72, workspace_id: 9, title: 'USD Contract', status: 'draft',
  value: '3000', currency: 'USD', created_by: 2,
};

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

  // Regression coverage for plans/payment-currency-plan.md ح2: PaymentsTab
  // used to show a free 9-currency dropdown defaulting to SAR regardless of
  // the client's actual contracts. The backend now enforces payment
  // currency = contract currency server-side either way, but the UI should
  // stop offering a choice that's misleading (single currency) or
  // ambiguous (multiple currencies) — see PaymentCurrencyTest.php for the
  // backend side of this contract.

  it('shows the workspace\'s single contract currency as static text and sends it with a payment request', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockInitialLoad([], [egpContract]);
    mock.onPost('/workspaces/9/payments/request').reply(200, {});

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<PaymentsTab wsId={9} client={client} />);

    await waitFor(() => expect(screen.getByText('Request Payment')).toBeInTheDocument());
    await user.click(screen.getByText('Request Payment'));

    // Static text, not a dropdown — nothing to pick when there's only one
    // possible currency.
    await waitFor(() => expect(screen.getByText('EGP')).toBeInTheDocument());
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    const amountInput = await screen.findByPlaceholderText('0.00');
    await user.type(amountInput, '400');
    await user.click(screen.getByText('Send Request'));

    await waitFor(() => {
      const reqCall = mock.history.post.find((r) => r.url === '/workspaces/9/payments/request');
      expect(reqCall).toBeTruthy();
      const body = JSON.parse(reqCall!.data);
      expect(body).toMatchObject({ amount: 400, currency: 'EGP' });
      expect(body.contract_id).toBeUndefined();
    });
  });

  it('requires picking a contract before sending a request when the workspace has multiple contract currencies', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockInitialLoad([], [egpContract, usdContract]);
    mock.onPost('/workspaces/9/payments/request').reply(200, {});

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<PaymentsTab wsId={9} client={client} />);

    await waitFor(() => expect(screen.getByText('Request Payment')).toBeInTheDocument());
    await user.click(screen.getByText('Request Payment'));

    const amountInput = await screen.findByPlaceholderText('0.00');
    await user.type(amountInput, '400');

    // No contract picked yet — sending would be ambiguous, so it's blocked
    // client-side (the backend would also 422 this).
    expect(screen.getByText('Send Request')).toBeDisabled();

    await user.selectOptions(screen.getByRole('combobox'), String(usdContract.id));
    expect(screen.getByText('Send Request')).not.toBeDisabled();
    await user.click(screen.getByText('Send Request'));

    await waitFor(() => {
      const reqCall = mock.history.post.find((r) => r.url === '/workspaces/9/payments/request');
      expect(reqCall).toBeTruthy();
      const body = JSON.parse(reqCall!.data);
      expect(body).toMatchObject({ amount: 400, currency: 'USD', contract_id: usdContract.id });
    });
  });

  it('sends the picked contract when scheduling an installment for a multi-currency workspace', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockInitialLoad([], [egpContract, usdContract]);
    mock.onPost('/workspaces/9/payments/schedule').reply(201, { payments: [] });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<PaymentsTab wsId={9} client={client} />);

    await waitFor(() => expect(screen.getByText('Schedule Payments')).toBeInTheDocument());
    await user.click(screen.getByText('Schedule Payments'));

    await user.type(await screen.findByPlaceholderText('0.00'), '200');
    await user.type(screen.getByLabelText('Due Date *'), '2026-10-01');

    expect(screen.getByText('+ Add Installment')).toBeDisabled();

    await user.selectOptions(screen.getByRole('combobox'), String(egpContract.id));
    expect(screen.getByText('+ Add Installment')).not.toBeDisabled();
    await user.click(screen.getByText('+ Add Installment'));

    await user.click(screen.getByText('Schedule (1 installments)'));

    await waitFor(() => {
      const schedCall = mock.history.post.find((r) => r.url === '/workspaces/9/payments/schedule');
      expect(schedCall).toBeTruthy();
      const body = JSON.parse(schedCall!.data);
      expect(body.installments[0]).toMatchObject({ amount: '200', currency: 'EGP', contract_id: egpContract.id });
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
