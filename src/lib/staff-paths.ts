// Pure (no imports) so src/proxy.ts can use it without pulling in the axios
// client. What a company staff member may open in the dashboard: their client
// list, a client's page (but not its settings sub-page) and their own
// settings. The backend denies every other API route by default; this only
// keeps the other pages from being served.
export function staffMayOpen(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '');
  if (path === '/dashboard/settings') return true;
  if (path === '/dashboard/clients') return true;
  return /^\/dashboard\/clients\/[^/]+$/.test(path);
}
