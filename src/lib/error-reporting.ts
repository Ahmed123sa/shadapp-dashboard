/**
 * Single funnel for errors that would otherwise be silently swallowed.
 *
 * The dashboard has no error-reporting service today (no Sentry equivalent,
 * unlike the mobile app's Crashlytics pipeline). Until one is wired up, this
 * logs to the console in a consistent, greppable shape so failures are at
 * least visible in dev tools / server logs instead of vanishing in an empty
 * catch block. Swapping in a real reporting service later means touching
 * this one function, not the dozens of call sites that use it.
 */
export function reportError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const payload: Record<string, unknown> = { context, message };
  if (error instanceof Error && error.stack) payload.stack = error.stack;
  if (extra) payload.extra = extra;
  // eslint-disable-next-line no-console
  console.error(`[reportError] ${context}:`, payload);
}
