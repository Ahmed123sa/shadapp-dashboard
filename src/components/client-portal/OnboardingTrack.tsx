'use client';

import { useTranslations } from 'next-intl';

const STEP_KEYS = ['step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'step_6'] as const;

/** The six-step track under the welcome heading. `step` is 0-5. */
export default function OnboardingTrack({ step }: { step: number }) {
  const t = useTranslations('client_portal');
  return (
    <div className="track" role="list">
      {STEP_KEYS.map((key, i) => {
        const state = i < step ? 'done' : i === step ? 'now' : '';
        return (
          <div key={key} role="listitem" aria-current={i === step ? 'step' : undefined} className={`tstep ${state}`.trim()}>
            <span className="b" />
            <span className="n">0{i + 1}</span>
            <span className="l">{t(key)}</span>
          </div>
        );
      })}
    </div>
  );
}
