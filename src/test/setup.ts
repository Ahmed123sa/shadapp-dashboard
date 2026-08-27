import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import React from 'react';

// next/link reaches for the App Router context (for prefetching) that only
// exists inside a real Next.js tree. Outside one — i.e. every component
// test — it throws rather than degrading gracefully, so it's replaced
// globally with a plain anchor. Behaviorally equivalent for what these
// tests check (the href, the click), just without Next's routing machinery.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement('a', { href: typeof href === 'string' ? href : href?.pathname, ...rest }, children),
}));

// Unmounts anything rendered by the previous test and clears jsdom's
// localStorage/document between tests — without this, state set by
// lib/auth.ts or lib/client-auth.ts (both of which write to localStorage)
// would leak from one test file's assertions into the next.
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
});
