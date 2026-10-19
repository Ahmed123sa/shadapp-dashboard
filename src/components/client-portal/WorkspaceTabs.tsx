'use client';

import { useTranslations } from 'next-intl';
import type { ClientTabDef, ClientTabKey } from '@/lib/client-tabs';
import type { BadgeCounts } from '@/types';

interface Props {
  tabs: ClientTabDef[];
  active: ClientTabKey;
  counts?: Partial<BadgeCounts> | null;
  onSelect: (key: ClientTabKey) => void;
}

/** The workspace tab strip: label, optional count, red dot under the active tab. */
export default function WorkspaceTabs({ tabs, active, counts, onSelect }: Props) {
  const t = useTranslations('client_portal');
  return (
    <div className="tabs" role="tablist" aria-label={t('tabs_label')}>
      {tabs.map((tab) => {
        const n = tab.badge ? counts?.[tab.badge] ?? 0 : 0;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === active}
            className={`tab ${tab.key === active ? 'on' : ''}`.trim()}
            onClick={() => onSelect(tab.key)}
          >
            {t(`tab_${tab.key}`)}
            {n > 0 && <span className="n">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
