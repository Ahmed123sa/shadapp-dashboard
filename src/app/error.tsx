'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ErrorState';
import { reportError } from '@/lib/error-reporting';

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError('app/error.tsx', error, { digest: error.digest });
  }, [error]);

  return <ErrorState fullScreen onRetry={reset} />;
}
