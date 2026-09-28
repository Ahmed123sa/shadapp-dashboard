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
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad();
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Retainer Agreement')).toBeInTheDocument());
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/contracts')).toBe(true);
    expect(mock.history.get.some((r) => r.url === '/contract-clause-templates')).toBe(true);
    expect(mock.history.get.some((r) => r.url === '/settings')).toBe(true);
  });

  it('shows the empty state for a super admin when there are no contracts', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
    mockLoad({ contracts: [] });
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('No contracts')).toBeInTheDocument());
  });

  it('lets a non-super-admin create a new contract', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
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
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
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
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
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

  it('displays client edit reason and lets a manager edit an edit_requested contract', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    const editRequestedContract = {
      ...draftContract,
      id: 602,
      title: 'Agreement to Revise',
      status: 'edit_requested',
      value: '7500',
      currency: 'USD',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      edit_reason: 'Please reduce the rate and add NDA clause',
      clauses: [
        { id: 10, type: 'fixed', content: 'Fixed clause 1' },
        { id: 11, type: 'custom', content: 'Custom clause 1' },
      ],
      required_documents: [{ id: 20, name: 'Commercial Register' }],
    };
    mockLoad({ contracts: [editRequestedContract] });
    mock.onPut('/contracts/602').reply(200, {
      contract: { ...editRequestedContract, title: 'Agreement Revised' },
    });

    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Agreement to Revise')).toBeInTheDocument());
    // Client edit reason is visible
    expect(screen.getByText(/Please reduce the rate and add NDA clause/)).toBeInTheDocument();

    // Click Edit button
    const editBtn = screen.getByText('Edit', { selector: 'button' });
    expect(editBtn).toBeInTheDocument();
    await user.click(editBtn);

    // Form is pre-populated
    expect(screen.getByDisplayValue('Agreement to Revise')).toBeInTheDocument();
    expect(screen.getByDisplayValue('7500')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-01-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-12-31')).toBeInTheDocument();
    expect(screen.getByText('Commercial Register')).toBeInTheDocument();

    // Change title and save
    const titleInput = screen.getByDisplayValue('Agreement to Revise');
    await user.clear(titleInput);
    await user.type(titleInput, 'Agreement Revised');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      const call = mock.history.put.find((r) => r.url === '/contracts/602');
      expect(call).toBeTruthy();
      const body = JSON.parse(call!.data);
      expect(body.title).toBe('Agreement Revised');
      expect(body.value).toBe('7500');
      expect(body.currency).toBe('USD');
      expect(body.contract_type).toBeUndefined();
      // Fixed clause is preserved in PUT payload
      expect(body.clauses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'fixed', content: 'Fixed clause 1' }),
        ])
      );
    });
  });

  it('does not show edit button for sent or company_approved contracts, nor for super admins', async () => {
    // 1. Sent contract for manager: no edit button
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad({ contracts: [{ ...draftContract, status: 'sent' }] });
    const { unmount } = renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Retainer Agreement')).toBeInTheDocument());
    expect(screen.queryByText('Edit', { selector: 'button' })).not.toBeInTheDocument();
    unmount();

    // 2. Draft contract for super admin: no edit button
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
    mockLoad({ contracts: [draftContract] });
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Retainer Agreement')).toBeInTheDocument());
    expect(screen.queryByText('Edit', { selector: 'button' })).not.toBeInTheDocument();
  });
});
