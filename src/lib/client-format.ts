/** Number/date formatting shared by the client portal screens. */

const intlLocale = (locale: string) => (locale === 'ar' ? 'ar-EG' : 'en-US');

export function formatNumber(value: number | string | null | undefined, locale: string): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(n);
}

/** "17 Oct" / "١٧ أكتوبر" — empty string for missing or invalid dates. */
export function formatShortDate(value: string | Date | null | undefined, locale: string): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' });
}

export function formatTime(value: string | Date | null | undefined, locale: string): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatFileSize(bytes: number | null | undefined): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
