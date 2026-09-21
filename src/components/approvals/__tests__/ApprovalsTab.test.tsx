import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ApprovalsTab from '../ApprovalsTab';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// Characterization suite written BEFORE migrating ApprovalsTab off manual
// useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md Round 3,
// Approvals slice). Pins down current API calls + rendered/updated state so
// the migration can be checked against this file instead of assumptions.

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

let mock: MockAdapter;

const pendingApproval = {
  id: 55,
  workspace_id: 9,
  title: 'Logo Approval',
  description: 'Please review the new logo',
  reference_no: 'APR-001',
  status: 'pending',
  files: [],
};

function mockLoad(overrides?: { approvals?: unknown[] }) {
  mock.onGet('/workspaces/9/approvals').reply(200, {
    approvals: overrides?.approvals ?? [pendingApproval],
  });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ApprovalsTab (characterization)', () => {
  it('loads approvals for the workspace on mount', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad();
    renderWithIntl(<ApprovalsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Logo Approval')).toBeInTheDocument());
    expect(screen.getByText('Ref: APR-001', { exact: false })).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/approvals')).toBe(true);
  });

  it('shows the new-approval form for a non-super-admin', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad();
    renderWithIntl(<ApprovalsTab wsId={9} />);
    await waitFor(() => expect(screen.getByText('New Approval Request')).toBeInTheDocument());
  });

  it('hides the new-approval form for a super admin', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 2, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
    mockLoad();
    renderWithIntl(<ApprovalsTab wsId={9} />);
    await waitFor(() => expect(screen.getByText('Logo Approval')).toBeInTheDocument());
    expect(screen.queryByText('New Approval Request')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no approvals', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad({ approvals: [] });
    renderWithIntl(<ApprovalsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('No approval requests')).toBeInTheDocument());
  });

  it('sends a new approval request with a title and prepends it to the list', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad({ approvals: [] });
    mock.onPost('/workspaces/9/approvals').reply(200, {
      approval: { id: 900, workspace_id: 9, title: 'New Budget', description: '', reference_no: 'APR-900', status: 'pending', files: [] },
    });

    const user = userEvent.setup();
    renderWithIntl(<ApprovalsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('New Approval Request')).toBeInTheDocument());
    const titleInput = screen.getByPlaceholderText('Approval request title *');
    await user.type(titleInput, 'New Budget');
    await user.click(screen.getByText('Send Approval Request'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/approvals');
      expect(call).toBeTruthy();
      const form = call!.data as FormData;
      expect(form.get('title')).toBe('New Budget');
    });
    await waitFor(() => expect(screen.getByText('New Budget')).toBeInTheDocument());
    // Form resets after a successful send.
    expect((screen.getByPlaceholderText('Approval request title *') as HTMLInputElement).value).toBe('');
  });
});
