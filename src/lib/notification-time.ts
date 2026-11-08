// When a notification arrived, in the language of the interface. Recent ones
// read as relative time so a list of same-day items can still be told apart;
// older ones fall back to a short date.
//
//   under a minute  -> "Just now" (passed in, translated)
//   under an hour   -> "5 minutes ago"   / "قبل ٥ دقائق"
//   earlier today   -> "3:40 PM"         / "٣:٤٠ م"
//   yesterday       -> "Yesterday"       / "أمس"
//   this year       -> "Nov 8"           / "٨ نوفمبر"
//   older           -> "Nov 8, 2025"     / "٨ نوفمبر ٢٠٢٥"

const intlTag = (locale: string) => (locale === 'ar' ? 'ar-EG' : 'en-US');

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function formatNotificationTime(iso: string, locale: string, justNow: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  const tag = intlTag(locale);
  const diffMs = now.getTime() - at.getTime();

  // A clock a little ahead of the server's gives a small negative gap.
  if (diffMs < 60_000) return justNow;

  if (diffMs < 3_600_000) {
    const rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'always' });
    return rtf.format(-Math.floor(diffMs / 60_000), 'minute');
  }

  const dayGap = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (dayGap === 0) {
    return at.toLocaleTimeString(tag, { hour: 'numeric', minute: '2-digit' });
  }
  if (dayGap === 1) {
    const word = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }).format(-1, 'day');
    return word.charAt(0).toLocaleUpperCase(tag) + word.slice(1);
  }

  const sameYear = at.getFullYear() === now.getFullYear();
  return at.toLocaleDateString(tag, sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}
