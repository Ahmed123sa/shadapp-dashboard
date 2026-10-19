import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientPayments from '../ClientPayments';
import api from '@/lib/api';
import { canDo } from '@/lib/client-auth';

// subuser-review-plan.md م٦ — canDo() is mocked directly (canDo calls
// hasSubUserPermission() through its own module's closure, so mocking that
// export instead would not be observed here). Defaults to true so the
// pre-existing characterization tests above keep behaving as before.
vi.mock('@/lib/client-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/client-auth')>()),
  canDo: vi.fn(),
}));

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
  vi.mocked(canDo).mockReturnValue(true);
});

afterEach(() => {
  mock.restore();
  vi.useRealTimers();
});

describe('ClientPayments (characterization)', () => {
  it('summarises contracts value, paid and remaining from the approved payments', async () => {
    const approved = { id: 1, workspace_id: 9, client_id: 1, amount: '2000', currency: 'SAR', method_type: 'instapay', status: 'approved', created_at: '2026-08-01T00:00:00Z' };
    mockLoad({ payments: [approved] });
    renderWithIntl(<ClientPayments wsId={9} />);

    await waitFor(() => expect(screen.getByText('Contracts value').parentElement).toHaveTextContent('5,000'));
    expect(screen.getByText('Paid so far').parentElement).toHaveTextContent('2,000');
    expect(screen.getByText('Remaining').parentElement).toHaveTextContent('3,000');
  });

  it('opens the payment sheet pre-filled with the contract value when there are no payments yet', async () => {
    mockLoad();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<ClientPayments wsId={9} />);

    await user.click(await screen.findByRole('button', { name: /Send a payment/ }));
    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveValue(5000));
  });

  it('lists the payment methods returned by the API as chips', async () => {
    mockLoad();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<ClientPayments wsId={9} />);

    await user.click(await screen.findByRole('button', { name: /Send a payment/ }));
    expect(screen.getByRole('radio', { name: 'Bank transfer' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'InstaPay' })).toBeInTheDocument();
  });

  it('submits a new payment as multipart form data with proof_files[] and adds it to the list', async () => {
    mockLoad();
    mock.onPost('/workspaces/9/payments').reply(200, {
      payment: { id: 900, workspace_id: 9, client_id: 1, amount: '5000', currency: 'SAR', method_type: 'bank_transfer', status: 'pending', created_at: '2026-08-01T00:00:00Z' },
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<ClientPayments wsId={9} />);

    await user.click(await screen.findByRole('button', { name: /Send a payment/ }));
    await user.click(screen.getByRole('radio', { name: 'Bank transfer' }));
    const input = screen.getByTestId('proof-input');
    fireEvent.change(input, { target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.pdf', { type: 'application/pdf' })] } });
    await user.click(screen.getByRole('button', { name: 'Send payment' }));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/payments');
      expect(call).toBeTruthy();
      const form = call!.data as FormData;
      expect(form.get('amount')).toBe('5000');
      expect(form.get('currency')).toBe('SAR');
      expect(form.get('method_type')).toBe('bank_transfer');
      expect(form.getAll('proof_files[]')).toHaveLength(2);
      expect(form.get('proof_file')).toBeNull();
    });
    // The new payment shows up in the list.
    await waitFor(() => expect(screen.getByText('Pending')).toBeInTheDocument());
  });

  it('lets a client edit a pending payment, pre-filling the sheet, and PUTs the update', async () => {
    const pending = { id: 901, workspace_id: 9, client_id: 1, amount: '3000', currency: 'SAR', method_type: 'instapay', status: 'pending', created_at: '2026-08-01T00:00:00Z' };
    mockLoad({ payments: [pending] });
    mock.onPost('/workspaces/9/payments/901').reply(200, {
      payment: { ...pending, amount: '3500' },
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<ClientPayments wsId={9} />);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));

    const amountInput = await screen.findByDisplayValue('3000');
    await user.clear(amountInput);
    await user.type(amountInput, '3500');
    await user.click(screen.getByRole('button', { name: 'Send payment' }));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/payments/901');
      expect(call).toBeTruthy();
      const form = call!.data as FormData;
      expect(form.get('amount')).toBe('3500');
      expect(form.get('_method')).toBe('PUT');
      expect(form.get('method_type')).toBe('instapay');
    });
  });

  it('a scheduled installment gets an Upload receipt action that PUTs the existing payment', async () => {
    const scheduled = { id: 905, workspace_id: 9, client_id: 1, amount: '2500', currency: 'SAR', method_type: 'scheduled', status: 'scheduled', due_date: '2026-11-01', installment_label: 'Second payment', created_at: '2026-08-01T00:00:00Z' };
    mockLoad({ payments: [scheduled] });
    mock.onPost('/workspaces/9/payments/905').reply(200, { payment: { ...scheduled, status: 'pending' } });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithIntl(<ClientPayments wsId={9} />);

    expect(await screen.findByText('Second payment')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Upload receipt' }));
    await user.click(screen.getByRole('radio', { name: 'InstaPay' }));
    fireEvent.change(screen.getByTestId('proof-input'), { target: { files: [new File(['r'], 'r.jpg', { type: 'image/jpeg' })] } });
    await user.click(screen.getByRole('button', { name: 'Send payment' }));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/payments/905');
      expect(call).toBeTruthy();
      const form = call!.data as FormData;
      expect(form.get('_method')).toBe('PUT');
      expect(form.getAll('proof_files[]')).toHaveLength(1);
    });
  });

  // payments-fixes-2-plan.md ت٢ — rejection_reason used to fall back to
  // notes whenever it was empty, so a manager's own note from requesting the
  // payment ("First installment") was mislabeled as their rejection reason
  // when they rejected it without typing one.
  it('does not show "Rejection Reason" from the request note when the manager rejected without one', async () => {
    const rejected = { id: 903, workspace_id: 9, client_id: 1, amount: '1200', currency: 'SAR', method_type: 'bank_transfer', status: 'rejected', rejection_reason: null, notes: 'First installment', created_at: '2026-08-01T00:00:00Z' };
    mockLoad({ payments: [rejected] });
    renderWithIntl(<ClientPayments wsId={9} />);

    await waitFor(() => expect(screen.getByText('Rejected')).toBeInTheDocument());
    expect(screen.queryByText('Rejection Reason:')).not.toBeInTheDocument();
    expect(screen.getByText('Notes:')).toBeInTheDocument();
    expect(screen.getByText('First installment')).toBeInTheDocument();
  });

  it('still shows the real rejection reason when the manager gave one', async () => {
    const rejected = { id: 904, workspace_id: 9, client_id: 1, amount: '1200', currency: 'SAR', method_type: 'bank_transfer', status: 'rejected', rejection_reason: 'Unclear proof image', notes: 'First installment', created_at: '2026-08-01T00:00:00Z' };
    mockLoad({ payments: [rejected] });
    renderWithIntl(<ClientPayments wsId={9} />);

    await waitFor(() => expect(screen.getByText('Rejection Reason:')).toBeInTheDocument());
    expect(screen.getByText('Unclear proof image')).toBeInTheDocument();
    expect(screen.getByText('Notes:')).toBeInTheDocument();
    expect(screen.getByText('First installment')).toBeInTheDocument();
  });

  // subuser-review-plan.md م٦ — uploading/re-uploading a payment proof maps
  // to can_upload_payment_proof; a sub-user without it must not see the
  // submission sheet or the per-payment upload/edit actions.
  describe('sub-user action gating (م٦)', () => {
    it('shows the owner-only message and no send button when can_upload_payment_proof is false', async () => {
      vi.mocked(canDo).mockReturnValue(false);
      mockLoad();
      renderWithIntl(<ClientPayments wsId={9} />);

      await waitFor(() => expect(screen.getByText('This action needs approval from the account owner or a user with permission')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /Send a payment/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
    });

    it('hides the per-payment edit/upload action when can_upload_payment_proof is false', async () => {
      vi.mocked(canDo).mockReturnValue(false);
      const pending = { id: 901, workspace_id: 9, client_id: 1, amount: '3000', currency: 'SAR', method_type: 'instapay', status: 'pending', created_at: '2026-08-01T00:00:00Z' };
      mockLoad({ payments: [pending] });
      renderWithIntl(<ClientPayments wsId={9} />);

      await waitFor(() => expect(screen.getByText('Pending')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('offers to send a payment when can_upload_payment_proof is true', async () => {
      vi.mocked(canDo).mockReturnValue(true);
      mockLoad();
      renderWithIntl(<ClientPayments wsId={9} />);

      expect(await screen.findByRole('button', { name: /Send a payment/ })).toBeInTheDocument();
      expect(screen.queryByText('This action needs approval from the account owner or a user with permission')).not.toBeInTheDocument();
    });
  });
});
