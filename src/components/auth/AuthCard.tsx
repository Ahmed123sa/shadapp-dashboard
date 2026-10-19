'use client';

import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import '@/styles/client-portal.css';

export type AuthMode = 'client' | 'staff';

/** The Luxe card every sign-in screen sits in (login, forgot / reset password). */
export default function AuthCard({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return (
    <div className="cx-root cx-login" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="glow" />
      <div className="grain" />
      <div className="lg-wrap">
        <div className="lg-card">
          <div className="brand">
            <span className="d">d<i>.</i></span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
