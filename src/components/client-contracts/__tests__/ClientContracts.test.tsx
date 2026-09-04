import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientContracts from '../ClientContracts';
import api from '@/lib/api';

// Characterization suite written BEFORE migrating ClientContracts (and, via
// its detail modal, ContractDetailModal) off manual useEffect+setState onto
// TanStack Query (DASHBOARD_ASSESSMENT.md Round 3, Contracts slice). Shares
// the same `/workspaces/:id/contracts` endpoint as ContractsTab.

let mock: MockAdapter;

const sentContract = {
  id: 701,
  workspace_id: 9,
  title: 'Retainer Agreement',
  status: 'sent',
  value: '5000',
  currency: 'SAR',
  clauses: [],
  required_documents: [
    { id: 1, name: 'ID Card', files: [] },
  ],
};

function mockLoad(overrides?: { contracts?: unknown[] }) {
  mock.onGet('/workspaces/9/contracts').reply(200, { contracts: overrides?.contracts ?? [sentContract] });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientContracts (characterization)', () => {
  it('loads contracts for the workspace on mount', async () => {
    mockLoad();
    renderWithIntl(<ClientContracts wsId={9} />);

    await waitFor(() => expect(screen.getByText('Retainer Agreement')).toBeInTheDocument());
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/contracts')).toBe(true);
  });

  it('shows the empty state when there are no contracts', async () => {
    mockLoad({ contracts: [] });
    renderWithIntl(<ClientContracts wsId={9} />);

    await waitFor(() => expect(screen.getByText('No contracts')).toBeInTheDocument());
  });

  it('opens the detail modal and shows required documents', async () => {
    mockLoad();
    const user = userEvent.setup();
    renderWithIntl(<ClientContracts wsId={9} />);

    await waitFor(() => expect(screen.getByText('View Details')).toBeInTheDocument());
    await user.click(screen.getByText('View Details'));

    await waitFor(() => expect(screen.getByText('Required Documents')).toBeInTheDocument());
    expect(screen.getByText('ID Card')).toBeInTheDocument();
    expect(screen.getByText('Document not yet uploaded')).toBeInTheDocument();
  });

  it('lets the client approve a sent contract via the confirm dialog', async () => {
    mockLoad();
    mock.onPost('/contracts/701/client-action').reply(200, {
      contract: { ...sentContract, status: 'company_approved' },
    });

    const user = userEvent.setup();
    renderWithIntl(<ClientContracts wsId={9} />);

    await waitFor(() => expect(screen.getByText('Approve', { selector: 'button' })).toBeInTheDocument());
    await user.click(screen.getByText('Approve', { selector: 'button' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/contracts/701/client-action');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({ action: 'approved' });
    });
  });

  it('uploads a required document from the detail modal and refetches the contract list', async () => {
    mockLoad();
    mock.onPost('/workspaces/9/files').reply(200, { file: { id: 800 } });

    const user = userEvent.setup();
    renderWithIntl(<ClientContracts wsId={9} />);

    await waitFor(() => expect(screen.getByText('View Details')).toBeInTheDocument());
    await user.click(screen.getByText('View Details'));

    await waitFor(() => expect(screen.getByText('Upload Document')).toBeInTheDocument());
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'id.pdf', { type: 'application/pdf' });
    await user.upload(fileInput, file);

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/files');
      expect(call).toBeTruthy();
      const form = call!.data as FormData;
      expect(form.get('contract_id')).toBe('701');
      expect(form.get('contract_required_document_id')).toBe('1');
    });
    // Successful upload triggers the parent's onUpload -> a full refetch of the contracts list.
    await waitFor(() => {
      expect(mock.history.get.filter((r) => r.url === '/workspaces/9/contracts').length).toBeGreaterThan(1);
    });
  });
});
