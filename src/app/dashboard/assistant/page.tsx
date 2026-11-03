'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { getUser } from '@/lib/auth';
import {
  fieldErrors,
  useAssistantSettings,
  useDeleteAssistantQuestion,
  useReorderAssistantQuestions,
  useUpdateAssistantQuestion,
  type DataQuestion,
  type FaqQuestion,
} from '@/hooks/queries/useAssistantSettings';
import QuestionEditor, { type EditTarget } from '@/components/assistant-settings/QuestionEditor';

// CLIENT_ASSISTANT_PLAN.md ٧ — the super admin's page for the questions the
// client assistant offers and the wording of its answers. The backend answers
// 403 to everyone else and proxy.ts keeps the page from being served. The page
// works while the assistant is still switched off for clients, so the questions
// can be prepared before it goes live.

type Row = (DataQuestion | FaqQuestion) & { sort_order: number };

export default function AssistantSettingsPage() {
  const ar = useLocale() === 'ar';
  const tx = (a: string, e: string) => (ar ? a : e);
  const isSA = getUser()?.role === 'super_admin';

  const { data, isLoading, isError, refetch } = useAssistantSettings();
  const update = useUpdateAssistantQuestion();
  const remove = useDeleteAssistantQuestion();
  const reorder = useReorderAssistantQuestions();

  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [error, setError] = useState('');

  if (!isSA) return null;

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(fieldErrors(err)._ || fallback);
    }
  };

  // The server orders data questions and FAQs together by sort_order; moving a
  // row swaps it with its neighbour in its own list, in that shared order.
  const move = (list: Row[], i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (!data || j < 0 || j >= list.length) return;
    const all: Row[] = [...data.questions, ...data.faqs].sort((a, b) => a.sort_order - b.sort_order);
    const a = all.findIndex((r) => r.id === list[i].id);
    const b = all.findIndex((r) => r.id === list[j].id);
    [all[a], all[b]] = [all[b], all[a]];
    void run(() => reorder.mutateAsync(all.map((r) => r.id)), tx('تعذر الترتيب.', 'Could not reorder.'));
  };

  const toggle = (r: Row) =>
    run(() => update.mutateAsync({ id: r.id, payload: { is_enabled: !r.is_enabled } }), tx('تعذر التعديل.', 'Could not save.'));

  const del = (r: FaqQuestion) => {
    if (!confirm(tx(`حذف السؤال "${r.question.ar}"؟`, `Delete "${r.question.en}"?`))) return;
    void run(() => remove.mutateAsync(r.id), tx('تعذر الحذف.', 'Could not delete.'));
  };

  const ghost = 'px-3 py-1.5 rounded-lg text-xs border border-[var(--color-card-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] transition cursor-pointer';
  const card = 'bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl overflow-hidden';

  const Switch = ({ r }: { r: Row }) => (
    <button
      type="button"
      role="switch"
      aria-checked={r.is_enabled}
      aria-label={tx('إظهار السؤال للعملاء', 'Show this question to clients')}
      onClick={() => toggle(r)}
      className={`relative w-9 h-5 rounded-full flex-none transition cursor-pointer ${r.is_enabled ? 'bg-[var(--lx-ok,#8FB98B)]' : 'bg-[var(--color-input-border)]'}`}
    >
      <span className={`absolute top-0.5 size-4 rounded-full bg-[var(--color-background)] transition-all ${r.is_enabled ? 'end-0.5' : 'start-0.5'}`} />
    </button>
  );

  const list = (items: Row[], kind: 'data' | 'faq') =>
    items.map((r, i) => (
      <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
        <Switch r={r} />
        <div className={`min-w-0 flex-1 ${r.is_enabled ? '' : 'opacity-60'}`}>
          <p className="text-sm text-[var(--color-foreground)] [overflow-wrap:anywhere]">{ar ? r.question.ar : r.question.en}</p>
          {(kind === 'data' || ar) && (
            <p className="text-[11px] text-[var(--color-text-secondary)] [overflow-wrap:anywhere]" dir="ltr">
              {kind === 'data' ? (r as DataQuestion).key : r.question.en}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className={ghost} onClick={() => move(items, i, -1)} disabled={i === 0} aria-label={tx('تحريك لفوق', 'Move up')}><ArrowUp size={14} /></button>
          <button type="button" className={ghost} onClick={() => move(items, i, 1)} disabled={i === items.length - 1} aria-label={tx('تحريك لتحت', 'Move down')}><ArrowDown size={14} /></button>
          <button
            type="button"
            className={ghost}
            onClick={() => setEditing(kind === 'data' ? { type: 'data', row: r as DataQuestion } : { type: 'faq', row: r as FaqQuestion })}
          >
            {tx('تعديل', 'Edit')}
          </button>
          {kind === 'faq' && (
            <button type="button" className={`${ghost} !text-red-400`} onClick={() => del(r as FaqQuestion)}>{tx('حذف', 'Delete')}</button>
          )}
        </div>
      </li>
    ));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{tx('إعدادات المساعد', 'Assistant settings')}</h1>
          {data && (
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full border ${data.enabled ? 'border-[var(--color-card-border)] text-[var(--lx-ok,#8FB98B)]' : 'border-[var(--color-gold-border)] text-[var(--color-gold-text)]'}`}>
              {data.enabled ? tx('شغال للعملاء', 'Live for clients') : tx('مقفول للعملاء', 'Off for clients')}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-xl">
          {tx('الأسئلة اللي بتظهر للعملاء في زرار المساعد، وصياغة ردودها. التعديل بيظهر علطول على الويب والتطبيق.', 'The questions clients see in the assistant button and the wording of its answers. Changes show at once on the web and the app.')}
        </p>
      </div>

      {(error || isError) && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-400 flex items-center gap-3">
          <span>{error || tx('تعذر تحميل الإعدادات.', 'Could not load the settings.')}</span>
          {isError && <button type="button" onClick={() => refetch()} className="underline cursor-pointer">{tx('حاول تاني', 'Try again')}</button>}
        </div>
      )}

      {isLoading && <div className="py-12 text-center text-sm text-[var(--color-text-secondary)]">{tx('جاري التحميل...', 'Loading...')}</div>}

      {data && (
        <>
          <section className={card} aria-labelledby="ast-general">
            <div className="px-4 py-3 border-b border-[var(--color-card-border)] flex items-center">
              <h2 id="ast-general" className="text-sm text-[var(--color-foreground)]">{tx('الإعدادات العامة', 'General')}</h2>
              <button type="button" className={`${ghost} ms-auto`} onClick={() => setEditing({ type: 'settings' })}>{tx('تعديل', 'Edit')}</button>
            </div>
            <dl className="divide-y divide-[var(--color-card-border)] text-sm">
              <div className="px-4 py-3 flex gap-3"><dt className="w-28 text-xs text-[var(--color-text-secondary)] pt-0.5">{tx('الاسم', 'Name')}</dt><dd className="text-[var(--color-foreground)]">{ar ? data.settings.name.ar : data.settings.name.en}</dd></div>
              <div className="px-4 py-3 flex gap-3"><dt className="w-28 text-xs text-[var(--color-text-secondary)] pt-0.5">{tx('الترحيب', 'Welcome')}</dt><dd className="text-[var(--color-foreground)] [overflow-wrap:anywhere]">{ar ? data.settings.welcome.ar : data.settings.welcome.en}</dd></div>
            </dl>
          </section>

          <section className={card} aria-labelledby="ast-data">
            <div className="px-4 py-3 border-b border-[var(--color-card-border)] flex items-baseline gap-3">
              <h2 id="ast-data" className="text-sm text-[var(--color-foreground)]">{tx('أسئلة البيانات', 'Data questions')}</h2>
              <span className="text-xs text-[var(--color-text-secondary)]">{tx('ثابتة، والردود من بيانات العميل', 'Fixed, answered from the client data')}</span>
            </div>
            <ul className="divide-y divide-[var(--color-card-border)]">{list(data.questions, 'data')}</ul>
          </section>

          <section className={card} aria-labelledby="ast-faq">
            <div className="px-4 py-3 border-b border-[var(--color-card-border)] flex items-center gap-3">
              <h2 id="ast-faq" className="text-sm text-[var(--color-foreground)]">{tx('الأسئلة الشائعة', 'FAQ')}</h2>
              <span className="text-xs text-[var(--color-text-secondary)]">{data.faqs.length} / {data.limits.faq_max}</span>
              <button
                type="button"
                disabled={data.faqs.length >= data.limits.faq_max}
                onClick={() => setEditing({ type: 'faq', row: null })}
                className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-primary)] text-white hover:opacity-90 transition cursor-pointer disabled:opacity-50"
              >
                <Plus size={14} /> {tx('إضافة سؤال', 'Add question')}
              </button>
            </div>
            {data.faqs.length === 0 ? (
              <div className="py-12 text-center space-y-1">
                <p className="text-sm text-[var(--color-foreground)]">{tx('لسه مفيش أسئلة شائعة.', 'No FAQs yet.')}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{tx('زي مواعيد العمل أو طرق الدفع، بإجابة ثابتة.', 'Like working hours or payment methods, with a fixed answer.')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-card-border)]">{list(data.faqs, 'faq')}</ul>
            )}
          </section>
        </>
      )}

      {editing && data && (
        <QuestionEditor
          key={editing.type === 'data' ? editing.row.id : editing.type === 'faq' ? editing.row?.id ?? 'new' : 'settings'}
          target={editing}
          data={data}
          ar={ar}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
