import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import api from '@/lib/api';
import { canDo } from '@/lib/client-auth';
import ReviewStage from '../stages/ReviewStage';
import PaymentStage from '../stages/PaymentStage';
import OnboardingTrack from '../OnboardingTrack';
import OnboardingAside, { supportLink } from '../OnboardingAside';

vi.mock('@/lib/client-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/client-auth')>()),
  canDo: vi.fn(),
}));
vi.mock('@/components/ToastNotification', () => ({ showToast: vi.fn() }));

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(canDo).mockReturnValue(true);
});
afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

const sentContract = (docs: unknown[] = []) => ({
  id: 3,
  workspace_id: 9,
  title: 'Menu & identity',
  status: 'sent',
  contract_type: 'main',
  value: '14500',
  currency: 'EGP',
  created_by: 1,
  clauses: [{ id: 1 }, { id: 2 }],
  required_documents: docs,
});

describe('OnboardingTrack', () => {
  it('marks earlier steps done, the current one now, and the rest plain', () => {
    const { container } = renderWithIntl(<OnboardingTrack step={2} />);
    const steps = Array.from(container.querySelectorAll('.tstep'));
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => (s.classList.contains('done') ? 'done' : s.classList.contains('now') ? 'now' : ''))).toEqual(['done', 'done', 'now', '', '', '']);
    expect(screen.getByText('Review & approve')).toBeInTheDocument();
  });
});

describe('OnboardingAside / supportLink', () => {
  it('builds the same WhatsApp link the mobile app uses (digits only, 00 prefix stripped)', () => {
    expect(supportLink('+20 100-123-4567', 'hi')).toBe('https://wa.me/201001234567?text=hi');
    expect(supportLink('00201001234567', 'x y')).toBe('https://wa.me/201001234567?text=x%20y');
    expect(supportLink('', 'hi')).toBeNull();
    expect(supportLink(null, 'hi')).toBeNull();
  });

  it('shows the manager and a support link when there is a phone', () => {
    renderWithIntl(<OnboardingAside step={1} manager={{ name: 'Taha Ahmed', phone: '+201001234567' }} company="Acme" />);
    expect(screen.getByText('Taha Ahmed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Contact support/ })).toHaveAttribute('href', expect.stringContaining('https://wa.me/201001234567'));
  });

  it('hides the support link when the manager has no phone', () => {
    renderWithIntl(<OnboardingAside step={1} manager={{ name: 'Taha Ahmed', phone: null }} company="Acme" />);
    expect(screen.getByText('Taha Ahmed')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Contact support/ })).not.toBeInTheDocument();
  });

  it('lists the six steps with the current one marked', () => {
    const { container } = renderWithIntl(<OnboardingAside step={4} manager={null} company="Acme" />);
    expect(container.querySelectorAll('.next li')).toHaveLength(6);
    expect(container.querySelector('.next li.now')).toHaveTextContent('Payment');
  });
});

describe('ReviewStage', () => {
  it('disables Approve until every required document is uploaded', async () => {
    mock.onGet('/workspaces/9/contracts').reply(200, {
      contracts: [sentContract([
        { id: 1, name: 'Commercial register', files: [{ id: 1, status: 'pending', file_url: 'a.pdf' }] },
        { id: 2, name: 'Tax card', files: [] },
      ])],
    });
    renderWithIntl(<ReviewStage wsId={9} onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Menu & identity')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Approve contract' })).toBeDisabled();
    expect(screen.getByText('Upload the missing document to approve.')).toBeInTheDocument();
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
    expect(screen.getByText('Missing')).toBeInTheDocument();
  });

  it('approves through the confirm dialog and reports the change', async () => {
    const onChanged = vi.fn();
    mock.onGet('/workspaces/9/contracts').reply(200, { contracts: [sentContract()] });
    mock.onPost('/contracts/3/client-action').reply(200, { contract: { id: 3, status: 'client_approved' } });
    const user = userEvent.setup();
    renderWithIntl(<ReviewStage wsId={9} onChanged={onChanged} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve contract' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Approve contract' }));
    await user.click(await screen.findByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ action: 'approved' });
  });

  it('sends an edit request with the typed reason', async () => {
    mock.onGet('/workspaces/9/contracts').reply(200, { contracts: [sentContract()] });
    mock.onPost('/contracts/3/client-action').reply(200, { contract: { id: 3, status: 'edit_requested' } });
    const user = userEvent.setup();
    renderWithIntl(<ReviewStage wsId={9} onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Request edit' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Request edit' }));
    await user.type(screen.getByLabelText('What would you like changed?'), 'Two instalments');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(mock.history.post.length).toBe(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ action: 'edit_requested', reason: 'Two instalments' });
  });

  it('hides Approve and says why when the user lacks can_approve_contracts', async () => {
    vi.mocked(canDo).mockImplementation((k: string) => k !== 'can_approve_contracts');
    mock.onGet('/workspaces/9/contracts').reply(200, { contracts: [sentContract()] });
    renderWithIntl(<ReviewStage wsId={9} onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('You don’t have permission to approve contracts.')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Approve contract' })).not.toBeInTheDocument();
  });

  it('uploads a missing required document to the workspace files endpoint', async () => {
    mock.onGet('/workspaces/9/contracts').reply(200, {
      contracts: [sentContract([{ id: 2, name: 'Tax card', files: [] }])],
    });
    mock.onPost('/workspaces/9/files').reply(200, { file: { id: 9 } });
    renderWithIntl(<ReviewStage wsId={9} onChanged={vi.fn()} />);

    const input = await screen.findByLabelText('Upload Tax card');
    fireEvent.change(input, { target: { files: [new File(['x'], 'tax.pdf', { type: 'application/pdf' })] } });

    await waitFor(() => expect(mock.history.post.length).toBe(1));
    const form = mock.history.post[0].data as FormData;
    expect(form.get('contract_id')).toBe('3');
    expect(form.get('contract_required_document_id')).toBe('2');
  });

  it('lists every file of a document, lets the uploader delete a pending one and add another', async () => {
    localStorage.setItem('client', JSON.stringify({ id: 5, company_name: 'Nile', contact_person: 'Mona', email: 'm@x.com', status: 'active', has_signed: true }));
    mock.onGet('/workspaces/9/contracts').reply(200, {
      contracts: [sentContract([{
        id: 2,
        name: 'Tax card',
        files: [
          { id: 11, status: 'pending', name: 'front.jpg', file_url: 'f.jpg', uploaded_by_type: 'App\\Models\\Client', uploaded_by_id: 5 },
          { id: 12, status: 'rejected', name: 'old.jpg', file_url: 'o.jpg', uploaded_by_type: 'App\\Models\\Client', uploaded_by_id: 5 },
          { id: 13, status: 'pending', name: 'by-team.jpg', file_url: 't.jpg', uploaded_by_type: 'App\\Models\\User', uploaded_by_id: 5 },
        ],
      }])],
    });
    mock.onDelete('/workspaces/9/files/11').reply(200, {});
    renderWithIntl(<ReviewStage wsId={9} onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('front.jpg')).toBeInTheDocument());
    expect(screen.getByText('old.jpg')).toBeInTheDocument();
    expect(screen.getByText('by-team.jpg')).toBeInTheDocument();
    // Only the client's own, not-approved files get a Delete.
    expect(screen.getByRole('button', { name: 'Delete front.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete old.jpg' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete by-team.jpg' })).not.toBeInTheDocument();
    // A live file is there, so the upload button now adds another one.
    expect(screen.getByText('Add another file')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete front.jpg' }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mock.history.delete.length).toBe(1));
    expect(mock.history.delete[0].url).toBe('/workspaces/9/files/11');
    localStorage.removeItem('client');
  });

  it('hides the upload button once a file of the document is approved', async () => {
    mock.onGet('/workspaces/9/contracts').reply(200, {
      contracts: [sentContract([{ id: 2, name: 'Tax card', files: [{ id: 11, status: 'approved', name: 'ok.jpg', file_url: 'k.jpg', uploaded_by_type: 'App\\Models\\Client', uploaded_by_id: 5 }] }])],
    });
    renderWithIntl(<ReviewStage wsId={9} onChanged={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('ok.jpg')).toBeInTheDocument());
    expect(screen.queryByLabelText('Upload Tax card')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });
});

describe('PaymentStage', () => {
  const payable = { id: 1, workspace_id: 9, title: 'Retainer', status: 'company_approved', value: '14500', currency: 'EGP', created_by: 1, clauses: [] };

  function load(extra: { payments?: unknown[]; tax?: unknown } = {}) {
    mock.onGet('/workspaces/9/payments').reply(200, {
      payments: extra.payments ?? [],
      available_methods: ['bank_transfer', 'instapay'],
      tax_summary: extra.tax ?? { contracts_total: 14500, tax_percentage: 14, tax_amount: 2030, grand_total: 16530 },
    });
    mock.onGet('/workspaces/9/contracts').reply(200, { contracts: [payable] });
  }

  it('shows the bill with tax, total and remaining, and prefills the total', async () => {
    load();
    renderWithIntl(<PaymentStage wsId={9} onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Corporate tax (14%)')).toBeInTheDocument());
    expect(screen.getByText('Contract value').parentElement).toHaveTextContent('14,500');
    expect(screen.getByText('Total').parentElement).toHaveTextContent('16,530');
    expect(screen.getByText('Remaining').parentElement).toHaveTextContent('16,530');
    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveValue(16530));
  });

  it('keeps Send disabled until a method is chosen AND a receipt is attached', async () => {
    load();
    const user = userEvent.setup();
    renderWithIntl(<PaymentStage wsId={9} onChanged={vi.fn()} />);

    const send = await screen.findByRole('button', { name: 'Send payment' });
    expect(send).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'InstaPay' }));
    expect(send).toBeDisabled();
    expect(screen.getByText('Attach a receipt (image or PDF) to send the payment.')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('proof-input'), { target: { files: [new File(['1'], 'r.jpg', { type: 'image/jpeg' })] } });
    expect(send).toBeEnabled();
  });

  it('adds several receipts, removes one, and sends the rest as proof_files[]', async () => {
    load();
    mock.onPost('/workspaces/9/payments').reply(200, { payment: { id: 5, status: 'pending', amount: '16530' } });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<PaymentStage wsId={9} onChanged={onChanged} />);

    await user.click(await screen.findByRole('radio', { name: 'InstaPay' }));
    const input = screen.getByTestId('proof-input');
    fireEvent.change(input, { target: { files: [new File(['1'], 'one.jpg', { type: 'image/jpeg' }), new File(['2'], 'two.pdf', { type: 'application/pdf' })] } });
    fireEvent.change(input, { target: { files: [new File(['3'], 'three.png', { type: 'image/png' })] } });

    expect(screen.getByText('one.jpg')).toBeInTheDocument();
    expect(screen.getByText('two.pdf')).toBeInTheDocument();
    expect(screen.getByText('three.png')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove two.pdf' }));
    expect(screen.queryByText('two.pdf')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send payment' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    const form = mock.history.post[0].data as FormData;
    expect(form.getAll('proof_files[]').map((f) => (f as File).name)).toEqual(['one.jpg', 'three.png']);
    expect(form.get('proof_file')).toBeNull();
    expect(form.get('method_type')).toBe('instapay');
    expect(form.get('amount')).toBe('16530');
    expect(form.get('currency')).toBe('EGP');
  });

  it('re-uploading a rejected payment edits it with PUT semantics', async () => {
    load({ payments: [{ id: 8, status: 'rejected', amount: '16530', currency: 'EGP', method_type: 'instapay', rejection_reason: 'Blurry receipt' }] });
    mock.onPost('/workspaces/9/payments/8').reply(200, { payment: { id: 8, status: 'pending', amount: '16530' } });
    const user = userEvent.setup();
    renderWithIntl(<PaymentStage wsId={9} onChanged={vi.fn()} />);

    expect(await screen.findByText('Rejected: Blurry receipt')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Re-upload receipt' }));
    expect(screen.getByText('Re-upload your payment')).toBeInTheDocument();
    // A rejected payment needs a NEW receipt before it can go back for review.
    expect(screen.getByRole('button', { name: 'Send payment' })).toBeDisabled();
    fireEvent.change(screen.getByTestId('proof-input'), { target: { files: [new File(['n'], 'new.jpg', { type: 'image/jpeg' })] } });
    await user.click(screen.getByRole('button', { name: 'Send payment' }));

    await waitFor(() => expect(mock.history.post.length).toBe(1));
    const form = mock.history.post[0].data as FormData;
    expect(form.get('_method')).toBe('PUT');
  });

  it('shows a notice instead of the form without can_upload_payment_proof', async () => {
    vi.mocked(canDo).mockReturnValue(false);
    load();
    renderWithIntl(<PaymentStage wsId={9} onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('You don’t have permission to upload payment receipts.')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Send payment' })).not.toBeInTheDocument();
  });
});
