import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientPayments from '../ClientPayments';
import api from '@/lib/api';

// Characterization suite written BEFORE migrating ClientPayments off manual
// useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md Round 3).
// This component is riskier than PaymentsTab to migrate: its load effect
// doesn't just populate a list, it also *initializes form state* (amount,
// currency) as a one-time side effect of the fetch response. These tests
// pin that behavior down before touching it.

let mock: MockAdapter;

const payableContract = {
  id: 1,
  workspace_id: 9,
  title: 'Retainer Agreement',
  status: 'company_approved',
  value: '5000',
  currency: 'SAR',
  created_by: 1,
  clauses: [],
};

function mockLoad(overrides?: { payments?: unknown[]; contracts?: unknown[]; methods?: string[]; taxSummary?: unknown }) {
  mock.onGet('/workspaces/9/payments').reply(200, {
    payments: overrides?.payments ?? [],
    available_methods: overrides?.methods ?? ['bank_transfer', 'instapay'],
    tax_summary: overrides?.taxSummary ?? null,
  });
  mock.onGet('/workspaces/9/contracts').reply(200, {
    contracts: overrides?.contracts ?? [payableContract],
  });
}

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  mock.restore();
  vi.useRealTimers();
});

describe('ClientPayments (characterization)', () => {
  it('pre-fills the amount from the payable contract value when there are no payments yet', async () => {
    mockLoad();
    renderWithIntl(<ClientPayments wsId={9} />);

    const amountInput = await screen.findByPlaceholderText('Amount') as HTMLInputElement;
    await waitFor(() => expect(amountInput.value).toBe('5000'));
  });

  it('lists available payment methods returned by the API', async () => {
    mockLoad();
    renderWithIntl(<ClientPayments wsId={9} />);

    await screen.findByPlaceholderText('Amount');
    expect(screen.getByText('Payment Method:')).toBeInTheDocument();
    expect(screen.getAllByText('Bank Transfer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Instapay').length).toBeGreaterThan(0);
  });

  it('submits a new payment proof as multipart form data and adds it to the list', async () => {
    mockLoad();
    mock.onPost('/workspaces/9/payments').reply(200, {
      payment: { id: 900, workspace_id: 9, client_id: 1, amount: '5000', currency: 'SAR', method_type: 'bank_transfer', status: 'pending', created_at: '2026-08-01T00:00:00Z' },
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<ClientPayments wsId={9} />);

    await screen.findByPlaceholderText('Amount');
    const methodSelects = screen.getAllByRole('combobox');
    // Single currency (SAR only) collapses to a display box, not a <select>,
    // so the only combobox on screen is the payment-method dropdown.
    await user.selectOptions(methodSelects[0], 'bank_transfer');
    await user.click(screen.getByText('Submit Payment Proof'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/payments');
      expect(call).toBeTruthy();
      const form = call!.data as FormData;
      expect(form.get('amount')).toBe('5000');
      expect(form.get('currency')).toBe('SAR');
      expect(form.get('method_type')).toBe('bank_transfer');
    });
  });

  it('lets a client edit a pending payment, pre-filling the form, and PUTs the update', async () => {
    const pending = { id: 901, workspace_id: 9, client_id: 1, amount: '3000', currency: 'SAR', method_type: 'instapay', status: 'pending', created_at: '2026-08-01T00:00:00Z' };
    mockLoad({ payments: [pending] });
    mock.onPost('/workspaces/9/payments/901').reply(200, {
      payment: { ...pending, amount: '3500' },
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<ClientPayments wsId={9} />);

    await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
    await user.click(screen.getByText('Edit'));

    const amountInput = await screen.findByDisplayValue('3000');
    await user.clear(amountInput);
    await user.type(amountInput, '3500');
    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/payments/901');
      expect(call).toBeTruthy();
      const form = call!.data as FormData;
      expect(form.get('amount')).toBe('3500');
      expect(form.get('_method')).toBe('PUT');
    });
  });

  it('shows the pending-payment notice with the required amount instead of the contract notice', async () => {
    const pending = { id: 902, workspace_id: 9, client_id: 1, amount: '1200', currency: 'SAR', method_type: '', status: 'pending', created_at: '2026-08-01T00:00:00Z' };
    mockLoad({ payments: [pending] });
    renderWithIntl(<ClientPayments wsId={9} />);

    await waitFor(() => expect(screen.getByText('Payment of 1200 SAR is required')).toBeInTheDocument());
  });
});
