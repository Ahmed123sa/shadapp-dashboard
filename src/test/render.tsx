import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../messages/en.json';
import arMessages from '../../messages/ar.json';

/// Wraps components that call useTranslations()/useLocale() with the same
/// NextIntlClientProvider the real app tree provides — without it, every
/// component under test throws "No intl context found" before rendering
/// anything. Pulls the real message files rather than a hand-picked subset
/// so a renamed/removed translation key breaks the test the same way it
/// would break the app, instead of a stale copy masking it.
///
/// Also wraps with a fresh QueryClientProvider per render (retry: false so a
/// mocked-error test doesn't sit there retrying for seconds before the
/// assertion sees it, and no caching between tests since each render gets
/// its own client instance).
export function renderWithIntl(ui: ReactElement, { locale = 'en' as 'en' | 'ar' } = {}) {
  const messages = locale === 'ar' ? arMessages : enMessages;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}
