// Pure (no imports) so src/proxy.ts can use it without pulling in the axios
// client. What an accountant may open in the dashboard: finance numbers, the
// clients (read-only; contracts and payments live inside a client's page) and their own notifications/settings.
// The backend (restrict.roles) denies every other API route by default; this
// only keeps the other pages from being served.
const EXACT = [
  '/dashboard/finance',
  '/dashboard/clients',
  '/dashboard/notifications',
  '/dashboard/settings',
];

export function accountantMayOpen(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (EXACT.includes(path)) return true;
  // A client's page, but not its settings sub-page.
  return /^\/dashboard\/clients\/[^/]+$/.test(path);
}
