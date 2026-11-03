'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { getClient } from '@/lib/client-auth';
import { useClient } from '@/hooks/queries/useClients';
import { useClientAssistant, type AssistantQuestion } from '@/hooks/queries/useClientAssistant';
import { Icon } from './ui';

/**
 * The floating assistant (CLIENT_ASSISTANT_PLAN.md ٦). A button in the corner
 * opens a small chat-shaped panel: ready questions, one tap each, the answer
 * from the client's own data and a button to the right tab. No free typing and
 * no fake "typing..." — the answer is there at once, because it is not an AI.
 *
 * It shows only when the server says it is switched on, and stays out of the
 * way (renders nothing) when anything goes wrong.
 */
export default function ClientAssistant() {
  const t = useTranslations('client_portal');
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const session = getClient();
  const { data: client } = useClient(session?.id ?? '', { enabled: !!session?.id });
  const wsId = client?.workspace?.id;
  const { data, refetch } = useClientAssistant(wsId);

  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState<AssistantQuestion[]>([]);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // A fresh copy every time the panel opens; the numbers are the point.
  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  // Esc closes, and the focus goes back to the button it came from.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Keep the newest answer in view.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [asked, open]);

  if (!data || !data.enabled) return null;

  const name = data.assistant.name[locale];
  // The shown answers come from the latest fetch, so an already asked question
  // refreshes together with it.
  const current = (q: AssistantQuestion) => data.questions.find((x) => x.id === q.id && x.key === q.key) ?? q;
  const ask = (q: AssistantQuestion) => setAsked((prev) => [...prev, q]);
  const close = () => {
    setOpen(false);
    fabRef.current?.focus();
  };

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          className="ast-panel"
          role="dialog"
          aria-modal="true"
          aria-label={name}
          tabIndex={-1}
        >
          <div className="ast-head">
            <span className="ast-mark" aria-hidden="true"><Icon name="chat2" /></span>
            <div className="ast-title">
              <div className="n">{name}</div>
              <div className="s">{t('assistant_subtitle')}</div>
            </div>
            <button type="button" className="ast-x" onClick={close} aria-label={t('assistant_close')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <div className="ast-body" ref={bodyRef} aria-live="polite">
            <div className="ast-bubble bot">{data.assistant.welcome[locale]}</div>
            {asked.map((q, i) => {
              const a = current(q);
              return (
                <div key={`${q.key ?? q.id}-${i}`} className="ast-turn">
                  <div className="ast-bubble user">{a.question[locale]}</div>
                  <div className="ast-bubble bot">
                    <div className="ast-text">{a.answer[locale]}</div>
                    {a.progress && a.progress.total > 0 && (
                      <div
                        className="ast-bar"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={a.progress.total}
                        aria-valuenow={a.progress.paid}
                      >
                        <i style={{ width: `${Math.min(100, Math.round((a.progress.paid / a.progress.total) * 100))}%` }} />
                      </div>
                    )}
                    {a.actions.length > 0 && (
                      <div className="ast-actions">
                        {a.actions.map((act) => (
                          <Link
                            key={act.target}
                            className="ast-go"
                            href={`/client-dashboard?tab=${act.target}`}
                            onClick={close}
                          >
                            {t(`assistant_go_${act.target}`)}
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ast-chips" role="group" aria-label={t('assistant_questions')}>
            {data.questions.map((q) => (
              <button key={`${q.key ?? 'faq'}-${q.id}`} type="button" className="ast-chip" onClick={() => ask(q)}>
                {q.question[locale]}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        ref={fabRef}
        type="button"
        className={`ast-fab ${open ? 'open' : ''}`.trim()}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('assistant_close') : name}
        aria-expanded={open}
      >
        {open ? (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        ) : (
          <Icon name="chat2" />
        )}
      </button>
    </>
  );
}
