'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  fieldErrors,
  previewWording,
  useCreateAssistantFaq,
  useResetAssistantQuestion,
  useUpdateAssistantQuestion,
  type AssistantSettingsData,
  type DataQuestion,
  type FaqQuestion,
  type Pair,
  type PreviewResult,
} from '@/hooks/queries/useAssistantSettings';

// CLIENT_ASSISTANT_PLAN.md ٧.٢ — the side panel where one question is edited:
// its text, the wording of every situation it can answer, the placeholders each
// wording may use, and a live preview with sample numbers. The server has the
// last word on what is valid; the preview just tells the admin early.

export type EditTarget =
  | { type: 'data'; row: DataQuestion }
  | { type: 'faq'; row: FaqQuestion | null }
  | { type: 'settings' };

type Tx = (ar: string, en: string) => string;
type Lang = 'ar' | 'en';

const STATE_LABELS: Record<string, [string, string]> = {
  has_items: ['مقدمة القايمة', 'List intro'],
  item_contract: ['عقد مستني الموافقة', 'Contract to approve'],
  item_documents: ['مستندات ناقصة', 'Missing documents'],
  item_approval: ['طلبات موافقة', 'Approval requests'],
  item_payment_overdue: ['قسط متأخر', 'Overdue installment'],
  item_payment_rejected: ['دفعة مرفوضة', 'Rejected payment'],
  nothing: ['مفيش حاجة مطلوبة', 'Nothing needed'],
  default: ['الرد العادي', 'Default answer'],
  fully_paid: ['اتدفع بالكامل', 'Fully paid'],
  no_contract: ['مفيش عقد', 'No contract'],
  upcoming: ['قسط جاي', 'Upcoming installment'],
  overdue: ['قسط متأخر', 'Overdue installment'],
  none: ['مفيش حاجة', 'Nothing to show'],
};

const TARGET_LABELS: Record<string, [string, string]> = {
  contracts: ['العقود', 'Contracts'],
  payments: ['المدفوعات', 'Payments'],
  chat: ['الشات', 'Chat'],
  approvals: ['الموافقات', 'Approvals'],
  files: ['الملفات', 'Files'],
  meetings: ['الاجتماعات', 'Meetings'],
};

const inputCls = 'w-full bg-[var(--color-input-fill)] border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)]';
const errCls = 'text-xs text-[var(--color-danger,#DD8888)] mt-1';

interface Props {
  target: EditTarget;
  data: AssistantSettingsData;
  ar: boolean;
  onClose: () => void;
}

export default function QuestionEditor({ target, data, ar, onClose }: Props) {
  const tx: Tx = (a, e) => (ar ? a : e);
  const update = useUpdateAssistantQuestion();
  const create = useCreateAssistantFaq();
  const reset = useResetAssistantQuestion();

  // What is being edited, as plain form state.
  const row = target.type === 'data' ? target.row : target.type === 'faq' ? target.row : null;
  const [question, setQuestion] = useState<Pair>(
    target.type === 'data' ? target.row.question : target.type === 'faq' ? target.row?.question ?? { ar: '', en: '' } : data.settings.name,
  );
  const [answer, setAnswer] = useState<Pair>(target.type === 'faq' ? target.row?.answer ?? { ar: '', en: '' } : data.settings.welcome);
  const [actionTarget, setActionTarget] = useState<string | null>(target.type === 'faq' ? target.row?.action_target ?? null : null);
  const [states, setStates] = useState<Record<string, Pair>>(
    target.type === 'data' ? Object.fromEntries(target.row.states.map((s) => [s.state, { ar: s.ar, en: s.en }])) : {},
  );
  const original = useRef(states);

  const [previews, setPreviews] = useState<Record<string, PreviewResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [focus, setFocus] = useState<{ key: string; lang: Lang } | null>(null);
  const sent = useRef<Record<string, string>>({});

  // Live preview: every wording that changed since the last check, a moment after typing stops.
  useEffect(() => {
    if (target.type !== 'data' && target.type !== 'settings') return;
    const items: { id: string; key: string; state: string; pair: Pair }[] =
      target.type === 'data'
        ? Object.entries(states).map(([state, pair]) => ({ id: state, key: target.row.key, state, pair }))
        : [{ id: 'welcome', key: 'settings', state: 'welcome', pair: answer }];
    const timer = setTimeout(async () => {
      for (const it of items) {
        const sig = `${it.pair.ar}\u0000${it.pair.en}`;
        if (sent.current[it.id] === sig) continue;
        sent.current[it.id] = sig;
        try {
          const res = await previewWording(it.key, it.state, it.pair.ar, it.pair.en);
          setPreviews((p) => ({ ...p, [it.id]: res }));
        } catch {
          // The preview is a convenience; saving still validates on the server.
        }
      }
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states, answer]);

  const hasPreviewError = Object.values(previews).some((p) => p.ar.error || p.en.error);

  const insert = (token: string) => {
    if (!focus) return;
    const add = (v: string) => `${v}${v && !v.endsWith(' ') ? ' ' : ''}{${token}}`;
    if (target.type === 'data' && focus.key in states) {
      setStates((s) => ({ ...s, [focus.key]: { ...s[focus.key], [focus.lang]: add(s[focus.key][focus.lang]) } }));
    } else if (focus.key === 'welcome') {
      setAnswer((a) => ({ ...a, [focus.lang]: add(a[focus.lang]) }));
    }
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      if (target.type === 'data') {
        const changed = Object.fromEntries(
          Object.entries(states).filter(([k, v]) => v.ar !== original.current[k].ar || v.en !== original.current[k].en),
        );
        await update.mutateAsync({ id: target.row.id, payload: { question, ...(Object.keys(changed).length ? { answers: changed } : {}) } });
      } else if (target.type === 'faq') {
        const payload = { question, answer, action_target: actionTarget };
        if (target.row) await update.mutateAsync({ id: target.row.id, payload });
        else await create.mutateAsync(payload);
      } else {
        await update.mutateAsync({ id: data.settings.id as number, payload: { name: question, welcome: answer } });
      }
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    if (target.type !== 'data' || !confirm(tx('نرجّع السؤال وكل ردوده للصياغة الأصلية؟', 'Restore this question and all its answers to the original wording?'))) return;
    setSaving(true);
    try {
      await reset.mutateAsync(target.row.id);
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
    } finally {
      setSaving(false);
    }
  };

  const title =
    target.type === 'data' ? tx(`تعديل: ${target.row.question.ar}`, `Edit: ${target.row.question.en}`)
    : target.type === 'faq' ? (target.row ? tx('تعديل سؤال شائع', 'Edit FAQ') : tx('سؤال شائع جديد', 'New FAQ'))
    : tx('الإعدادات العامة', 'General settings');

  const pairFields = (
    label: [string, string],
    value: Pair,
    set: (p: Pair) => void,
    opts: { max: number; area?: boolean; errKey?: string; fieldKey?: string },
  ) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(['ar', 'en'] as const).map((lang) => {
        const err = errors[`${opts.errKey ?? ''}.${lang}`] ?? errors[opts.errKey ?? ''];
        const id = `ed-${opts.errKey}-${lang}`;
        const common = {
          id,
          value: value[lang],
          maxLength: opts.max,
          dir: lang === 'ar' ? ('rtl' as const) : ('ltr' as const),
          'aria-invalid': !!err,
          className: `${inputCls} ${err ? '!border-red-400' : ''}`,
          onFocus: () => opts.fieldKey && setFocus({ key: opts.fieldKey, lang }),
        };
        return (
          <div key={lang}>
            <label htmlFor={id} className="block text-xs text-[var(--color-text-secondary)] mb-1">
              {lang === 'ar' ? `${label[0]} (عربي)` : `${label[1]} (English)`}
            </label>
            {opts.area ? (
              <textarea rows={3} {...common} onChange={(e) => set({ ...value, [lang]: e.target.value })} />
            ) : (
              <input {...common} onChange={(e) => set({ ...value, [lang]: e.target.value })} />
            )}
            {err && <p role="alert" className={errCls}>{err}</p>}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-xl h-full overflow-y-auto bg-[var(--color-card)] border-s border-[var(--color-card-border)] flex flex-col"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-card-border)]">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--color-foreground)] truncate">{title}</h2>
            {target.type === 'data' && <p className="text-xs text-[var(--color-text-secondary)]" dir="ltr">{target.row.key}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={tx('إغلاق', 'Close')} className="ms-auto p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {errors._ && <div role="alert" className="rounded-lg bg-red-500/10 text-red-400 text-xs p-3">{errors._}</div>}

          {pairFields(
            target.type === 'settings' ? ['اسم المساعد', 'Assistant name'] : ['السؤال', 'Question'],
            question,
            setQuestion,
            { max: target.type === 'settings' ? data.limits.name : data.limits.question, errKey: target.type === 'settings' ? 'name' : 'question' },
          )}

          {target.type === 'settings' && (
            <div className="space-y-2">
              {pairFields(['رسالة الترحيب', 'Welcome message'], answer, setAnswer, { max: data.limits.welcome, area: true, errKey: 'welcome', fieldKey: 'welcome' })}
              <Chips tokens={data.settings.welcome_placeholders} onPick={insert} tx={tx} />
              <PreviewBox preview={previews.welcome} lang={ar ? 'ar' : 'en'} />
            </div>
          )}

          {target.type === 'faq' && (
            <>
              {pairFields(['الإجابة', 'Answer'], answer, setAnswer, { max: data.limits.faq_answer, area: true, errKey: 'answer' })}
              <p className="text-xs text-[var(--color-text-secondary)]">{tx('الإجابة ثابتة ومفيهاش خانات { }.', 'The answer is fixed text, without { } fields.')}</p>
              <fieldset>
                <legend className="text-xs text-[var(--color-text-secondary)] mb-2">{tx('زرار الانتقال (اختياري)', 'Go-to button (optional)')}</legend>
                <div className="flex flex-wrap gap-2" role="group">
                  {[null, ...data.targets].map((t) => {
                    const on = actionTarget === t;
                    return (
                      <button
                        key={t ?? 'none'}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setActionTarget(t)}
                        className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer transition ${on ? 'border-[var(--color-gold)] text-[var(--color-foreground)] bg-[var(--color-gold-soft)]' : 'border-[var(--color-card-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)]'}`}
                      >
                        {t ? tx(TARGET_LABELS[t]?.[0] ?? t, TARGET_LABELS[t]?.[1] ?? t) : tx('من غير زرار', 'No button')}
                      </button>
                    );
                  })}
                </div>
                {errors.action_target && <p role="alert" className={errCls}>{errors.action_target}</p>}
              </fieldset>
            </>
          )}

          {target.type === 'data' &&
            target.row.states.map((s) => {
              const label = STATE_LABELS[s.state] ?? [s.state, s.state];
              return (
                <section key={s.state} className="rounded-xl border border-[var(--color-card-border)] p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--color-foreground)]">{tx(label[0], label[1])}</span>
                    <span className="text-[11px] text-[var(--color-text-secondary)]" dir="ltr">{s.state}</span>
                  </div>
                  {pairFields(['الرد', 'Answer'], states[s.state], (p) => setStates((st) => ({ ...st, [s.state]: p })), {
                    max: data.limits.answer, area: true, errKey: `answers.${s.state}`, fieldKey: s.state,
                  })}
                  {s.allowed.length > 0 && <Chips tokens={s.allowed} required={s.required} onPick={insert} tx={tx} active={focus?.key === s.state} />}
                  <PreviewBox preview={previews[s.state]} lang={ar ? 'ar' : 'en'} />
                </section>
              );
            })}
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--color-card-border)]">
          <button
            type="button"
            onClick={save}
            disabled={saving || hasPreviewError}
            aria-busy={saving}
            className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50 cursor-pointer"
          >
            {tx('حفظ', 'Save')}
          </button>
          <button type="button" onClick={onClose} className="bg-[var(--color-input-fill)] px-6 py-2 rounded-lg text-sm cursor-pointer">{tx('إلغاء', 'Cancel')}</button>
          {hasPreviewError && <span className="text-xs text-red-400">{tx('صحّح الأخطاء الأول', 'Fix the errors first')}</span>}
          {target.type === 'data' && row && (
            <button type="button" onClick={restore} disabled={saving} className="ms-auto text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] cursor-pointer">
              {tx('رجوع للأصل', 'Restore original')}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function Chips({ tokens, required = [], onPick, tx, active = true }: { tokens: string[]; required?: string[]; onPick: (t: string) => void; tx: Tx; active?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
      <span>{tx('الخانات المتاحة (اضغط عشان تضيفها):', 'Fields you can use (click to add):')}</span>
      {tokens.map((tk) => (
        <button
          key={tk}
          type="button"
          dir="ltr"
          disabled={!active}
          onClick={() => onPick(tk)}
          title={required.includes(tk) ? tx('إجبارية', 'Required') : undefined}
          className="px-2.5 py-0.5 rounded-full border border-dashed border-[var(--color-gold-border)] text-[var(--color-gold-text)] disabled:opacity-40 cursor-pointer"
        >
          {`{${tk}}`}{required.includes(tk) ? ' *' : ''}
        </button>
      ))}
    </div>
  );
}

function PreviewBox({ preview, lang }: { preview?: PreviewResult; lang: Lang }) {
  if (!preview) return null;
  const other: Lang = lang === 'ar' ? 'en' : 'ar';
  return (
    <div className="rounded-lg bg-[var(--color-input-fill)] p-3 space-y-1.5 text-xs">
      {[lang, other].map((l) => (
        <p key={l} dir={l === 'ar' ? 'rtl' : 'ltr'} className={preview[l].error ? 'text-red-400' : 'text-[var(--color-text-secondary)]'}>
          {preview[l].error ?? preview[l].text}
        </p>
      ))}
    </div>
  );
}
