'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { login } from '@/lib/auth';
import { clientLogin, getClient, getSubUser, isSubUser } from '@/lib/client-auth';
import { reportError } from '@/lib/error-reporting';
import { Btn, Icon } from '@/components/client-portal/ui';
import AuthCard, { type AuthMode } from './AuthCard';
import AuthModeSwitch from './AuthModeSwitch';
import ShadMark from './ShadMark';
import ButtonLoader from './ButtonLoader';

/**
 * One sign-in screen for everybody. The switch picks which door you use:
 * clients (and their assistants) go to /client-dashboard, managers, super
 * admins and team members go to /dashboard. Each side keeps its own backend
 * call exactly as before.
 */
export default function UnifiedLogin({ initialMode }: { initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [errorTick, setErrorTick] = useState(0);
  const router = useRouter();
  const t = useTranslations('dashboard');

  const switchMode = (next: AuthMode) => { setMode(next); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      if (mode === 'client') {
        await clientLogin(email, password);
        router.push('/client-dashboard');
      } else {
        await login(email, password);
        router.push('/dashboard');
      }
      // Signed in: keep the loader running while the next page loads (no success screen).
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.errors?.email?.[0] || t('login_error_invalid_credentials');
      setError(msg);
      setErrorTick((n) => n + 1);
      setLoading(false);
    }
  };

  const existing = mode === 'client' ? getClient() : null;

  if (existing) {
    const subName = isSubUser() ? getSubUser()?.name : null;
    return (
      <AuthCard>
        <h1 style={{ textAlign: 'center' }}>{t('client_greeting', { name: subName ?? existing.contact_person })}</h1>
        <p className="lg-sub">{subName ? t('client_sub_user_label') : existing.company_name}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href="/client-dashboard" className="btn primary lg">{t('client_enter_dashboard')}</Link>
          <Btn size="lg" onClick={async () => { localStorage.removeItem('client'); localStorage.removeItem('sub_user'); localStorage.removeItem('sub_user_client'); try { await fetch('/api/session/logout', { method: 'POST' }); } catch (err) { reportError('client-login.logout', err); } window.location.reload(); }}>
            {t('client_logout_btn')}
          </Btn>
        </div>
        <AuthModeSwitch mode={mode} onChange={switchMode} />
      </AuthCard>
    );
  }

  return (
    <AuthCard brand={<ShadMark errorTick={errorTick} />}>
      <h1 style={{ marginBottom: 28 }}>Shad<i>.</i></h1>

      <form onSubmit={handleSubmit}>
        {error && <div className="lg-err" role="alert">{error}</div>}

        <div className="f2">
          <label htmlFor="login-email">{t('login_email_label')}</label>
          <input id="login-email" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" autoComplete="username" />
        </div>

        <div className="f2">
          <label htmlFor="login-password">{t('login_password_label')}</label>
          <input id="login-password" className="in" type={visible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" autoComplete="new-password" style={{ paddingInlineEnd: 32 }} />
          <button type="button" className="eye" onClick={() => setVisible(!visible)} aria-label={visible ? t('pw_hide') : t('pw_show')}>
            <Icon name="eye" />
          </button>
        </div>

        <Btn type="submit" variant="primary" size="lg" className="lg-btn" aria-busy={loading}>
          {loading && <ButtonLoader />}
          {loading ? t('login_loading') : t('login_submit')}
        </Btn>
      </form>

      <div className="lg-links">
        <Link href={mode === 'client' ? '/forgot-password?type=client' : '/forgot-password'} className="lnk">{t('forgot_link')}</Link>
      </div>

      <AuthModeSwitch mode={mode} onChange={switchMode} />
    </AuthCard>
  );
}
