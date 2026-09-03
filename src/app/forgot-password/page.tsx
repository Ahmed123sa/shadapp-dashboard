'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

function ForgotPasswordForm() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const params = useSearchParams();

  // Staff and clients live in different tables with different reset brokers,
  // so the page has to know which endpoint to hit. It's carried in the query
  // string rather than guessed, since the same address could in principle
  // exist as both an account types.
  const isClient = params.get('type') === 'client';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const loginHref = isClient ? '/client-login' : '/login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isClient ? 'auth/client/forgot-password' : 'auth/forgot-password';
      const res = await fetch(`/api/proxy/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || t('reset_generic_error'));
        return;
      }
      // The backend answers identically whether or not the address exists, so
      // there is deliberately nothing here that reveals which it was.
      setSent(true);
    } catch {
      setError(t('reset_generic_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1A1A] px-4" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md bg-[#1E1E1E] rounded-2xl shadow-2xl p-8 border border-[#D4AF37]/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#941414]/20 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#D4AF37]/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="flex justify-center mb-4">
            <img src="/logo.jpg" alt="ShadApp" className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
          </div>
          <h1 className="text-xl font-bold text-center mb-2 text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            {t('forgot_title')}
          </h1>

          {sent ? (
            <>
              {/* Shown identically whether or not the address has an account —
                  the backend answers the same either way, so this stays a
                  confirmation of the request, never of the account existing. */}
              <div className="bg-emerald-500/10 text-emerald-300 text-sm p-4 rounded-lg border border-emerald-500/20 mt-4">
                {t('forgot_sent')}
              </div>
              <p className="text-center text-sm text-white/50 mt-6">
                <Link href={loginHref} className="text-[#D4AF37] hover:underline">{t('forgot_back_to_login')}</Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-white/50 text-center text-sm mb-6">{t('forgot_subtitle')}</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-[#941414]/20 text-[#D4AF37] text-sm p-3 rounded-lg border border-[#941414]/30">{error}</div>
                )}

                <div>
                  <label htmlFor="forgot-password-email" className="block text-sm font-medium text-white/80 mb-1">{t('login_email_label')}</label>
                  <input
                    id="forgot-password-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] bg-white/5 text-white placeholder-white/30"
                    required
                    dir="ltr"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#941414] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a1010] disabled:opacity-50 transition-colors"
                >
                  {loading ? t('forgot_sending') : t('forgot_submit')}
                </button>
              </form>

              <p className="text-center text-sm text-white/50 mt-6">
                <Link href={loginHref} className="text-[#D4AF37] hover:underline">{t('forgot_back_to_login')}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1A1A1A]" />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
