import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ChatTab from '@/components/chat/ChatTab';
import ApprovalsTab from '@/components/approvals/ApprovalsTab';
import MeetingsTab from '@/components/meetings/MeetingsTab';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// PLAN_2 ف٥ — a company staff member only does on a client what
// `my_staff_permissions` (GET /workspaces/{ws}) allows.

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

let mock: MockAdapter;
const all = { can_view_chat: true, can_send_chat: true, can_view_approvals: true, can_request_approvals: true, can_view_meetings: true, can_join_meetings: true };

function workspaceWith(perms: Record<string, boolean> | null) {
  mock.onGet('/workspaces/9').reply(200, { workspace: { id: 9, my_staff_permissions: perms } });
  mock.onGet('/workspaces/9/chat').reply(200, { messages: [] });
  mock.onPost('/workspaces/9/chat/mark-read').reply(200, {});
  mock.onGet('/workspaces/9/meetings').reply(200, { meetings: [{
    id: 401, workspace_id: 9, title: 'Kickoff Call', status: 'scheduled', duration_minutes: 30, notes: '',
    scheduled_at: new Date(Date.now() + 5 * 60000).toISOString(), zoom_meeting_id: '1', link: 'https://zoom.us/j/1', host_user_id: 99,
  }] });
  mock.onGet('/workspaces/9/approvals').reply(200, { approvals: [] });
}

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(getUser).mockReturnValue({ id: 5, name: 'Staff', email: 's@example.com', role: 'staff_member' } as any);
});
afterEach(() => { mock.restore(); vi.clearAllMocks(); });

describe('staff permissions inside the workspace tabs', () => {
  it('chat: view-only staff gets no composer', async () => {
    workspaceWith({ ...all, can_send_chat: false });
    renderWithIntl(<ChatTab wsId={9} wsActive />);
    expect(await screen.findByTestId('chat-read-only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });

  it('chat: staff who may send keeps the composer', async () => {
    workspaceWith(null);
    renderWithIntl(<ChatTab wsId={9} wsActive />);
    expect(await screen.findByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.queryByTestId('chat-read-only')).not.toBeInTheDocument();
  });

  it('approvals: staff who may not request gets no new-request form', async () => {
    workspaceWith({ ...all, can_request_approvals: false });
    renderWithIntl(<ApprovalsTab wsId={9} />);
    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/workspaces/9')).toBe(true));
    await waitFor(() => expect(screen.queryByText('New Approval Request')).not.toBeInTheDocument());
  });

  it('approvals: staff who may request sees the form', async () => {
    workspaceWith(all);
    renderWithIntl(<ApprovalsTab wsId={9} />);
    expect(await screen.findByText('New Approval Request')).toBeInTheDocument();
  });

  it('meetings: staff who may not join sees no Join button', async () => {
    workspaceWith({ ...all, can_join_meetings: false });
    renderWithIntl(<MeetingsTab wsId={9} />);
    expect(await screen.findByText('Kickoff Call')).toBeInTheDocument();
    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/workspaces/9')).toBe(true));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Join/i })).not.toBeInTheDocument());
  });

  it('meetings: staff who may join sees the Join button', async () => {
    workspaceWith(all);
    renderWithIntl(<MeetingsTab wsId={9} />);
    expect(await screen.findByRole('button', { name: /Join/i })).toBeInTheDocument();
  });

  it('does not ask for the workspace when the user is not staff', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Mgr', email: 'm@example.com', role: 'account_manager' } as any);
    workspaceWith(null);
    renderWithIntl(<ApprovalsTab wsId={9} />);
    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/workspaces/9/approvals')).toBe(true));
    expect(mock.history.get.some((r) => r.url === '/workspaces/9')).toBe(false);
  });
});
