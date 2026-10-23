'use client';

import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import '@/styles/client-portal.css';

export type AuthMode = 'client' | 'staff';

/** The Luxe card every sign-in screen sits in (login, forgot / reset password). `brand` swaps the static d. for the animated mark on the sign-in screen. */
export default function AuthCard({ children, brand }: { children: ReactNode; brand?: ReactNode }) {
  const locale = useLocale();
  return (
    <div className="cx-root cx-login" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="glow" />
      <div className="grain" />
      <div className="lg-wrap">
        <div className="lg-card">
          <div className="brand">
            {brand ?? <span className="d">d<i>.</i></span>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
