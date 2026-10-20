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
  // An axios failure's own message is just "Request failed with status code N";
  // surface the status and the server's answer so the console shows why.
  const res = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (res) {
    payload.status = res.status;
    payload.response = res.data;
  }
  console.error(`[reportError] ${context}:`, payload);

  Sentry.captureException(error, {
    tags: { context },
    extra,
  });
}
