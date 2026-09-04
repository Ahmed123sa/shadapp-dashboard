import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ContractsTab from '../ContractsTab';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// Characterization suite written BEFORE migrating ContractsTab off manual
// useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md Round 3,
// Contracts slice). Pins down current API calls + rendered/updated state so
// the migration can be checked against this file instead of assumptions.

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

let mock: MockAdapter;

const draftContract = {
  id: 601,
  workspace_id: 9,
  title: 'Retainer Agreement',
  status: 'draft',
  contract_type: 'main',
  value: '5000',
  currency: 'SAR',
  clauses: [],
};

function mockLoad(overrides?: { contracts?: unknown[]; templates?: unknown[] }) {
  mock.onGet('/workspaces/9/contracts').reply(200, { contracts: overrides?.contracts ?? [draftContract] });
  mock.onGet('/contract-clause-templates').reply(200, { templates: overrides?.templates ?? [] });
  mock.onGet('/settings').reply(200, { settings: { show_contract_dates: { value: true } } });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ContractsTab (characterization)', () => {
  it('loads contracts, templates and settings for the workspace on mount', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockLoad();
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Retainer Agreement')).toBeInTheDocument());
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/contracts')).toBe(true);
    expect(mock.history.get.some((r) => r.url === '/contract-clause-templates')).toBe(true);
    expect(mock.history.get.some((r) => r.url === '/settings')).toBe(true);
  });

  it('shows the empty state for a super admin when there are no contracts', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', role: 'super_admin' });
    mockLoad({ contracts: [] });
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('No contracts')).toBeInTheDocument());
  });

  it('lets a non-super-admin create a new contract', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockLoad({ contracts: [] });
    mock.onPost('/workspaces/9/contracts').reply(200, {
      contract: { id: 900, workspace_id: 9, title: 'New Deal', status: 'draft', contract_type: 'main', value: '', currency: 'SAR', clauses: [] },
    });

    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('+ + New Contract')).toBeInTheDocument());
    await user.click(screen.getByText('+ + New Contract'));
    await user.type(screen.getByPlaceholderText('Contract title'), 'New Deal');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/contracts');
      expect(call).toBeTruthy();
      const body = JSON.parse(call!.data);
      expect(body.title).toBe('New Deal');
      expect(body.contract_type).toBe('main');
    });
    await waitFor(() => expect(screen.getByText('New Deal')).toBeInTheDocument());
  });

  it('lets a non-super-admin send a draft contract', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
    mockLoad();
    mock.onPost('/contracts/601/send').reply(200, {
      contract: { ...draftContract, status: 'sent' },
    });

    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Send')).toBeInTheDocument());
    await user.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(mock.history.post.some((r) => r.url === '/contracts/601/send')).toBe(true);
    });
    await waitFor(() => expect(screen.queryByText('Send')).not.toBeInTheDocument());
  });

  it('lets a super admin company-approve a client-approved contract with a typed signature', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', role: 'super_admin' });
    mockLoad({ contracts: [{ ...draftContract, status: 'client_approved' }] });
    mock.onGet('/auth/me').reply(200, { user: { id: 1, signature_data: null } });
    mock.onPost('/contracts/601/company-approve').reply(200, {
      contract: { ...draftContract, status: 'company_approved' },
    });

    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Company Approval')).toBeInTheDocument());
    await user.click(screen.getByText('Company Approval'));

    await waitFor(() => expect(screen.getByText('Company Contract Approval')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('Type your name here...'), 'Jane Doe');
    await user.click(screen.getByText('Approve & Sign'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/contracts/601/company-approve');
      expect(call).toBeTruthy();
      const body = JSON.parse(call!.data);
      expect(body.signature).toBe('Jane Doe');
    });
  });
});
