import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ContractsTab from '../ContractsTab';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { showToast } from '@/components/ToastNotification';

// A contract can be deleted only while it is a draft (saved, never sent), and
// only after the manager confirms.

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));
vi.mock('@/components/ToastNotification', () => ({ showToast: vi.fn() }));

let mock: MockAdapter;

const base = { workspace_id: 9, contract_type: 'main', value: '1000', currency: 'SAR', clauses: [] };
const draft = { ...base, id: 801, title: 'Draft deal', status: 'draft' };
const sent = { ...base, id: 802, title: 'Sent deal', status: 'sent' };
const editRequested = { ...base, id: 803, title: 'Asked deal', status: 'edit_requested' };
const approved = { ...base, id: 804, title: 'Approved deal', status: 'company_approved' };

function mockLoad(contracts: unknown[]) {
  mock.onGet('/workspaces/9/contracts').reply(200, { contracts });
  mock.onGet('/contract-clause-templates').reply(200, { templates: [] });
  mock.onGet('/settings').reply(200, { settings: { show_contract_dates: { value: true } } });
}

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('deleting a draft contract', () => {
  it('offers Delete on the draft only', async () => {
    mockLoad([draft, sent, editRequested, approved]);
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Draft deal')).toBeInTheDocument());
    expect(screen.getByTestId('delete-contract-801')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-contract-802')).toBeNull();
    expect(screen.queryByTestId('delete-contract-803')).toBeNull();
    expect(screen.queryByTestId('delete-contract-804')).toBeNull();
  });

  it('asks first, and deletes only after the confirmation', async () => {
    // The list is refetched after the delete; the server then no longer has it.
    let deleted = false;
    mock.onGet('/workspaces/9/contracts').reply(() => [200, { contracts: deleted ? [] : [draft] }]);
    mock.onGet('/contract-clause-templates').reply(200, { templates: [] });
    mock.onGet('/settings').reply(200, { settings: { show_contract_dates: { value: true } } });
    mock.onDelete('/contracts/801').reply(() => { deleted = true; return [200, { message: 'ok' }]; });
    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await user.click(await screen.findByTestId('delete-contract-801'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this contract?')).toBeInTheDocument();
    expect(within(dialog).getByText(/"Draft deal" has not been sent yet/)).toBeInTheDocument();
    expect(mock.history.delete).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Delete contract' }));

    await waitFor(() => expect(mock.history.delete.map((r) => r.url)).toEqual(['/contracts/801']));
    await waitFor(() => expect(screen.queryByText('Draft deal')).toBeNull());
  });

  it('cancelling the confirmation deletes nothing', async () => {
    mockLoad([draft]);
    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await user.click(await screen.findByTestId('delete-contract-801'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mock.history.delete).toHaveLength(0);
    expect(screen.getByText('Draft deal')).toBeInTheDocument();
  });

  it('shows the server reason when the contract was sent meanwhile, and keeps it', async () => {
    mockLoad([draft]);
    mock.onDelete('/contracts/801').reply(422, { message: 'Already sent, cannot delete.', code: 'contract_not_deletable' });
    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await user.click(await screen.findByTestId('delete-contract-801'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete contract' }));

    await waitFor(() => expect(vi.mocked(showToast)).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Already sent, cannot delete.' }),
    ));
    expect(screen.getByText('Draft deal')).toBeInTheDocument();
  });

  it('speaks Arabic', async () => {
    mockLoad([draft]);
    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />, { locale: 'ar' });

    await user.click(await screen.findByTestId('delete-contract-801'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('حذف العقد؟')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'احذف العقد' })).toBeInTheDocument();
  });

  it('a super admin sees no Delete button', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 2, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
    mockLoad([draft]);
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Draft deal')).toBeInTheDocument());
    expect(screen.queryByTestId('delete-contract-801')).toBeNull();
  });
});
