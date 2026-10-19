'use client';

import { useTranslations } from 'next-intl';
import { Avatar, Icon } from './ui';

const STEP_KEYS = ['step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'step_6'] as const;

export interface ManagerInfo {
  name?: string | null;
  phone?: string | null;
}

/** Same cleaning the mobile app does before opening WhatsApp. */
export function supportLink(phone: string | null | undefined, message: string): string | null {
  let digits = (phone ?? '').replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Right-hand column: the account manager and the steps still ahead. */
export default function OnboardingAside({ step, manager, company }: { step: number; manager?: ManagerInfo | null; company: string }) {
  const t = useTranslations('client_portal');
  const href = supportLink(manager?.phone, t('support_msg', { company }));
  return (
    <aside className="aside">
      {manager?.name && (
        <div className="box">
          <div className="h">{t('mgr_h')}</div>
          <div className="mgr">
            <Avatar name={manager.name} />
            <div>
              <div className="n serifx">{manager.name}</div>
              <div className="r">{t('mgr_role')}</div>
            </div>
          </div>
          {href && (
            <a className="lnk" href={href} target="_blank" rel="noopener noreferrer">
              <Icon name="chat2" />
              {t('contact')}
            </a>
          )}
        </div>
      )}
      <div className="box">
        <div className="h">{t('next_h')}</div>
        <ul className="next">
          {STEP_KEYS.map((key, i) => (
            <li key={key} className={i < step ? 'done' : i === step ? 'now' : ''}>
              <span className="i">0{i + 1}</span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
