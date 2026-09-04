'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// One QueryClient per browser session, created lazily inside useState so it
// survives re-renders but isn't shared across users on the server (Next.js
// can reuse a module instance across requests — a module-level singleton
// here would leak one user's cached data into another's response).
//
// Defaults are deliberately conservative rather than React Query's factory
// defaults (staleTime: 0, which refetches on every mount): the data behind
// these queries (payments, contracts, ...) doesn't change every few seconds,
// and several screens already have their own websocket (Echo) or polling
// path that calls queryClient.invalidateQueries() when something actually
// changes. A short staleTime avoids the classic "switch tabs, flash of
// spinner for data we just had" without silently going stale for minutes.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
