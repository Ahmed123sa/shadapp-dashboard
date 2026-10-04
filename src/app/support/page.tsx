'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';

// Public support page — the "Support URL" App Store Review requires. No login
// needed. It carries its own AR/EN strings (instead of the dashboard message
// files) so it stays a self-contained page that can't be broken by changes to
// the app's namespaces, and so the visitor can flip language on the spot.

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@shadmanagement.co';

const STRINGS = {
  en: {
    title: 'ShadApp Support',
    subtitle: 'Have a question, a problem, or a complaint? Send us a message and we will get back to you.',
    name: 'Your name',
    email: 'Your email',
    subject: 'Subject (optional)',
    message: 'How can we help?',
    send: 'Send message',
    sending: 'Sending…',
    sent: 'Your message was sent. We will reply to your email soon.',
    error: 'Could not send your message. Please try again.',
    contact: 'You can also email us directly at',
    switchTo: 'العربية',
  },
  ar: {
    title: 'دعم ShadApp',
    subtitle: 'عندك سؤال أو مشكلة أو شكوى؟ ابعتلنا رسالة وهنرد عليك.',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    subject: 'الموضوع (اختياري)',
    message: 'نقدر نساعدك إزاي؟',
    send: 'إرسال',
    sending: 'جاري الإرسال…',
    sent: 'تم إرسال رسالتك. هنرد عليك على بريدك قريبًا.',
    error: 'تعذّر إرسال رسالتك. حاول مرة أخرى.',
    contact: 'ولو حبيت تراسلنا مباشرة على',
    switchTo: 'English',
  },
} as const;

export default function SupportPage() {
  const initial = useLocale() === 'ar' ? 'ar' : 'en';
  const [lang, setLang] = useState<'ar' | 'en'>(initial);
  const s = STRINGS[lang];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  // Honeypot: hidden from people, filled by bots; the server rejects it.
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim(), website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const firstFieldError = data?.errors ? (Object.values(data.errors)[0] as string[])?.[0] : undefined;
        setError(firstFieldError || data?.message || s.error);
        return;
      }
      setSent(true);
    } catch {
      setError(s.error);
    } finally {
      setLoading(false);
    }
  };

  const input =
    'w-full border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] bg-white/5 text-white placeholder-white/30';
  const label = 'block text-sm font-medium text-white/80 mb-1';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-sidebar-hover)] px-4 py-10" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-lg bg-[#1E1E1E] rounded-2xl shadow-2xl p-8 border border-[var(--color-gold)]/20">
        <div className="flex justify-between items-start mb-4">
          <img src="/logo.jpg" alt="ShadApp" className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
          <button
            type="button"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="text-sm text-[var(--color-gold)] hover:underline"
          >
            {s.switchTo}
          </button>
        </div>

        <h1 className="text-xl font-bold text-white mb-2 font-display">{s.title}</h1>
        <p className="text-white/50 text-sm mb-6">{s.subtitle}</p>

        {sent ? (
          <div className="bg-emerald-500/10 text-emerald-300 text-sm p-4 rounded-lg border border-emerald-500/20">{s.sent}</div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="bg-[var(--color-primary)]/20 text-[var(--color-gold)] text-sm p-3 rounded-lg border border-[var(--color-primary)]/30">{error}</div>
            )}

            <div>
              <label htmlFor="support-name" className={label}>{s.name}</label>
              <input id="support-name" value={name} onChange={(e) => setName(e.target.value)} className={input} required maxLength={120} />
            </div>
            <div>
              <label htmlFor="support-email" className={label}>{s.email}</label>
              <input id="support-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} required dir="ltr" />
            </div>
            <div>
              <label htmlFor="support-subject" className={label}>{s.subject}</label>
              <input id="support-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={input} maxLength={150} />
            </div>
            <div>
              <label htmlFor="support-message" className={label}>{s.message}</label>
              <textarea id="support-message" value={message} onChange={(e) => setMessage(e.target.value)} className={input} rows={6} required minLength={10} maxLength={5000} />
            </div>

            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--color-primary)] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a1010] disabled:opacity-50 transition-colors"
            >
              {loading ? s.sending : s.send}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-white/10 text-sm text-white/60">
          <p>
            {s.contact}{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--color-gold)] hover:underline" dir="ltr">{SUPPORT_EMAIL}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
