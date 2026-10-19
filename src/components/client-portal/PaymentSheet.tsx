'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { notifyWriteError } from '@/lib/utils';
import { useSubmitClientPayment } from '@/hooks/queries/usePayments';
import type { Payment } from '@/types';
import { Btn, Icon } from './ui';

export const METHOD_KEYS = ['bank_transfer', 'swift', 'corporate_account', 'instapay', 'vodafone_cash', 'mobile_wallet'] as const;

export function methodLabelOf(t: (key: string) => string, m: string): string {
  return (METHOD_KEYS as readonly string[]).includes(m) ? t(`method_${m}`) : m;
}

interface Props {
  wsId: number;
  methods: string[];
  currencies: string[];
  /** Pre-filled amount for a brand-new payment ('' when nothing is suggested). */
  defaultAmount: string;
  defaultCurrency: string;
  /** When set, the sheet re-submits this payment (PUT) instead of creating one. */
  editing: Payment | null;
  onDone: () => void;
  onCancelEdit: () => void;
}

/**
 * The "send a payment" form: amount, currency, method chips and any number of
 * receipt files (added and removed freely before sending, sent as
 * `proof_files[]` — the field the backend actually reads).
 */
export default function PaymentSheet({ wsId, methods, currencies, defaultAmount, defaultCurrency, editing, onDone, onCancelEdit }: Props) {
  const t = useTranslations('client_portal');
  const tc = useTranslations('common');
  const submit = useSubmitClientPayment(wsId);

  const [amount, setAmount] = useState(defaultAmount);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [methodType, setMethodType] = useState('');
  const [proofs, setProofs] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // New payment: follow the suggested amount/currency. Editing: load the payment.
  useEffect(() => {
    if (editing) {
      setAmount(String(editing.amount));
      setCurrency(editing.currency || defaultCurrency);
      setMethodType((METHOD_KEYS as readonly string[]).includes(editing.method_type) ? editing.method_type : '');
      setProofs([]);
    } else {
      setAmount(defaultAmount);
      setCurrency(defaultCurrency);
      setMethodType('');
      setProofs([]);
    }
  }, [editing, defaultAmount, defaultCurrency]);

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
      .then(() => onDone())
      .catch((err) => notifyWriteError(tc, 'PaymentSheet.send', err));
    setSaving(false);
  };

  return (
    <div className="sheet">
      <h4 className="serifx">{editing ? t('sheet_title_edit') : t('sheet_title')}</h4>
      <div className="fg">
        <div className="f2">
          <label htmlFor="cx-pay-amount">{t('amount')}</label>
          <input id="cx-pay-amount" className="in" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="f2">
          <label htmlFor="cx-pay-cur">{t('currency')}</label>
          {currencies.length === 1 ? (
            <div id="cx-pay-cur" className="in">{currencies[0]}</div>
          ) : (
            <select id="cx-pay-cur" className="in" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
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
                {methodLabelOf(t, m)}
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
        {editing && <Btn size="lg" onClick={onCancelEdit}>{t('cancel')}</Btn>}
      </div>
    </div>
  );
}
