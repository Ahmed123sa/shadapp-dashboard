import * as Sentry from '@sentry/nextjs';

/**
 * Single funnel for errors that would otherwise be silently swallowed.
 *
 * Logs to the console in a consistent, greppable shape (dev tools / server
 * logs) AND forwards to Sentry (mirrors the mobile app's Crashlytics
 * pipeline) so a failure at any of the dozens of call sites using this
 * function shows up as a real, actionable issue instead of vanishing in an
 * empty catch block. `context` is tagged so issues can be filtered/grouped
 * by call site in the Sentry UI.
 */
export function reportError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const payload: Record<string, unknown> = { context, message };
  if (error instanceof Error && error.stack) payload.stack = error.stack;
  if (extra) payload.extra = extra;
  console.error(`[reportError] ${context}:`, payload);

  Sentry.captureException(error, {
    tags: { context },
    extra,
  });
}
