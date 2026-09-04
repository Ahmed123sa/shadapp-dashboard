'use client';

import { useEffect } from 'react';
import './globals.css';
import ErrorState from '@/components/ErrorState';
import { reportError } from '@/lib/error-reporting';
import { tajawal, playfairDisplay, archivo } from '@/lib/fonts';

// This is the boundary of last resort: it only fires when the root layout
// itself throws, which means it renders its own <html>/<body> from scratch
// (no NextIntlClientProvider, no sidebar, nothing above it left to render).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError('app/global-error.tsx', error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${playfairDisplay.variable} ${archivo.variable}`}>
      <body className="min-h-screen">
        <ErrorState fullScreen onRetry={reset} />
      </body>
    </html>
  );
}
