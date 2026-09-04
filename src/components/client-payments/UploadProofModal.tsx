'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useTranslations } from 'next-intl';
import { useModalA11y } from '@/hooks/useModalA11y';
import type { Payment } from '@/types';

export default function UploadProofModal({ wsId, availableMethods, allowedCurrencies, onClose, onCreated }: {
  wsId: number;
  availableMethods: string[];
  allowedCurrencies?: string[];
  onClose: () => void;
  onCreated: (payment: Payment) => void;
}) {
  const t = useTranslations('dashboard');
  const titleId = useId();
  const { dialogRef, dialogProps } = useModalA11y<HTMLDivElement>(true, onClose);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [methodType, setMethodType] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const methodLabels: Record<string, string> = {
    bank_transfer: t('pay_method_bank_transfer'), swift: t('pay_method_swift'), corporate_account: t('pay_method_corporate_account'),
    instapay: t('pay_method_instapay'), vodafone_cash: t('pay_method_vodafone_cash'), mobile_wallet: t('pay_method_mobile_wallet'),
  };

  const currencyLabels: Record<string, string> = {
    SAR: t('currency_sar'), USD: t('currency_usd'), EUR: t('currency_eur'),
    AED: t('currency_aed'), EGP: t('currency_egp'), KWD: t('currency_kwd'),
    QAR: t('currency_qar'), BHD: t('currency_bhd'), OMR: t('currency_omr'),
  };

  const currencyOptions = useMemo(
    () => (allowedCurrencies && allowedCurrencies.length > 0 ? allowedCurrencies : Object.keys(currencyLabels)),
    [allowedCurrencies, currencyLabels],
  );

  useEffect(() => {
    setCurrency((cur) => cur || currencyOptions[0] || 'SAR');
  }, [currencyOptions]);

  const submit = async () => {
    if (!amount || !methodType) return;
    setSaving(true);
    const form = new FormData();
    form.append('amount', amount);
    form.append('currency', currency);
    form.append('method_type', methodType);
    if (proofFile) form.append('proof_file', proofFile);
    const { data } = await api.post(`/workspaces/${wsId}/payments`, form).catch(() => ({ data: null }));
    if (data) onCreated(data.payment);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        ref={dialogRef}
        {...dialogProps}
        aria-labelledby={titleId}
        className="bg-[var(--color-card)] rounded-xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4 border border-[var(--color-card-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id={titleId} className="font-bold">{t('pay_submit_proof')}</h3>
          <button onClick={onClose} aria-label={t('close')} className="text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)] text-xl">&times;</button>
        </div>

        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder={t('pay_amount_ph')} aria-label={t('pay_amount_ph')}
          className="border border-[var(--color-input-border)] rounded-lg px-4 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)] placeholder-[var(--color-text-disabled)]" />

        <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label={t('currency_label')} className="border border-[var(--color-input-border)] rounded-lg px-4 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]">
          {currencyOptions.map((c) => <option key={c} value={c}>{currencyLabels[c] || c}</option>)}
        </select>

        <select value={methodType} onChange={(e) => setMethodType(e.target.value)} aria-label={t('pay_method_ph')} className="border border-[var(--color-input-border)] rounded-lg px-4 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]">
          <option value="">{t('pay_method_ph')}</option>
          {availableMethods.map((m) => <option key={m} value={m}>{methodLabels[m] || m}</option>)}
        </select>

        <label className="flex items-center gap-2 text-sm text-[var(--color-gold-text)] cursor-pointer hover:text-[var(--color-gold-text)]">
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
          <span className="border border-blue-200 rounded-lg px-4 py-2">{proofFile ? proofFile.name : t('pay_choose_proof')}</span>
        </label>

        <button onClick={submit} disabled={saving || !amount || !methodType}
          className="w-full bg-[var(--color-primary)] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
          {saving ? t('pay_saving') : t('pay_submit_proof')}
        </button>
      </div>
    </div>
  );
}
