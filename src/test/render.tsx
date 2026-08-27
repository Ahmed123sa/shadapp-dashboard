import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../messages/en.json';
import arMessages from '../../messages/ar.json';

/// Wraps components that call useTranslations()/useLocale() with the same
/// NextIntlClientProvider the real app tree provides — without it, every
/// component under test throws "No intl context found" before rendering
/// anything. Pulls the real message files rather than a hand-picked subset
/// so a renamed/removed translation key breaks the test the same way it
/// would break the app, instead of a stale copy masking it.
export function renderWithIntl(ui: ReactElement, { locale = 'en' as 'en' | 'ar' } = {}) {
  const messages = locale === 'ar' ? arMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}
