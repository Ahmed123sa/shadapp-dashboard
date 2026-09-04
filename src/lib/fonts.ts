import { Tajawal, Playfair_Display, Archivo } from 'next/font/google';

// Centralized font loading via next/font — replaces the old `@import` from
// Google Fonts in globals.css (which pulled 4 families / 17 weights while
// only Tajawal and Playfair Display are actually used anywhere in the app).
// next/font self-hosts the font files at build time (no runtime request to
// fonts.googleapis.com) and avoids render-blocking @import.
//
// Both the root layout (layout.tsx) and the standalone error boundary
// (global-error.tsx, which renders its own <html>/<body> with no shared
// ancestor) import from here so the two stay in sync.

export const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-tajawal',
  display: 'swap',
});

export const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

// دليل الهوية بيحدد Archivo كخط النص الإنجليزي الأساسي (مش بس عناوين).
// بيتفعّل بس لما html[lang="en"] عبر globals.css — العربي فاضل على Tajawal
// لأن خط الدليل العربي (Bahij TheSansArabic) مش متاح مجانًا على Google Fonts.
export const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-archivo',
  display: 'swap',
});
