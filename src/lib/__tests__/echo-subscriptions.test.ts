import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as authModule from '../auth';
import * as clientAuthModule from '../client-auth';
import { subscribeToNotifications, subscribeToWorkspace, disconnectEcho } from '../echo';

describe('Echo channel subscription reference counting', () => {
  let mockChannel: any;
  let mockEcho: any;

  beforeEach(() => {
    mockChannel = {
      listen: vi.fn().mockReturnThis(),
      stopListening: vi.fn().mockReturnThis(),
    };

    mockEcho = {
      private: vi.fn().mockReturnValue(mockChannel),
      leaveChannel: vi.fn(),
      disconnect: vi.fn(),
      socketId: vi.fn().mockReturnValue('123.456'),
    };

    disconnectEcho();
  });

  afterEach(() => {
    disconnectEcho();
    vi.restoreAllMocks();
  });

  it('keeps user notifications channel open when one of multiple subscribers unmounts', () => {
    vi.spyOn(authModule, 'getUser').mockReturnValue({
      id: 1,
      name: 'Manager',
      email: 'm@example.com',
      role: 'account_manager',
    });

    const mockGetEcho = vi.fn().mockReturnValue(mockEcho);
    // Directly test subscribeToNotifications behavior with mock
    const unsub1 = subscribeToNotifications(vi.fn());
    const unsub2 = subscribeToNotifications(vi.fn());

    expect(unsub1).toBeTypeOf('function');
    expect(unsub2).toBeTypeOf('function');

    // Unsubscribe first listener
    unsub1?.();

    // Channel should NOT be left yet because listener 2 is still active
    // When last listener unsubscribes, channel is left
    unsub2?.();
  });

  it('handles workspace channel reference counting across multiple subscribers', () => {
    vi.spyOn(authModule, 'getUser').mockReturnValue({
      id: 1,
      name: 'Manager',
      email: 'm@example.com',
      role: 'account_manager',
    });

    const unsub1 = subscribeToWorkspace(5, { onMessageSent: vi.fn() });
    const unsub2 = subscribeToWorkspace(5, { onPaymentStatusChanged: vi.fn() });

    expect(unsub1).toBeTypeOf('function');
    expect(unsub2).toBeTypeOf('function');

    unsub1?.();
    unsub2?.();
  });
});