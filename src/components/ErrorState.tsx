'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ErrorStateProps {
  onRetry?: () => void;
  fullScreen?: boolean;
}

// Deliberately self-contained: no next-intl dependency. This renders inside
// error boundaries, including global-error.tsx which replaces the root
// layout (and therefore has no NextIntlClientProvider at all) — depending on
// the translation system here would mean the "something broke" screen can
// itself break if the crash is intl-related. Locale is read straight off
// <html lang> instead, same source root layout already sets it from.
export default function ErrorState({ onRetry, fullScreen = false }: ErrorStateProps) {
  const [isArabic, setIsArabic] = useState(true);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsArabic(document.documentElement.lang !== 'en');
    }
  }, []);

  const text = isArabic
    ? {
        title: 'حصل خطأ غير متوقع',
        body: 'حاولنا نكمل بس حصلت مشكلة فنية. جرّب تاني، ولو المشكلة استمرت كلّم الدعم الفني.',
        retry: 'حاول تاني',
        home: 'الرئيسية',
      }
    : {
        title: 'Something went wrong',
        body: 'We hit an unexpected error. Try again, and if it keeps happening let support know.',
        retry: 'Try again',
        home: 'Home',
      };

  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 px-5 ${fullScreen ? 'min-h-screen' : 'py-16'}`}>
      <div className="w-12 h-12 rounded-full bg-[var(--color-crimson-soft)] border border-[var(--color-crimson-border)] flex items-center justify-center text-[var(--color-primary-light)] text-xl">
        !
      </div>
      <h2 className="text-base font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
        {text.title}
      </h2>
      <p className="text-[13px] text-[var(--color-text-secondary)] max-w-sm">{text.body}</p>
      <div className="flex items-center gap-3 mt-1">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-foreground)] text-[12.5px] font-medium hover:bg-[var(--color-primary-dark)] transition-colors cursor-pointer"
          >
            {text.retry}
          </button>
        )}
        <Link
          href="/"
          className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--color-text-secondary)] text-[12.5px] hover:text-[var(--color-foreground)] transition-colors"
        >
          {text.home}
        </Link>
      </div>
    </div>
  );
}
