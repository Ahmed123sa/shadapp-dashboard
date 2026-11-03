import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ContractDocsReview from '../ContractDocsReview';
import api from '@/lib/api';
import { canDo } from '@/lib/client-auth';

vi.mock('@/lib/client-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/client-auth')>()),
  canDo: vi.fn(),
}));

let mock: MockAdapter;

const file = (id: number, status: string, extra: Record<string, unknown> = {}) => ({
  id, status, name: `f${id}.pdf`, file_url: `/f/${id}.pdf`, ...extra,
});

function contracts(docs: unknown[], status = 'client_approved') {
  mock.onGet('/workspaces/9/contracts').reply(200, {
    contracts: [{ id: 701, workspace_id: 9, title: 'Retainer', status, clauses: [], required_documents: docs }],
  });
}

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(canDo).mockReturnValue(true);
});

describe('ContractDocsReview', () => {
  it('shows each required document with where it stands and the reason a rejected one was refused', async () => {
    contracts([
      { id: 1, name: 'Commercial Register', is_required: true, files: [file(5, 'pending')] },
      { id: 2, name: 'National ID', is_required: true, files: [file(6, 'rejected', { rejection_reason: 'Blurry copy' })] },
    ]);
    renderWithIntl(<ContractDocsReview wsId={9} />);

    expect(await screen.findByText('Commercial Register')).toBeInTheDocument();
    expect(screen.getByText('Under review')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Rejected: Blurry copy')).toBeInTheDocument();
  });

  it('uploads a replacement for the rejected document against the same contract and document', async () => {
    contracts([
      { id: 2, name: 'National ID', is_required: true, files: [file(6, 'rejected', { rejection_reason: 'Blurry copy' })] },
    ]);
    mock.onPost('/workspaces/9/files').reply(201, { file: { id: 7 } });
    const user = userEvent.setup();
    renderWithIntl(<ContractDocsReview wsId={9} />);

    const input = await screen.findByLabelText('Upload replacement National ID');
    await user.upload(input, new File(['x'], 'id-new.pdf', { type: 'application/pdf' }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    const body = mock.history.post[0].data as FormData;
    expect(body.get('contract_id')).toBe('701');
    expect(body.get('contract_required_document_id')).toBe('2');
  });

  it('offers no upload for a document that is only waiting for review', async () => {
    contracts([{ id: 1, name: 'Commercial Register', is_required: true, files: [file(5, 'pending')] }]);
    renderWithIntl(<ContractDocsReview wsId={9} />);

    await screen.findByText('Commercial Register');
    expect(screen.queryByLabelText(/Upload/)).toBeNull();
  });

  it('draws nothing once every required document is accepted', async () => {
    contracts([{ id: 1, name: 'Commercial Register', is_required: true, files: [file(5, 'approved')] }]);
    renderWithIntl(<ContractDocsReview wsId={9} />);

    await waitFor(() => expect(mock.history.get.length).toBeGreaterThan(0));
    expect(screen.queryByText('Documents under review')).toBeNull();
  });

  it('draws nothing for a contract that is not the one asked for', async () => {
    contracts([{ id: 2, name: 'National ID', is_required: true, files: [] }]);
    renderWithIntl(<ContractDocsReview wsId={9} contractId={999} />);

    await waitFor(() => expect(mock.history.get.length).toBeGreaterThan(0));
    expect(screen.queryByText('National ID')).toBeNull();
  });

  it('hides the upload from a sub-user without file upload permission', async () => {
    vi.mocked(canDo).mockReturnValue(false);
    contracts([{ id: 2, name: 'National ID', is_required: true, files: [file(6, 'rejected', { rejection_reason: 'Blurry' })] }]);
    renderWithIntl(<ContractDocsReview wsId={9} />);

    await screen.findByText('National ID');
    expect(screen.queryByLabelText(/Upload/)).toBeNull();
  });
});
