import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getUser } from './auth';
import { getClient } from './client-auth';
import { reportError } from './error-reporting';

// Private-channel auth used to attach the Sanctum bearer token read from
// localStorage. The token now lives only in an httpOnly cookie, so instead
// we point channel auth at the same-origin /api/proxy route (which reads
// that cookie server-side) and let the browser send the cookie itself via
// `credentials: 'include'`. See src/app/api/proxy/[...path]/route.ts.
function channelAuthCustomHandler() {
  return {
    customHandler: (
      { socketId, channelName }: { socketId: string; channelName: string },
      callback: (error: Error | null, data: any) => void
    ) => {
      fetch('/api/proxy/broadcasting/auth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Channel auth failed: ${res.status}`);
          return res.json();
        })
        .then((data) => callback(null, data))
        .catch((err) => callback(err, null));
    },
  };
}

// Exported for tests. laravel-echo hands these options straight to pusher-js,
// which only reads wsHost/wsPort/wssPort/forceTLS at the top level. The old
// nested `reverb: {host, port, scheme}` was ignored, so pusher-js fell back
// to Pusher's cloud host (ws-.pusher.com) and the dashboard never reached
// Reverb.
export function reverbOptions() {
  const scheme = process.env.NEXT_PUBLIC_REVERB_SCHEME || 'http';
  const port = parseInt(process.env.NEXT_PUBLIC_REVERB_PORT || '8080', 10);
  return {
    broadcaster: 'reverb' as const,
    key: process.env.NEXT_PUBLIC_REVERB_KEY || 'shadapp-key',
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST || 'localhost',
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'] as ('ws' | 'wss')[],
    channelAuthorization: channelAuthCustomHandler(),
  };
}

function bindErrorHandlers(echo: Echo<any>) {
  try {
    const connector = (echo as any).connector;
    const pusher = connector?.pusher;
    if (pusher?.connection) {
      pusher.connection.bind('error', (err: any) => {
        reportError('Echo connection error', err ?? new Error('Unknown Echo error'));
      });
      pusher.connection.bind('unavailable', () => {
        reportError('Echo connection unavailable', new Error('Connection unavailable'));
      });
    }
  } catch {
    // Ignore if connector or pusher is not accessible in this environment.
  }
}

let echoInstance: Echo<any> | null = null;

export function getEcho(): Echo<any> | null {
  if (typeof window === 'undefined') return null;
  if (echoInstance) return echoInstance;

  const user = getUser();
  if (!user) return null;

  (window as any).Pusher = Pusher;

  echoInstance = new Echo(reverbOptions());
  bindErrorHandlers(echoInstance);

  return echoInstance;
}

let clientEchoInstance: Echo<any> | null = null;

export function getClientEcho(): Echo<any> | null {
  if (typeof window === 'undefined') return null;
  if (clientEchoInstance) return clientEchoInstance;

  const client = getClient();
  if (!client) return null;

  (window as any).Pusher = Pusher;

  clientEchoInstance = new Echo(reverbOptions());
  bindErrorHandlers(clientEchoInstance);

  return clientEchoInstance;
}

// Reference counter map to prevent unmounting one component from tearing down
// channels shared across the entire application (e.g. NotificationBell + useBadgeCounts).
const channelRefs = new Map<string, number>();

function retainChannel(channelName: string): void {
  channelRefs.set(channelName, (channelRefs.get(channelName) ?? 0) + 1);
}

function releaseChannel(echo: Echo<any>, channelName: string): void {
  const count = (channelRefs.get(channelName) ?? 1) - 1;
  if (count > 0) {
    channelRefs.set(channelName, count);
  } else {
    channelRefs.delete(channelName);
    try {
      echo.leaveChannel(channelName);
    } catch {
      // Ignore if already left
    }
  }
}

export function subscribeToNotifications(callback: (notification: any) => void): (() => void) | null {
  const user = getUser();
  if (user) {
    const echo = getEcho();
    if (!echo) return null;

    const channelName = `private-App.Models.User.${user.id}`;
    retainChannel(channelName);
    const channel = echo.private(`App.Models.User.${user.id}`);
    const eventName = '.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated';
    const handler = (e: any) => callback(e);
    channel.listen(eventName, handler);

    return () => {
      channel.stopListening(eventName, handler);
      releaseChannel(echo, channelName);
    };
  }

  const client = getClient();
  if (client) {
    const echo = getClientEcho();
    if (!echo) return null;

    const channelName = `private-App.Models.Client.${client.id}`;
    retainChannel(channelName);
    const channel = echo.private(`App.Models.Client.${client.id}`);
    const eventName = '.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated';
    const handler = (e: any) => callback(e);
    channel.listen(eventName, handler);

    return () => {
      channel.stopListening(eventName, handler);
      releaseChannel(echo, channelName);
    };
  }

  return null;
}

export function subscribeToWorkspace(
  wsId: number,
  callbacks: {
    onMessageSent?: (payload: any) => void;
    // An existing message changed - an edit, or a client answering an
    // approval card. Added 23 Sept 2026; the backend already broadcast it.
    onMessageUpdated?: (payload: any) => void;
    onMessageDeleted?: (payload: any) => void;
    onContractStatusChanged?: () => void;
    onWorkspaceStatusChanged?: (payload: any) => void;
    onPaymentStatusChanged?: (payload: any) => void;
  }
): (() => void) | null {
  const echo = getEcho() || getClientEcho();
  if (!echo) return null;

  const channelName = `private-workspace.${wsId}`;
  retainChannel(channelName);
  const channel = echo.private(`workspace.${wsId}`);

  const msgSentHandler = callbacks.onMessageSent ? (e: any) => callbacks.onMessageSent!(e) : null;
  const msgUpdatedHandler = callbacks.onMessageUpdated ? (e: any) => callbacks.onMessageUpdated!(e) : null;
  const msgDeletedHandler = callbacks.onMessageDeleted ? (e: any) => callbacks.onMessageDeleted!(e) : null;
  const contractStatusHandler = callbacks.onContractStatusChanged ? () => callbacks.onContractStatusChanged!() : null;
  const wsStatusHandler = callbacks.onWorkspaceStatusChanged ? (e: any) => callbacks.onWorkspaceStatusChanged!(e) : null;
  const paymentStatusHandler = callbacks.onPaymentStatusChanged ? (e: any) => callbacks.onPaymentStatusChanged!(e) : null;

  if (msgSentHandler) channel.listen('.message.sent', msgSentHandler);
  if (msgUpdatedHandler) channel.listen('.message.updated', msgUpdatedHandler);
  if (msgDeletedHandler) channel.listen('.message.deleted', msgDeletedHandler);
  if (contractStatusHandler) channel.listen('.contract.status_changed', contractStatusHandler);
  if (wsStatusHandler) channel.listen('.workspace.status_changed', wsStatusHandler);
  if (paymentStatusHandler) channel.listen('.payment.status_changed', paymentStatusHandler);

  return () => {
    if (msgSentHandler) channel.stopListening('.message.sent', msgSentHandler);
    if (msgUpdatedHandler) channel.stopListening('.message.updated', msgUpdatedHandler);
    if (msgDeletedHandler) channel.stopListening('.message.deleted', msgDeletedHandler);
    if (contractStatusHandler) channel.stopListening('.contract.status_changed', contractStatusHandler);
    if (wsStatusHandler) channel.stopListening('.workspace.status_changed', wsStatusHandler);
    if (paymentStatusHandler) channel.stopListening('.payment.status_changed', paymentStatusHandler);
    releaseChannel(echo, channelName);
  };
}

// Used by api.ts to attach X-Socket-Id to outgoing requests, so
// broadcast(...)->toOthers() on the backend can exclude the tab that
// triggered the event.
export function getActiveSocketId(): string | null {
  try {
    return (echoInstance?.socketId() as string | undefined)
      ?? (clientEchoInstance?.socketId() as string | undefined)
      ?? null;
  } catch {
    // socketId() throws if the connector isn't connected yet.
    return null;
  }
}

export function disconnectEcho(): void {
  channelRefs.clear();
  if (echoInstance) {
    try {
      echoInstance.disconnect();
    } catch {
      // Ignore
    }
    echoInstance = null;
  }
  if (clientEchoInstance) {
    try {
      clientEchoInstance.disconnect();
    } catch {
      // Ignore
    }
    clientEchoInstance = null;
  }
}