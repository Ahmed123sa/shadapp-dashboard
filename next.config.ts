import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Same derivation as lib/session.ts's LARAVEL_ORIGIN — resolveFileUrl()
// (lib/utils.ts) builds absolute <img src> URLs straight at this origin
// (avatars, chat attachments, signatures, payment proofs), so it has to be
// an allowed img-src, not just 'self'. Falls back to the same localhost
// default used everywhere else in dev.
const LARAVEL_ORIGIN = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
).replace(/\/api\/?$/, '');

// Reverb (lib/echo.ts) opens a WebSocket straight from the browser to this
// host — not through /api/proxy like everything else — so connect-src needs
// it explicitly. Listing both ws:/wss: since the scheme env var can be
// either depending on how Reverb is deployed.
const REVERB_HOST = process.env.NEXT_PUBLIC_REVERB_HOST || 'localhost';
const REVERB_PORT = process.env.NEXT_PUBLIC_REVERB_PORT || '8080';
const reverbWsOrigins = [`ws://${REVERB_HOST}:${REVERB_PORT}`, `wss://${REVERB_HOST}:${REVERB_PORT}`];

// Deliberately not a nonce-based strict-dynamic CSP: Next's own hydration
// bootstrap and several existing components (ToastNotification's <style>
// block, inline style objects) rely on unsafe-inline for script/style.
// Wiring per-request nonces through Next's static headers() config is a
// bigger refactor than this pass covers — this is still a real narrowing
// (blocks loading script/frames/objects from any origin not listed here)
// even with unsafe-inline present, just not the strongest form of CSP.
// next dev's Fast Refresh runtime (react-refresh-utils) evaluates code via
// eval() to apply hot updates — without 'unsafe-eval' the browser throws
// "Uncaught EvalError" on that runtime chunk and the page never finishes
// hydrating (stuck on the loading state forever). `next build` doesn't use
// eval this way, so production is unaffected either way — this only relaxes
// the policy for local `npm run dev`, not for what actually ships.
const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline'`,
  // cdnjs.cloudflare.com: Leaflet's default marker icons (LocationPickerMap.tsx).
  // tile.openstreetmap.org: the map tiles themselves. data:/blob: cover
  // canvas-drawn signature previews and file-picker object URLs.
  `img-src 'self' data: blob: https://cdnjs.cloudflare.com https://*.tile.openstreetmap.org ${LARAVEL_ORIGIN}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${LARAVEL_ORIGIN} ${reverbWsOrigins.join(' ')}`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Content-Security-Policy', value: csp },
  // Browsers ignore this over plain HTTP, so it's harmless in local dev and
  // only takes effect once actually served over HTTPS in production. Not
  // adding `preload` here on purpose — that requires submitting the domain
  // to browsers' built-in preload list, a one-way commitment that should be
  // an explicit choice, not something bundled into a routine header pass.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "shad-a6",

  project: "shadapp-dashboard",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
