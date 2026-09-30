import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientApprovals from '../ClientApprovals';
import api from '@/lib/api';
import { canDo } from '@/lib/client-auth';

// subuser-review-plan.md م٦ — canDo() is mocked directly (it calls
// hasSubUserPermission() through its own module's closure, so mocking that
// export instead would not be observed here). Defaults to true so the
// pre-existing characterization tests above keep behaving as before.
vi.mock('@/lib/client-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/client-auth')>()),
  canDo: vi.fn(),
}));

// Characterization suite written BEFORE migrating ClientApprovals off manual
// useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md Round 3,
// Approvals slice). Shares the same `/workspaces/:id/approvals` endpoint as
// ApprovalsTab, so this pins down the client-facing view's own behavior
// (respond via ConfirmDialog, no create form) before the two share a cache.

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
  vi.mocked(canDo).mockReturnValue(true);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientApprovals (characterization)', () => {
  it('loads approvals for the workspace on mount', async () => {
    mockLoad();
    renderWithIntl(<ClientApprovals wsId={9} clientId={1} />);

    await waitFor(() => expect(screen.getByText('Logo Approval')).toBeInTheDocument());
    expect(screen.getByText('Ref: APR-001', { exact: false })).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/approvals')).toBe(true);
  });

  it('shows the empty state when there are no approvals', async () => {
    mockLoad({ approvals: [] });
    renderWithIntl(<ClientApprovals wsId={9} clientId={1} />);

    await waitFor(() => expect(screen.getByText('No approval requests')).toBeInTheDocument());
  });

  it('lets the client approve a pending approval via the confirm dialog', async () => {
    mockLoad();
    mock.onPost('/approvals/55/respond').reply(200, {
      approval: { ...pendingApproval, status: 'approved' },
    });

    const user = userEvent.setup();
    renderWithIntl(<ClientApprovals wsId={9} clientId={1} />);

    await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument());
    await user.click(screen.getByText('Approve'));

    await waitFor(() => expect(screen.getByText('Your saved e-signature will be used. Are you sure?')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/approvals/55/respond');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({ action: 'approved' });
    });
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
  });

  it('lets the client request an edit via the confirm dialog', async () => {
    mockLoad();
    mock.onPost('/approvals/55/respond').reply(200, {
      approval: { ...pendingApproval, status: 'edit_requested' },
    });

    const user = userEvent.setup();
    renderWithIntl(<ClientApprovals wsId={9} clientId={1} />);

    await waitFor(() => expect(screen.getByText('Request Edit')).toBeInTheDocument());
    await user.click(screen.getByText('Request Edit'));

    await waitFor(() => expect(screen.getByText('Confirm edit request for this approval?')).toBeInTheDocument());
    await user.click(screen.getByText('Confirm'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/approvals/55/respond');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({ action: 'edit_requested' });
    });
    await waitFor(() => expect(screen.getByText('Edit Requested')).toBeInTheDocument());
  });

  // subuser-review-plan.md م٦ — responding to an approval request maps to
  // can_respond_approvals; a sub-user without it must not see the
  // approve/edit-request buttons on a pending approval.
  describe('sub-user action gating (م٦)', () => {
    it('hides the respond buttons and shows the owner-only message when can_respond_approvals is false', async () => {
      vi.mocked(canDo).mockReturnValue(false);
      mockLoad();
      renderWithIntl(<ClientApprovals wsId={9} clientId={1} />);

      await waitFor(() => expect(screen.getByText('Logo Approval')).toBeInTheDocument());
      expect(screen.queryByText('Approve')).not.toBeInTheDocument();
      expect(screen.queryByText('Request Edit')).not.toBeInTheDocument();
      expect(screen.getByText('This action needs approval from the account owner or a user with permission')).toBeInTheDocument();
    });

    it('shows the respond buttons when can_respond_approvals is true', async () => {
      vi.mocked(canDo).mockReturnValue(true);
      mockLoad();
      renderWithIntl(<ClientApprovals wsId={9} clientId={1} />);

      await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument());
      expect(screen.getByText('Request Edit')).toBeInTheDocument();
    });
  });
});
