'use client';

import { useState } from 'react';
import { clientLogin, getClient, getSubUser, isSubUser } from '@/lib/client-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { reportError } from '@/lib/error-reporting';
import { Btn, Icon } from '@/components/client-portal/ui';
import '@/styles/client-portal.css';

function Brand() {
  return (
    <div className="brand">
      <span className="d">d<i>.</i></span>
      <span className="word">Shad</span>
    </div>
  );
}

export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard');

  const existing = getClient();
  if (existing) {
    const subName = isSubUser() ? getSubUser()?.name : null;
    return (
      <div className="cx-root cx-login" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <div className="glow" />
        <div className="grain" />
        <div className="lg-wrap">
          <div className="lg-card" style={{ textAlign: 'center' }}>
            <Brand />
            <h1>
              {subName ? t('client_greeting', { name: subName }) : t('client_greeting', { name: existing.contact_person })}
            </h1>
            <p className="lg-sub">{subName ? t('client_sub_user_label') : existing.company_name}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link href="/client-dashboard" className="btn primary lg">{t('client_enter_dashboard')}</Link>
              <Btn size="lg" onClick={async () => { localStorage.removeItem('client'); localStorage.removeItem('sub_user'); localStorage.removeItem('sub_user_client'); try { await fetch('/api/session/logout', { method: 'POST' }); } catch (err) { reportError('client-login.logout', err); } window.location.reload(); }}>
                {t('client_logout_btn')}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await clientLogin(email, password);
      router.push('/client-dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.errors?.email?.[0] || t('login_error_invalid_credentials');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cx-root cx-login" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="glow" />
      <div className="grain" />
      <div className="lg-wrap">
        <div className="lg-card">
          <Brand />
          <h1>{t('login_client_link')}<i>.</i></h1>
          <p className="lg-sub">ShadApp</p>

          <form onSubmit={handleSubmit}>
            {error && <div className="lg-err" role="alert">{error}</div>}

            <div className="f2">
              <label htmlFor="client-login-email">{t('login_email_label')}</label>
              <input id="client-login-email" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" autoComplete="username" />
            </div>

            <div className="f2">
              <label htmlFor="client-login-password">{t('login_password_label')}</label>
              <input id="client-login-password" className="in" type={visible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" autoComplete="new-password" style={{ paddingInlineEnd: 32 }} />
              <button type="button" className="eye" onClick={() => setVisible(!visible)} aria-label={visible ? t('pw_hide') : t('pw_show')}>
                <Icon name="eye" />
              </button>
            </div>

            <Btn type="submit" variant="primary" size="lg" className="lg-btn" disabled={loading}>
              {loading ? t('login_loading') : t('login_submit')}
            </Btn>
          </form>

          <div className="lg-links">
            <Link href="/forgot-password?type=client" className="lnk">{t('forgot_link')}</Link>
            <Link href="/login" className="lnk">{t('client_admin_login_link')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
