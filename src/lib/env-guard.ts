/**
 * Fail loudly on missing production config instead of silently falling back
 * to localhost defaults. `proxy.ts`, `lib/utils.ts`, `lib/session.ts`, and
 * `lib/echo.ts` all read these with `process.env.X || 'localhost...'` — that
 * fallback exists so local dev works without a `.env` file, but the exact
 * same fallback means a VPS deploy that forgot to set `NEXT_PUBLIC_API_URL`
 * / `NEXT_PUBLIC_REVERB_*` in `.env.production` doesn't fail on startup —
 * it just quietly proxies every request to `localhost:8000` on the VPS
 * itself. That either connection-refuses on every request (confusing to
 * debug) or, if Laravel happens to also be running on that same port on the
 * same box, silently "works" while actually pointed at the wrong place by
 * accident rather than by configuration.
 *
 * Only enforced when NODE_ENV is 'production' — local dev and the test
 * suite keep relying on the localhost fallback on purpose, so `npm run dev`
 * and `npm test` are unaffected.
 */
const REQUIRED_IN_PRODUCTION = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_REVERB_HOST',
  'NEXT_PUBLIC_REVERB_KEY',
] as const;

export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s) in production: ${missing.join(', ')}. ` +
      `Set these in .env.production (or your process manager's env config) on the ` +
      `server before starting — the localhost fallback used in development is not ` +
      `safe for production, since it silently points the app at the wrong backend ` +
      `instead of failing visibly.`
    );
  }
}
