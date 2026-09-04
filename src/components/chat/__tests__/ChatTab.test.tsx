import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ChatTab from '../ChatTab';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { subscribeToWorkspace } from '@/lib/echo';

// Characterization suite written BEFORE migrating ChatTab off manual
// useEffect+setState+setInterval onto TanStack Query (DASHBOARD_ASSESSMENT.md
// Round 3, Chat slice — the last slice). Pins down current API calls,
// polling/websocket-triggered reloads, and rendered/updated state so the
// migration can be checked against this file instead of assumptions.

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

// The real subscription touches Echo/Pusher (WebSocket), which isn't
// available in jsdom. Swapped for a spy that captures the callbacks so tests
// can simulate a `message.sent` / `contract.status_changed` push without a
// real socket, and returns an unsubscribe spy so the effect's cleanup path
// runs without throwing. Only `subscribeToWorkspace` is overridden — the
// module also exports `getActiveSocketId`, which api.ts's request
// interceptor calls on every request, so a full replacement here breaks
// every mocked API call in this file.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToWorkspace: vi.fn(),
}));

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

const staffMessage = {
  id: 1,
  workspace_id: 9,
  sender_type: 'App\\Models\\User',
  sender_id: 1,
  message: 'Hello from the account manager',
  type: 'text',
  requires_action: false,
  action_taken: false,
  sender: { id: 1, name: 'Manager', role: 'account_manager' },
  created_at: '2026-01-01T10:00:00Z',
};

function mockLoad(overrides?: { messages?: unknown[]; contracts?: unknown[] }) {
  mock.onGet('/workspaces/9/chat').reply(200, { messages: overrides?.messages ?? [staffMessage] });
  mock.onPost('/workspaces/9/chat/mark-read').reply(200, {});
  mock.onGet('/workspaces/9/contracts').reply(200, { contracts: overrides?.contracts ?? [draftContract] });
}

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', role: 'account_manager' });
  vi.mocked(subscribeToWorkspace).mockReturnValue(vi.fn());
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ChatTab (characterization)', () => {
  it('loads messages and contracts on mount, and marks the chat as read', async () => {
    mockLoad();
    renderWithIntl(<ChatTab wsId={9} wsActive clientType="business" />);

    await waitFor(() => expect(screen.getByText('Hello from the account manager')).toBeInTheDocument());
    expect(screen.getByText('Retainer Agreement')).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/chat')).toBe(true);
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/contracts')).toBe(true);
    await waitFor(() => expect(mock.history.post.some((r) => r.url === '/workspaces/9/chat/mark-read')).toBe(true));
  });

  it('shows the error state when the initial load fails, and retries on click', async () => {
    // ErrorState (the shared component, not this file's translations) reads
    // Arabic/English off `document.documentElement.lang` directly rather
    // than next-intl, and defaults to Arabic until that effect resolves —
    // jsdom's <html> has no lang attribute, so it renders the Arabic copy.
    mock.onGet('/workspaces/9/chat').replyOnce(500);
    mock.onGet('/workspaces/9/contracts').replyOnce(500);
    renderWithIntl(<ChatTab wsId={9} wsActive clientType="business" />);

    await waitFor(() => expect(screen.getByText('حاول تاني')).toBeInTheDocument());

    mockLoad();
    await userEvent.click(screen.getByText('حاول تاني'));

    await waitFor(() => expect(screen.getByText('Hello from the account manager')).toBeInTheDocument());
  });

  it('sends a text message and appends it to the list', async () => {
    mockLoad();
    mock.onPost('/workspaces/9/chat').reply(200, {
      message: { ...staffMessage, id: 2, message: 'New message from me' },
    });
    const user = userEvent.setup();
    renderWithIntl(<ChatTab wsId={9} wsActive clientType="business" />);

    await waitFor(() => expect(screen.getByText('Hello from the account manager')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('Type a message...'), 'New message from me');
    await user.click(screen.getByText('Send'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/chat');
      expect(call).toBeTruthy();
    });
    await waitFor(() => expect(screen.getByText('New message from me')).toBeInTheDocument());
    expect((screen.getByPlaceholderText('Type a message...') as HTMLInputElement).value).toBe('');
  });

  it('clears the composer and reloads even when sending fails', async () => {
    mockLoad();
    mock.onPost('/workspaces/9/chat').reply(500);
    const user = userEvent.setup();
    renderWithIntl(<ChatTab wsId={9} wsActive clientType="business" />);

    await waitFor(() => expect(screen.getByText('Hello from the account manager')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('Type a message...'), 'this will fail');
    await user.click(screen.getByText('Send'));

    await waitFor(() => expect((screen.getByPlaceholderText('Type a message...') as HTMLInputElement).value).toBe(''));
    // The original re-runs load() on a failed send, so /chat gets fetched
    // a second time (mount + retry-after-failure).
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/workspaces/9/chat').length).toBeGreaterThanOrEqual(2));
  });

  it('toggles "require action" on a message', async () => {
    mockLoad();
    mock.onPatch('/chat/1/require-action').reply(200, {
      message: { ...staffMessage, requires_action: true },
    });
    const user = userEvent.setup();
    renderWithIntl(<ChatTab wsId={9} wsActive clientType="business" />);

    await waitFor(() => expect(screen.getByText('Hello from the account manager')).toBeInTheDocument());
    await user.click(screen.getByText('Request Client Approval'));

    await waitFor(() => expect(mock.history.patch.some((r) => r.url === '/chat/1/require-action')).toBe(true));
    await waitFor(() => expect(screen.getByText('Cancel Approval Request')).toBeInTheDocument());
  });

  it('sends a draft contract to the client from the contract card', async () => {
    mockLoad();
    mock.onPost('/contracts/601/send').reply(200, {
      contract: { ...draftContract, status: 'sent' },
    });
    const user = userEvent.setup();
    renderWithIntl(<ChatTab wsId={9} wsActive clientType="business" />);

    await waitFor(() => expect(screen.getByText('Send to Client')).toBeInTheDocument());
    await user.click(screen.getByText('Send to Client'));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === '/contracts/601/send')).toBe(true));
    await waitFor(() => expect(screen.queryByText('Send to Client')).not.toBeInTheDocument());
  });

  it('reloads on a "message.sent" websocket push', async () => {
    mockLoad();
    renderWithIntl(<ChatTab wsId={9} wsActive clientType="business" />);
    await waitFor(() => expect(screen.getByText('Hello from the account manager')).toBeInTheDocument());

    expect(subscribeToWorkspace).toHaveBeenCalledWith(9, expect.objectContaining({
      onMessageSent: expect.any(Function),
      onContractStatusChanged: expect.any(Function),
    }));
    const { onMessageSent } = vi.mocked(subscribeToWorkspace).mock.calls[0][1];

    mockLoad({ messages: [staffMessage, { ...staffMessage, id: 3, message: 'Pushed via websocket' }] });
    onMessageSent!({});

    await waitFor(() => expect(screen.getByText('Pushed via websocket')).toBeInTheDocument());
  });

  it('shows the view-only chat (no composer) for a super admin', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 2, name: 'SA', role: 'super_admin' });
    mockLoad();
    renderWithIntl(<ChatTab wsId={9} wsActive clientType="business" />);

    await waitFor(() => expect(screen.getByText('View only')).toBeInTheDocument());
    expect(screen.getByText('Hello from the account manager')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Type a message...')).not.toBeInTheDocument();
  });

  it('shows the unavailable message when the workspace is not active', async () => {
    mockLoad();
    renderWithIntl(<ChatTab wsId={9} wsActive={false} clientType="business" />);

    await waitFor(() => expect(screen.getByText('Chat unavailable — awaiting payment and workspace activation')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText('Type a message...')).not.toBeInTheDocument();
  });
});
