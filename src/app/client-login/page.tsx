'use client';

import UnifiedLogin from '@/components/auth/UnifiedLogin';

/** Kept as its own address (links, emails, bookmarks); same screen, opened on the client side of the switch. */
export default function ClientLoginPage() {
  return <UnifiedLogin initialMode="client" />;
}
