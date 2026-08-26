import axios from 'axios';
import { getActiveSocketId } from './echo';

// All requests go to the same-origin /api/proxy/* route handler, never
// directly to the Laravel origin. The proxy attaches the Sanctum token
// server-side from an httpOnly cookie — the browser/this axios instance
// never sees or handles the token itself, which is the point (an XSS bug
// elsewhere in the app can no longer steal it via localStorage).
const api = axios.create({
  baseURL: '/api/proxy',
  headers: { Accept: 'application/json' },
  withCredentials: true,
});

// Attach the current Echo socket id to every request. Cheap to do globally
// (it's only ever read by broadcast(...)->toOthers() on endpoints that
// actually broadcast) and means new broadcasting endpoints get the
// sender-exclusion behavior for free instead of each call site having to
// remember to wire it up.
api.interceptors.request.use((config) => {
  const socketId = getActiveSocketId();
  if (socketId) {
    config.headers['X-Socket-Id'] = socketId;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    config.__retryCount = config.__retryCount || 0;

    if (err.response?.status === 429 && config.__retryCount < 3) {
      config.__retryCount += 1;
      const delay = Math.pow(2, config.__retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(config);
    }

    if (err.response?.status === 401) {
      const isClient = !!localStorage.getItem('client');
      localStorage.removeItem('user');
      localStorage.removeItem('client');
      try {
        await fetch('/api/session/logout', { method: 'POST' });
      } catch {
        // Best-effort — still redirect below even if this fails.
      }
      if (typeof window !== 'undefined') window.location.href = isClient ? '/client-login' : '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
