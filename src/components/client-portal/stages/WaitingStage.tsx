'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '../ui';

interface Props {
  /** 1-based step shown in "Step N of 6". Omit for the assistant's card. */
  stepNo?: number;
  title: string;
  description: string;
  /** Extra content between the description and the "we'll notify you" line. */
  children?: ReactNode;
  /** Quote layout (edit requested) lets the text column fill the card. */
  wide?: boolean;
}

/** The pulsing-dot "nothing to do right now" card used by stages 1, 3, 5 and 6. */
export default function WaitingStage({ stepNo, title, description, children, wide }: Props) {
  const t = useTranslations('client_portal');
  return (
    <>
      {stepNo !== undefined && <div className="k">{t('step_of', { a: stepNo, b: 6 })}</div>}
      <div className="wait" style={{ marginTop: 14 }}>
        <div className="pulse" aria-hidden="true" />
        <div style={wide ? { flex: 1 } : undefined}>
          <h2 className="serifx">{title}</h2>
          <p className="lead" style={wide ? undefined : { margin: 0 }}>{description}</p>
          {children}
          <div className="notify">
            <Icon name="bellx" />
            {t('notify')}
          </div>
        </div>
      </div>
    </>
  );
}
