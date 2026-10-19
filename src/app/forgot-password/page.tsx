'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import AuthCard, { type AuthMode } from '@/components/auth/AuthCard';
import AuthModeSwitch from '@/components/auth/AuthModeSwitch';
import { Btn } from '@/components/client-portal/ui';

function ForgotPasswordForm() {
  const t = useTranslations('dashboard');
  const params = useSearchParams();

  // Staff and clients live in different tables with different reset brokers,
  // so the page has to know which endpoint to hit. It's carried in the query
  // string rather than guessed, since the same address could in principle
  // exist as both an account types.
  const [mode, setMode] = useState<AuthMode>(params.get('type') === 'client' ? 'client' : 'staff');
  const isClient = mode === 'client';

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
    <AuthCard>
      <h1>{t('forgot_title')}<i>.</i></h1>

      {sent ? (
        <>
          {/* Shown identically whether or not the address has an account —
              the backend answers the same either way, so this stays a
              confirmation of the request, never of the account existing. */}
          <div className="lg-ok" role="status">{t('forgot_sent')}</div>
          <div className="lg-links">
            <Link href={loginHref} className="lnk">{t('forgot_back_to_login')}</Link>
          </div>
        </>
      ) : (
        <>
          <p className="lg-sub">{t('forgot_subtitle')}</p>

          <form onSubmit={handleSubmit}>
            {error && <div className="lg-err" role="alert">{error}</div>}

            <div className="f2">
              <label htmlFor="forgot-password-email">{t('login_email_label')}</label>
              <input id="forgot-password-email" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
            </div>

            <Btn type="submit" variant="primary" size="lg" className="lg-btn" disabled={loading}>
              {loading ? t('forgot_sending') : t('forgot_submit')}
            </Btn>
          </form>

          <div className="lg-links">
            <Link href={loginHref} className="lnk">{t('forgot_back_to_login')}</Link>
          </div>
          <AuthModeSwitch mode={mode} onChange={(m) => { setMode(m); setError(''); }} />
        </>
      )}
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#141313' }} />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
