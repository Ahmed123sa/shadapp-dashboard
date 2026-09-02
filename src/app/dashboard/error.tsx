'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ErrorState';
import { reportError } from '@/lib/error-reporting';

// Renders inside dashboard/layout.tsx's <main> — the sidebar and topbar stay
// up, only the broken content area is replaced. Keeps navigation usable
// while showing something failed.
export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError('app/dashboard/error.tsx', error, { digest: error.digest });
  }, [error]);

  return <ErrorState onRetry={reset} />;
}
