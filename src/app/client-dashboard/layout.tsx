import ToastNotification from '@/components/ToastNotification';
// Scoped under .cx-root — inert until a client-portal screen mounts that root.
import '@/styles/client-portal.css';

// The AM/SA dashboard mounts <ToastNotification /> once in dashboard/layout.tsx
// so showToast() works from any component under /dashboard. The client portal
// had no equivalent layout wrapper — each page under /client-dashboard rendered
// directly with no shared shell — so showToast() calls from client-portal
// components (ClientChat, ClientContracts, ClientApprovals, etc.) would call
// into the module-level `addToastExternal` pointer while it was still the
// unmounted-page no-op, and silently do nothing. This layout is purely
// additive: it doesn't touch how any existing page under /client-dashboard
// renders, it only adds the toast host alongside it.
export default function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToastNotification />
      {children}
    </>
  );
}
