import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientChat from '../ClientChat';
import api from '@/lib/api';
import { subscribeToWorkspace } from '@/lib/echo';

// Characterization suite written BEFORE migrating ClientChat off manual
// useEffect+setState+setInterval onto TanStack Query (DASHBOARD_ASSESSMENT.md
// Round 3, Chat slice). Pins down current API calls, polling/websocket-
// triggered reloads, and rendered/updated state so the migration can be
// checked against this file instead of assumptions.

// The real subscription touches Echo/Pusher (WebSocket), which isn't
// available in jsdom. Swapped for a spy that captures the callback so tests
// can simulate a `message.sent` push without a real socket. Only
// `subscribeToWorkspace` is overridden — the module also exports
// `getActiveSocketId`, which api.ts's request interceptor calls on every
// request, so a full replacement here breaks every mocked API call in this
// file.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToWorkspace: vi.fn(),
}));

let mock: MockAdapter;

const clientMessage = {
  id: 1,
  workspace_id: 9,
  sender_type: 'App\\Models\\Client',
  sender_id: 5,
  message: 'Hello from the client',
  type: 'text',
  requires_action: false,
  action_taken: false,
  sender: { id: 5, name: 'Acme Corp' },
  created_at: '2026-01-01T10:00:00Z',
};

const pendingApprovalMessage = {
  id: 2,
  workspace_id: 9,
  sender_type: 'App\\Models\\User',
  sender_id: 1,
  message: 'Please approve this change',
  type: 'text',
  requires_action: true,
  action_taken: false,
  sender: { id: 1, name: 'Manager', role: 'account_manager' },
  created_at: '2026-01-01T10:05:00Z',
};

function mockLoad(overrides?: { messages?: unknown[] }) {
  mock.onGet('/workspaces/9/chat').reply(200, { messages: overrides?.messages ?? [clientMessage] });
  mock.onPost('/workspaces/9/chat/mark-read').reply(200, {});
}

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(subscribeToWorkspace).mockReturnValue(vi.fn());
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientChat (characterization)', () => {
  it('loads messages on mount and marks the chat as read', async () => {
    mockLoad();
    renderWithIntl(<ClientChat wsId={9} wsActive />);

    await waitFor(() => expect(screen.getByText('Hello from the client')).toBeInTheDocument());
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/chat')).toBe(true);
    await waitFor(() => expect(mock.history.post.some((r) => r.url === '/workspaces/9/chat/mark-read')).toBe(true));
  });

  it('shows a generic error message when the load fails', async () => {
    mock.onGet('/workspaces/9/chat').reply(500);
    renderWithIntl(<ClientChat wsId={9} wsActive />);

    await waitFor(() => expect(screen.getByText('Failed to load chat')).toBeInTheDocument());
  });

  it('sends a text message and appends it to the list', async () => {
    mockLoad();
    mock.onPost('/workspaces/9/chat').reply(200, {
      message: { ...clientMessage, id: 3, message: 'A new client message' },
    });
    const user = userEvent.setup();
    renderWithIntl(<ClientChat wsId={9} wsActive />);

    await waitFor(() => expect(screen.getByText('Hello from the client')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('Type a message...'), 'A new client message');
    await user.click(screen.getByTitle('Send'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/chat');
      expect(call).toBeTruthy();
    });
    await waitFor(() => expect(screen.getByText('A new client message')).toBeInTheDocument());
    expect((screen.getByPlaceholderText('Type a message...') as HTMLInputElement).value).toBe('');
  });

  it('clears the composer and reloads even when sending fails', async () => {
    mockLoad();
    mock.onPost('/workspaces/9/chat').reply(500);
    const user = userEvent.setup();
    renderWithIntl(<ClientChat wsId={9} wsActive />);

    await waitFor(() => expect(screen.getByText('Hello from the client')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('Type a message...'), 'this will fail');
    await user.click(screen.getByTitle('Send'));

    await waitFor(() => expect((screen.getByPlaceholderText('Type a message...') as HTMLInputElement).value).toBe(''));
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/workspaces/9/chat').length).toBeGreaterThanOrEqual(2));
  });

  it('lets the client approve a pending-action message', async () => {
    mockLoad({ messages: [pendingApprovalMessage] });
    mock.onPost('/chat/2/respond').reply(200, {
      message: { ...pendingApprovalMessage, action_taken: true, action_result: 'approved' },
    });
    const user = userEvent.setup();
    renderWithIntl(<ClientChat wsId={9} wsActive />);

    await waitFor(() => expect(screen.getByText('Please approve this change')).toBeInTheDocument());
    await user.click(screen.getByText('Approve'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/chat/2/respond');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data as string)).toEqual({ action: 'approved' });
    });
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
  });

  it('lets the client request an edit on a pending-action message', async () => {
    mockLoad({ messages: [pendingApprovalMessage] });
    mock.onPost('/chat/2/respond').reply(200, {
      message: { ...pendingApprovalMessage, action_taken: true, action_result: 'edit_requested' },
    });
    const user = userEvent.setup();
    renderWithIntl(<ClientChat wsId={9} wsActive />);

    await waitFor(() => expect(screen.getByText('Please approve this change')).toBeInTheDocument());
    await user.click(screen.getByText('Edit'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/chat/2/respond');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data as string)).toEqual({ action: 'edit_requested' });
    });
    await waitFor(() => expect(screen.getByText('Edit Requested')).toBeInTheDocument());
  });

  it('reloads on a "message.sent" websocket push', async () => {
    mockLoad();
    renderWithIntl(<ClientChat wsId={9} wsActive />);
    await waitFor(() => expect(screen.getByText('Hello from the client')).toBeInTheDocument());

    expect(subscribeToWorkspace).toHaveBeenCalledWith(9, expect.objectContaining({
      onMessageSent: expect.any(Function),
    }));
    const { onMessageSent } = vi.mocked(subscribeToWorkspace).mock.calls[0][1];

    mockLoad({ messages: [clientMessage, { ...clientMessage, id: 4, message: 'Pushed via websocket' }] });
    onMessageSent!({});

    await waitFor(() => expect(screen.getByText('Pushed via websocket')).toBeInTheDocument());
  });

  it('shows the unavailable message when the workspace is not active', async () => {
    mockLoad();
    renderWithIntl(<ClientChat wsId={9} wsActive={false} />);

    await waitFor(() => expect(screen.getByText('Chat unavailable — awaiting workspace activation after payment')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText('Type a message...')).not.toBeInTheDocument();
  });
});
