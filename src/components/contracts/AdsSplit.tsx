'use client';

import { useLocale, useTranslations } from 'next-intl';

// Ads contracts: the agency's management fee is a share of the contract value
// (inside it, never on top). The backend sends the split already computed, so
// this only shows it; the value, the tax and the total are not touched.

export interface AdsFields {
  ads_percentage?: number | string | null;
  ads_amount?: number | string | null;
  ads_budget?: number | string | null;
  conversion_percentage?: number | string | null;
  conversion_amount?: number | string | null;
}

export function hasAds(c: AdsFields | null | undefined): boolean {
  return !!c && c.ads_percentage != null && c.ads_percentage !== '' && c.ads_amount != null && c.ads_budget != null;
}

// An ads contract with a dollar-conversion fee above zero. The fee is added on
// top of the value (never inside it, never taxed).
export function hasConversion(c: AdsFields | null | undefined): boolean {
  return hasAds(c) && c!.conversion_amount != null && Number(c!.conversion_amount) > 0;
}

function useNumberFormat() {
  const locale = useLocale();
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 });
}

// The two lines under a contract value: the fee, then the budget.
export default function AdsSplit({
  ads,
  currency = 'SAR',
  className,
  style,
}: {
  ads: AdsFields;
  currency?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = useTranslations('ads');
  const nf = useNumberFormat();
  if (!hasAds(ads)) return null;

  return (
    <div className={className} style={style} data-testid="ads-split">
      <div>
        {t('fee', { pct: nf.format(Number(ads.ads_percentage)) })}: <bdi>{nf.format(Number(ads.ads_amount))} {currency}</bdi>
      </div>
      <div>
        {t('budget')}: <bdi>{nf.format(Number(ads.ads_budget))} {currency}</bdi>
      </div>
      {hasConversion(ads) && (
        <>
          <div data-testid="ads-conversion">
            {t('conversion', { pct: nf.format(Number(ads.conversion_percentage)) })}: <bdi>{nf.format(Number(ads.conversion_amount))} {currency}</bdi>
          </div>
          <div>{t('excl_conversion')}</div>
        </>
      )}
    </div>
  );
}

// Small label for a contract card, so an ads contract stands out in a long list.
export function AdsBadge({ className }: { className?: string }) {
  const t = useTranslations('ads');
  return (
    <span
      className={className ?? 'px-2 py-0.5 rounded-full text-[9px] font-semibold border border-[var(--color-gold-border)] text-[var(--color-gold-text)]'}
      data-testid="ads-badge"
    >
      {t('badge')}
    </span>
  );
}
