import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { tajawal, playfairDisplay, archivo } from '@/lib/fonts';
import { Providers } from './providers';
import "./globals.css";

export const metadata: Metadata = {
  title: "ShadApp - Dashboard",
  description: "Client Relationship & Approval Management Platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`${tajawal.variable} ${playfairDisplay.variable} ${archivo.variable}`}>
      <body className="min-h-screen">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
