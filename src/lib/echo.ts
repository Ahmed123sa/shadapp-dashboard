import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getUser } from './auth';
import { getClient } from './client-auth';

let echoInstance: Echo<any> | null = null;

export function getEcho(): Echo<any> | null {
  if (typeof window === 'undefined') return null;
  if (echoInstance) return echoInstance;

  const user = getUser();
  if (!user) return null;

  const token = localStorage.getItem('token');
  if (!token) return null;

  (window as any).Pusher = Pusher;

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_KEY || 'shadapp-key',
    authEndpoint: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/broadcasting/auth`,
    auth: {
      headers: { Authorization: `Bearer ${token}` },
    },
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

  const token = localStorage.getItem('client_token');
  if (!token) return null;

  (window as any).Pusher = Pusher;

  clientEchoInstance = new Echo({
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_KEY || 'shadapp-key',
    authEndpoint: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/broadcasting/auth`,
    auth: {
      headers: { Authorization: `Bearer ${token}` },
    },
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
    onContractStatusChanged?: () => void;
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

  if (callbacks.onContractStatusChanged) {
    channel.listen('.contract.status_changed', () => {
      callbacks.onContractStatusChanged!();
    });
  }

  return () => {
    if (callbacks.onMessageSent) {
      channel.stopListening('.message.sent');
    }
    if (callbacks.onContractStatusChanged) {
      channel.stopListening('.contract.status_changed');
    }
    echo.leaveChannel(`private-workspace.${wsId}`);
  };
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
