'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

function ResetPasswordForm() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const params = useSearchParams();

  // All three come from the emailed link. `type` decides which broker the
  // token belongs to — staff and clients have separate token tables, so
  // posting to the wrong endpoint would just be rejected.
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const isClient = params.get('type') === 'client';

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const loginHref = isClient ? '/client-login' : '/login';
  const linkIsUsable = Boolean(token && email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Checked here purely so the user gets an instant, specific message; the
    // backend enforces both rules regardless.
    if (password !== confirmation) {
      setError(t('reset_mismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('reset_too_short'));
      return;
    }

    setLoading(true);
    try {
      const endpoint = isClient ? 'auth/client/reset-password' : 'auth/reset-password';
      const res = await fetch(`/api/proxy/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          token,
          email,
          password,
          password_confirmation: confirmation,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data?.message
            || data?.errors?.password?.[0]
            || t('reset_generic_error')
        );
        return;
      }
      setDone(true);
    } catch {
      setError(t('reset_generic_error'));
    } finally {
      setLoading(false);
    }
  };

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-white/80 mb-1">{label}</label>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] bg-white/5 text-white placeholder-white/30"
        required
        dir="ltr"
        autoComplete="new-password"
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-sidebar-hover)] px-4" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md bg-[#1E1E1E] rounded-2xl shadow-2xl p-8 border border-[var(--color-gold)]/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/20 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[var(--color-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="flex justify-center mb-4">
            <img src="/logo.jpg" alt="ShadApp" className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
          </div>
          <h1 className="text-xl font-bold text-center mb-4 text-white font-display">
            {t('reset_title')}
          </h1>

          {!linkIsUsable ? (
            <>
              <div className="bg-[var(--color-primary)]/20 text-[var(--color-gold)] text-sm p-3 rounded-lg border border-[var(--color-primary)]/30">
                {t('reset_invalid_link')}
              </div>
              <p className="text-center text-sm text-white/50 mt-6">
                <Link
                  href={isClient ? '/forgot-password?type=client' : '/forgot-password'}
                  className="text-[var(--color-gold)] hover:underline"
                >
                  {t('forgot_submit')}
                </Link>
              </p>
            </>
          ) : done ? (
            <>
              <div className="bg-emerald-500/10 text-emerald-300 text-sm p-4 rounded-lg border border-emerald-500/20">
                {t('reset_success')}
              </div>
              <p className="text-center text-sm text-white/50 mt-6">
                <Link href={loginHref} className="text-[var(--color-gold)] hover:underline">{t('reset_go_to_login')}</Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-white/50 text-center text-sm mb-6" dir="ltr">{email}</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-[var(--color-primary)]/20 text-[var(--color-gold)] text-sm p-3 rounded-lg border border-[var(--color-primary)]/30">{error}</div>
                )}

                {field('reset-password-new', t('reset_new_password'), password, setPassword)}
                {field('reset-password-confirm', t('reset_confirm_password'), confirmation, setConfirmation)}

                <label className="flex items-center gap-2 text-xs text-white/50 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={(e) => setVisible(e.target.checked)}
                    className="accent-[var(--color-gold)]"
                  />
                  {t('login_password_label')}
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[var(--color-primary)] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a1010] disabled:opacity-50 transition-colors"
                >
                  {loading ? t('reset_saving') : t('reset_submit')}
                </button>
              </form>

              <p className="text-center text-sm text-white/50 mt-6">
                <Link href={loginHref} className="text-[var(--color-gold)] hover:underline">{t('forgot_back_to_login')}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-sidebar-hover)]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
