'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';

// The "Ads contract" switch of the contract form. Ticking it reveals the
// percentage (the agency's fee, inside the contract value). Unticking it makes
// the contract a normal one again.

// 0.01 to 100, the same limits the backend enforces.
export function isValidAdsPercentage(raw: string): boolean {
  if (raw.trim() === '') return false;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0.01 && n <= 100;
}

export default function AdsFeeField({
  enabled,
  percentage,
  showError,
  onEnabledChange,
  onPercentageChange,
}: {
  enabled: boolean;
  percentage: string;
  showError: boolean;
  onEnabledChange: (on: boolean) => void;
  onPercentageChange: (value: string) => void;
}) {
  const t = useTranslations('ads');
  const id = useId();
  const invalid = enabled && showError && !isValidAdsPercentage(percentage);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-gold-text)]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          aria-describedby={`${id}-hint`}
        />
        <span>{t('toggle')}</span>
      </label>
      <p id={`${id}-hint`} className="text-xs text-[var(--color-text-disabled)]">{t('toggle_hint')}</p>
      {enabled && (
        <div className="space-y-1">
          <label htmlFor={`${id}-pct`} className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {t('percentage_label')}
          </label>
          <input
            id={`${id}-pct`}
            type="number"
            inputMode="decimal"
            min="0.01"
            max="100"
            step="0.01"
            value={percentage}
            onChange={(e) => onPercentageChange(e.target.value)}
            placeholder={t('percentage_ph')}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${id}-err` : undefined}
            className={`border rounded-lg px-3 py-2 text-sm w-28 bg-[var(--color-input-fill)] text-[var(--color-foreground)] ${
              invalid ? 'border-[var(--color-error)]' : 'border-[var(--color-input-border)]'
            }`}
          />
          {invalid && (
            <p id={`${id}-err`} role="alert" className="text-xs text-[var(--color-error-text)]">
              {t('percentage_invalid')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
