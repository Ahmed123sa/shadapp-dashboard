'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { canDo } from '@/lib/client-auth';
import { notifyWriteError } from '@/lib/utils';
import { useSubmitClientPayment, useWorkspaceContracts, useWorkspacePayments } from '@/hooks/queries/usePayments';
import type { Contract, Payment } from '@/types';
import { Btn, Icon, StatusDot } from '../ui';

export const METHOD_KEYS = ['bank_transfer', 'swift', 'corporate_account', 'instapay', 'vodafone_cash', 'mobile_wallet'] as const;

/** Stage 4 — pay the first instalment: pick a method, attach any number of receipts, send. */
export default function PaymentStage({ wsId, onChanged }: { wsId: number; onChanged: () => void }) {
  const t = useTranslations('client_portal');
  const tc = useTranslations('common');
  const locale = useLocale();
  const paymentsQuery = useWorkspacePayments(wsId);
  const contractsQuery = useWorkspaceContracts(wsId);
  const submit = useSubmitClientPayment(wsId);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [methodType, setMethodType] = useState('');
  const [proofs, setProofs] = useState<File[]>([]);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const payments = paymentsQuery.data?.payments ?? [];
  const methods = paymentsQuery.data?.methods ?? [];
  const tax = paymentsQuery.data?.taxSummary ?? null;
  const contracts = contractsQuery.data ?? [];
  const payable: Contract[] = contracts.filter((c) => c.status === 'company_approved' || c.status === 'completed');

  // Same defaults ClientPayments derives: first payable contract's currency,
  // and the grand total as the starting amount while nothing is paid yet.
  useEffect(() => {
    if (!paymentsQuery.data || !contractsQuery.data || editing) return;
    if (payable.length > 0) {
      setCurrency(payable[0].currency || 'SAR');
      if (!paymentsQuery.data.payments.length) setAmount(String(tax?.grand_total ?? payable[0].value ?? ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsQuery.data, contractsQuery.data]);

  if (paymentsQuery.isLoading || contractsQuery.isLoading) return <p className="lead">{t('stage_loading')}</p>;

  const methodLabel = (m: string) => ((METHOD_KEYS as readonly string[]).includes(m) ? t(`method_${m}`) : m);
  const nf = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 });
  const money = (n: number, cur: string) => (<b>{nf.format(n)}<small>{cur}</small></b>);

  const cur = payable[0]?.currency || 'SAR';
  const grandTotal = tax?.grand_total != null
    ? Number(tax.grand_total)
    : payable.length > 0 ? payable.reduce((s, c) => s + Number(c.value), 0) : payments.reduce((s, p) => s + Number(p.amount), 0);
  const contractsTotal = tax?.contracts_total != null ? Number(tax.contracts_total) : grandTotal;
  const paid = payments.filter((p) => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0);
  const remaining = grandTotal - paid;
  const currencies = Array.from(new Set(payable.map((c) => c.currency || 'SAR')));
  const effectiveCurrencies = currencies.length > 0 ? currencies : ['SAR'];
  const rejected = payments.filter((p) => p.status === 'rejected');
  const canPay = canDo('can_upload_payment_proof');

  const startEdit = (p: Payment) => {
    setEditing(p);
    setAmount(String(p.amount));
    setCurrency(p.currency || cur);
    setMethodType(p.method_type);
    setProofs([]);
  };
  const reset = () => {
    setEditing(null);
    setAmount(String(tax?.grand_total ?? payable[0]?.value ?? ''));
    setCurrency(cur);
    setMethodType('');
    setProofs([]);
  };

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setProofs((prev) => [...prev, ...Array.from(list)]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const send = async () => {
    if (!amount || !methodType || saving) return;
    setSaving(true);
    const form = new FormData();
    form.append('amount', amount);
    form.append('currency', currency);
    form.append('method_type', methodType);
    proofs.forEach((f) => form.append('proof_files[]', f));
    if (editing) form.append('_method', 'PUT');
    const url = editing ? `/workspaces/${wsId}/payments/${editing.id}` : `/workspaces/${wsId}/payments`;
    await submit
      .mutateAsync({ url, form, editingPaymentId: editing?.id ?? null })
      .then(() => { reset(); onChanged(); })
      .catch((err) => notifyWriteError(tc, 'PaymentStage.send', err));
    setSaving(false);
  };

  return (
    <>
      <div className="k">{t('step_of', { a: 5, b: 6 })}</div>
      <h2 className="serifx">{t('pay_title')}</h2>
      <p className="lead">{t('pay_desc')}</p>

      <div className="bill">
        <div className="r"><span>{t('cv')}</span>{money(contractsTotal, cur)}</div>
        {tax && Number(tax.tax_percentage) > 0 && (
          <div className="r"><span>{t('tax', { pct: nf.format(Number(tax.tax_percentage)) })}</span>{money(Number(tax.tax_amount), cur)}</div>
        )}
        <div className="r tot"><span>{t('total')}</span>{money(grandTotal, cur)}</div>
        <div className="r"><span>{t('paid')}</span>{money(paid, cur)}</div>
        <div className="r"><span>{t('remaining')}</span>{money(remaining, cur)}</div>
      </div>

      {rejected.length > 0 && !editing && (
        <div className="docs">
          <div className="h">{t('rejected_h')}</div>
          {rejected.map((p) => (
            <div className="doc" key={p.id}>
              <div>
                <span className="nm">{methodLabel(p.method_type)} · {nf.format(Number(p.amount))} {p.currency || cur}</span>
                {p.rejection_reason && <div className="sub" style={{ fontSize: 12, color: 'var(--faint)' }}>{t('reject_reason_label', { reason: p.rejection_reason })}</div>}
              </div>
              <span className="st"><StatusDot tone="crimson" /></span>
              <div className="end">
                {canPay && <Btn size="sm" onClick={() => startEdit(p)}>{t('reupload')}</Btn>}
              </div>
            </div>
          ))}
        </div>
      )}

      {canPay ? (
        <div className="sheet">
          <h4 className="serifx">{editing ? t('sheet_title_edit') : t('sheet_title')}</h4>
          <div className="fg">
            <div className="f2">
              <label htmlFor="cx-pay-amount">{t('amount')}</label>
              <input id="cx-pay-amount" className="in" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="f2">
              <label htmlFor="cx-pay-cur">{t('currency')}</label>
              {effectiveCurrencies.length === 1 ? (
                <div id="cx-pay-cur" className="in">{effectiveCurrencies[0]}</div>
              ) : (
                <select id="cx-pay-cur" className="in" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {effectiveCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
            <div className="f2 full">
              <label id="cx-pay-method-l">{t('method')}</label>
              <div className="chips2" role="radiogroup" aria-labelledby="cx-pay-method-l">
                {methods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={methodType === m}
                    className={`chip2 ${methodType === m ? 'on' : ''}`.trim()}
                    onClick={() => setMethodType(m)}
                  >
                    {methodLabel(m)}
                  </button>
                ))}
              </div>
            </div>
            <div className="f2 full">
              <label>{t('receipt')}</label>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                aria-label={t('add_files')}
                data-testid="proof-input"
                style={{ display: 'none' }}
                onChange={(e) => addFiles(e.target.files)}
              />
              <button type="button" className="drop" onClick={() => fileRef.current?.click()}>
                {t('drop_pre')} <b>{t('drop_browse')}</b>
                <div style={{ marginTop: 4 }}>{t('drop_sub')}</div>
              </button>
              {proofs.length > 0 && (
                <div className="thumbs" style={{ flexWrap: 'wrap' }}>
                  {proofs.map((f, i) => (
                    <span className="thumb" key={`${f.name}-${i}`}>
                      <Icon name="doc" />
                      {f.name}
                      <button type="button" className="rm" aria-label={t('remove_file', { name: f.name })} onClick={() => setProofs((p) => p.filter((_, j) => j !== i))}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="acts2">
            <Btn variant="primary" size="lg" disabled={saving || !amount || !methodType} onClick={send}>
              {saving ? t('sending') : t('send_payment')}
            </Btn>
            {editing && <Btn size="lg" onClick={reset}>{t('cancel')}</Btn>}
          </div>
        </div>
      ) : (
        <div className="acts2"><span className="hint">{t('need_perm_pay')}</span></div>
      )}
    </>
  );
}
