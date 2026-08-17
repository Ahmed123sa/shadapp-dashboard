import axios from 'axios';

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
