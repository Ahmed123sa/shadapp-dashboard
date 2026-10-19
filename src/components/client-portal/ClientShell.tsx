'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { clientLogout, getSubUser, isSubUser } from '@/lib/client-auth';
import { useLocale } from '@/lib/locale';
import NotificationBell from '@/components/NotificationBell';
import { Avatar, Icon } from './ui';
import type { IconName } from './ui/icons';

export type ShellPage = 'ws' | 'team' | 'sig' | 'set';

interface Props {
  company: string;
  /** Name of the person logged in (client contact or assistant). */
  userName: string;
  active: ShellPage;
  /** Sum of the unread/pending badges the user can see; hidden when 0. */
  wsCount?: number;
  children: ReactNode;
}

/** Sidebar + top bar around every signed-in client page (workspace, team, signature, settings). */
export default function ClientShell({ company, userName, active, wsCount = 0, children }: Props) {
  const t = useTranslations('client_portal');
  const { locale, switchLocale } = useLocale();
  const sub = isSubUser();
  const name = sub ? (getSubUser()?.name ?? userName) : userName;
  const role = sub ? t('role_assistant') : t('role_owner');

  const item = (page: ShellPage, href: string, icon: IconName, label: string, count?: number) => (
    <Link key={page} href={href} className={active === page ? 'on' : ''} aria-current={active === page ? 'page' : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
      {count ? <span className="count">{count}</span> : null}
    </Link>
  );

  const crumbPage = { ws: t('nav_workspace'), team: t('nav_team'), sig: t('nav_signature'), set: t('nav_settings') }[active];

  return (
    <div className="cx-root cx-ws">
      <div className="app">
        <div className="glow" />
        <div className="grain" />
        <aside className="rail">
          <div className="brand">
            <span className="d">d<i>.</i></span>
            <span className="word">Shad</span>
          </div>
          <div className="cotag">
            <div className="n">{company}</div>
            <div className="r">{role}</div>
          </div>
          <nav className="nav" aria-label={t('tabs_label')}>
            <div className="group">{t('grp_workspace')}</div>
            {item('ws', '/client-dashboard', 'grid', t('nav_workspace'), wsCount)}
            <div className="group">{t('grp_account')}</div>
            {!sub && item('team', '/client-dashboard/team', 'users', t('nav_team'))}
            {!sub && item('sig', '/client-dashboard/signature', 'sign', t('nav_signature'))}
            {item('set', '/client-dashboard/settings', 'gear', t('nav_settings'))}
          </nav>
          <div className="me">
            <Avatar name={name} />
            <div>
              <div className="n">{name}</div>
              <div className="r">{role}</div>
            </div>
            <button type="button" className="ib" style={{ marginInlineStart: 'auto' }} title={t('logout')} aria-label={t('logout')} onClick={() => clientLogout()}>
              <Icon name="out" />
            </button>
          </div>
        </aside>
        <section className="main">
          <header className="top">
            <div className="crumb">{company} &nbsp;/&nbsp; <b>{crumbPage}</b></div>
            <span style={{ marginInlineStart: 'auto' }} />
            <NotificationBell />
            <button type="button" className="lang" onClick={() => switchLocale(locale === 'ar' ? 'en' : 'ar')}>{t('lang_switch')}</button>
          </header>
          {children}
        </section>
      </div>
    </div>
  );
}
