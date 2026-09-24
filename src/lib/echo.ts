import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getUser } from './auth';
import { getClient } from './client-auth';

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

let echoInstance: Echo<any> | null = null;

export function getEcho(): Echo<any> | null {
  if (typeof window === 'undefined') return null;
  if (echoInstance) return echoInstance;

  const user = getUser();
  if (!user) return null;

  (window as any).Pusher = Pusher;

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_KEY || 'shadapp-key',
    channelAuthorization: channelAuthCustomHandler(),
    reverb: {
      driver: 'reverb',
      host: process.env.NEXT_PUBLIC_REVERB_HOST || 'localhost',
      port: parseInt(process.env.NEXT_PUBLIC_REVERB_PORT || '8080', 10),
      scheme: process.env.NEXT_PUBLIC_REVERB_SCHEME || 'http',
    },
  });

  return echoInstance;
}

let clientEchoInstance: Echo<any> | null = null;

export function getClientEcho(): Echo<any> | null {
  if (typeof window === 'undefined') return null;
  if (clientEchoInstance) return clientEchoInstance;

  const client = getClient();
  if (!client) return null;

  (window as any).Pusher = Pusher;

  clientEchoInstance = new Echo({
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_KEY || 'shadapp-key',
    channelAuthorization: channelAuthCustomHandler(),
    reverb: {
      driver: 'reverb',
      host: process.env.NEXT_PUBLIC_REVERB_HOST || 'localhost',
      port: parseInt(process.env.NEXT_PUBLIC_REVERB_PORT || '8080', 10),
      scheme: process.env.NEXT_PUBLIC_REVERB_SCHEME || 'http',
    },
  });

  return clientEchoInstance;
}

export function subscribeToNotifications(callback: (notification: any) => void): (() => void) | null {
  const user = getUser();
  if (user) {
    const echo = getEcho();
    if (!echo) return null;

    const channel = echo.private(`App.Models.User.${user.id}`);
    channel.listen('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated', (e: any) => {
      callback(e);
    });

    return () => {
      channel.stopListening('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated');
      echo.leaveChannel(`private-App.Models.User.${user.id}`);
    };
  }

  const client = getClient();
  if (client) {
    const echo = getClientEcho();
    if (!echo) return null;

    const channel = echo.private(`App.Models.Client.${client.id}`);
    channel.listen('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated', (e: any) => {
      callback(e);
    });

    return () => {
      channel.stopListening('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated');
      echo.leaveChannel(`private-App.Models.Client.${client.id}`);
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
    onContractStatusChanged?: () => void;
    onWorkspaceStatusChanged?: (payload: any) => void;
    onPaymentStatusChanged?: (payload: any) => void;
  }
): (() => void) | null {
  const echo = getEcho() || getClientEcho();
  if (!echo) return null;

  const channel = echo.private(`workspace.${wsId}`);

  if (callbacks.onMessageSent) {
    channel.listen('.message.sent', (e: any) => {
      callbacks.onMessageSent!(e);
    });
  }

  if (callbacks.onMessageUpdated) {
    channel.listen('.message.updated', (e: any) => {
      callbacks.onMessageUpdated!(e);
    });
  }

  if (callbacks.onContractStatusChanged) {
    channel.listen('.contract.status_changed', () => {
      callbacks.onContractStatusChanged!();
    });
  }

  if (callbacks.onWorkspaceStatusChanged) {
    channel.listen('.workspace.status_changed', (e: any) => {
      callbacks.onWorkspaceStatusChanged!(e);
    });
  }

  if (callbacks.onPaymentStatusChanged) {
    channel.listen('.payment.status_changed', (e: any) => {
      callbacks.onPaymentStatusChanged!(e);
    });
  }

  return () => {
    if (callbacks.onMessageSent) {
      channel.stopListening('.message.sent');
    }
    if (callbacks.onMessageUpdated) {
      channel.stopListening('.message.updated');
    }
    if (callbacks.onContractStatusChanged) {
      channel.stopListening('.contract.status_changed');
    }
    if (callbacks.onWorkspaceStatusChanged) {
      channel.stopListening('.workspace.status_changed');
    }
    if (callbacks.onPaymentStatusChanged) {
      channel.stopListening('.payment.status_changed');
    }
    echo.leaveChannel(`private-workspace.${wsId}`);
  };
}

// Used by api.ts to attach X-Socket-Id to outgoing requests, so
// broadcast(...)->toOthers() on the backend can exclude the tab that
// triggered the event. Without this, chat send requests never carried a
// socket id, so ->toOthers() had nothing to exclude and the sender's own
// browser received its own message a second time over the socket, on top of
// the one already added optimistically/from the HTTP response.
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
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
  if (clientEchoInstance) {
    clientEchoInstance.disconnect();
    clientEchoInstance = null;
  }
}
