import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import api from '@/lib/api';
import ClientApprovals from '@/components/client-approvals/ClientApprovals';
import ClientChat from '@/components/client-chat/ClientChat';
import ClientContracts from '@/components/client-contracts/ClientContracts';
import ClientFiles from '@/components/client-files/ClientFiles';
import ClientPayments from '@/components/client-payments/ClientPayments';
import { canDo } from '@/lib/client-auth';
import { CLIENT_TABS, visibleClientTabs } from '@/lib/client-tabs';

vi.mock('@/lib/client-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/client-auth')>()),
  canDo: vi.fn(),
}));
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToWorkspace: vi.fn(() => vi.fn()),
}));

// Permission matrix (ع٧): each of the 11 keys must show/hide exactly the
// tab or control it owns. `grant(only)` gives a sub-user ONLY the listed keys.
const ALL_KEYS = [
  'can_chat', 'can_view_contracts', 'can_approve_contracts', 'can_view_payments', 'can_upload_payment_proof',
  'can_view_approvals', 'can_respond_approvals', 'can_view_files', 'can_upload_files', 'can_view_meetings', 'can_join_meetings',
];
const grant = (...only: string[]) => vi.mocked(canDo).mockImplementation((k: string) => only.includes(k));

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(api); grant(); });
afterEach(() => { mock.restore(); vi.clearAllMocks(); });

describe('permission matrix — tabs', () => {
  const TAB_KEYS: Record<string, string> = {
    contracts: 'can_view_contracts', payments: 'can_view_payments', chat: 'can_chat',
    approvals: 'can_view_approvals', files: 'can_view_files', meetings: 'can_view_meetings',
  };
  it.each(Object.entries(TAB_KEYS))('%s tab needs %s and nothing else', (tab, key) => {
    const only = visibleClientTabs((k) => k === key).map((t) => t.key);
    expect(only).toEqual([tab]);
    const others = visibleClientTabs((k) => k !== key).map((t) => t.key);
    expect(others).not.toContain(tab);
  });
  it('the 6 tabs plus 5 action keys account for all 11 permissions', () => {
    const tabKeys = CLIENT_TABS.map((t) => t.perm);
    const actionKeys = ['can_approve_contracts', 'can_upload_payment_proof', 'can_respond_approvals', 'can_upload_files', 'can_join_meetings'];
    expect([...tabKeys, ...actionKeys].sort()).toEqual([...ALL_KEYS].sort());
  });
});

describe('permission matrix — actions', () => {
  it('can_approve_contracts gates approve / edit-request buttons', async () => {
    mock.onGet('/workspaces/9/contracts').reply(200, { contracts: [{ id: 1, workspace_id: 9, title: 'Main', status: 'sent', value: '100', currency: 'SAR', created_at: '2026-01-01T00:00:00Z', required_documents: [] }] });
    grant('can_view_contracts');
    const { unmount } = renderWithIntl(<ClientContracts wsId={9} />);
    await waitFor(() => expect(screen.getByText('Main')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    unmount();

    grant('can_view_contracts', 'can_approve_contracts');
    renderWithIntl(<ClientContracts wsId={9} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument());
  });

  it('can_respond_approvals gates the approval buttons', async () => {
    mock.onGet('/workspaces/9/approvals').reply(200, { approvals: [{ id: 3, title: 'Logo', status: 'pending', reference_no: 'A-1', files: [] }] });
    grant('can_view_approvals');
    const { unmount } = renderWithIntl(<ClientApprovals wsId={9} clientId={7} />);
    await waitFor(() => expect(screen.getByText('Logo')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    unmount();

    grant('can_view_approvals', 'can_respond_approvals');
    renderWithIntl(<ClientApprovals wsId={9} clientId={7} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument());
  });

  it('can_upload_files gates the upload button', async () => {
    mock.onGet('/workspaces/9/files').reply(200, { files: [], paymentFiles: [], definitions: [] });
    grant('can_view_files');
    const { unmount } = renderWithIntl(<ClientFiles wsId={9} />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Upload file' })).not.toBeInTheDocument());
    unmount();

    grant('can_view_files', 'can_upload_files');
    renderWithIntl(<ClientFiles wsId={9} />);
    expect(await screen.findByRole('button', { name: 'Upload file' })).toBeInTheDocument();
  });

  it('can_chat gates the composer', async () => {
    mock.onGet('/workspaces/9/chat').reply(200, { messages: [] });
    mock.onPost('/workspaces/9/chat/mark-read').reply(200, {});
    grant();
    const { unmount } = renderWithIntl(<ClientChat wsId={9} wsActive />);
    await waitFor(() => expect(screen.getByText('View only')).toBeInTheDocument());
    unmount();

    grant('can_chat');
    renderWithIntl(<ClientChat wsId={9} wsActive />);
    expect(await screen.findByPlaceholderText('Type a message...')).toBeInTheDocument();
  });

  it('can_upload_payment_proof gates the owner-only hint on payments', async () => {
    mock.onGet('/workspaces/9/payments').reply(200, { payments: [{ id: 1, status: 'pending', amount: '10', currency: 'SAR', created_at: '2026-01-01T00:00:00Z' }], available_methods: [], tax_summary: null });
    mock.onGet('/workspaces/9/contracts').reply(200, { contracts: [] });
    grant('can_view_payments');
    renderWithIntl(<ClientPayments wsId={9} />);
    expect(await screen.findByText('This action needs approval from the account owner or a user with permission')).toBeInTheDocument();
  });
});
