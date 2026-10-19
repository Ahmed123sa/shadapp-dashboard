'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { clientLogout, getSubUser, isSubUser } from '@/lib/client-auth';
import { useLocale } from '@/lib/locale';
import NotificationBell from '@/components/NotificationBell';
import OnboardingTrack from './OnboardingTrack';
import OnboardingAside, { type ManagerInfo } from './OnboardingAside';
import { Avatar, Btn, Icon } from './ui';

interface Props {
  company: string;
  /** Display name of whoever is logged in (the client, or the assistant). */
  userName: string;
  /** 0-5, the highlighted step on the track. */
  step: number;
  manager?: ManagerInfo | null;
  /** Assistants only see a waiting card: no welcome, track or side column. */
  assistant?: boolean;
  children: ReactNode;
}

export default function OnboardingShell({ company, userName, step, manager, assistant, children }: Props) {
  const t = useTranslations('client_portal');
  const { locale, switchLocale } = useLocale();
  const sub = isSubUser();
  const name = sub ? (getSubUser()?.name ?? userName) : userName;

  return (
    <div className="cx-root">
      <div className="ob">
        <div className="glow" />
        <div className="grain" />
        <header className="otop">
          <div className="brand">
            <span className="d">d<i>.</i></span>
            <span className="word">Shad</span>
          </div>
          <span className="co">{company}</span>
          <div className="sp">
            <NotificationBell />
            <button type="button" className="lang" onClick={() => switchLocale(locale === 'ar' ? 'en' : 'ar')}>
              {t('lang_switch')}
            </button>
            <span className="role">{sub ? t('role_assistant') : t('role_owner')}</span>
            <Avatar name={name} />
            <Btn style={{ marginInlineStart: 6 }} onClick={() => clientLogout()}>
              <Icon name="out" />
              {t('logout')}
            </Btn>
          </div>
        </header>
        <main className="wrap" style={assistant ? { gridTemplateColumns: '1fr', maxWidth: 760 } : undefined}>
          <section>
            {!assistant && (
              <>
                <div className="hello">
                  <div className="eyebrow">{t('hi_eyebrow', { company })}</div>
                  <h1 className="serifx">{t('hi_title')}<i>.</i></h1>
                  <p>{t('hi_desc')}</p>
                </div>
                <OnboardingTrack step={step} />
              </>
            )}
            <div className="stage">{children}</div>
          </section>
          {!assistant && <OnboardingAside step={step} manager={manager} company={company} />}
        </main>
      </div>
    </div>
  );
}
