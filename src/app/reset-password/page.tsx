'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import AuthCard from '@/components/auth/AuthCard';
import { Btn } from '@/components/client-portal/ui';

function ResetPasswordForm() {
  const t = useTranslations('dashboard');
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
    <div className="f2">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="in"
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        dir="ltr"
        autoComplete="new-password"
      />
    </div>
  );

  return (
    <AuthCard>
      <h1>{t('reset_title')}<i>.</i></h1>

      {!linkIsUsable ? (
        <>
          <div className="lg-err" role="alert">{t('reset_invalid_link')}</div>
          <div className="lg-links">
            <Link href={isClient ? '/forgot-password?type=client' : '/forgot-password'} className="lnk">{t('forgot_submit')}</Link>
          </div>
        </>
      ) : done ? (
        <>
          <div className="lg-ok" role="status">{t('reset_success')}</div>
          <div className="lg-links">
            <Link href={loginHref} className="lnk">{t('reset_go_to_login')}</Link>
          </div>
        </>
      ) : (
        <>
          <p className="lg-sub num-ltr" dir="ltr">{email}</p>

          <form onSubmit={handleSubmit}>
            {error && <div className="lg-err" role="alert">{error}</div>}

            {field('reset-password-new', t('reset_new_password'), password, setPassword)}
            {field('reset-password-confirm', t('reset_confirm_password'), confirmation, setConfirmation)}

            <label className="opt" style={{ justifyContent: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
              <span>{t('login_password_label')}</span>
            </label>

            <Btn type="submit" variant="primary" size="lg" className="lg-btn" disabled={loading}>
              {loading ? t('reset_saving') : t('reset_submit')}
            </Btn>
          </form>

          <div className="lg-links">
            <Link href={loginHref} className="lnk">{t('forgot_back_to_login')}</Link>
          </div>
        </>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#141313' }} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
