'use client';

import { useState, useEffect, useCallback } from 'react';

const COOKIE_KEY = 'NEXT_LOCALE';
const DEFAULT_LOCALE = 'ar';

export function getLocale(): string {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(^| )${COOKIE_KEY}=([^;]+)`));
  return match ? match[2] : DEFAULT_LOCALE;
}

export function setLocaleCookie(locale: string): void {
  document.cookie = `${COOKIE_KEY}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

export function useLocale() {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(getLocale());
  }, []);

  const switchLocale = useCallback((newLocale: string) => {
    setLocaleCookie(newLocale);
    setLocaleState(newLocale);
    window.location.reload();
  }, []);

  return { locale, switchLocale };
}
