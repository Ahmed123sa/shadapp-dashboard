'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { canDo } from '@/lib/client-auth';
import { useWorkspaceContracts, useWorkspacePayments } from '@/hooks/queries/usePayments';
import type { Contract, Payment } from '@/types';
import { Btn, StatusDot } from '../ui';
import PaymentSheet, { methodLabelOf } from '../PaymentSheet';

export { METHOD_KEYS } from '../PaymentSheet';

/** Stage 4 — pay the first instalment: pick a method, attach any number of receipts, send. */
export default function PaymentStage({ wsId, onChanged }: { wsId: number; onChanged: () => void }) {
  const t = useTranslations('client_portal');
  const locale = useLocale();
  const paymentsQuery = useWorkspacePayments(wsId);
  const contractsQuery = useWorkspaceContracts(wsId);
  const [editing, setEditing] = useState<Payment | null>(null);

  const payments = paymentsQuery.data?.payments ?? [];
  const methods = paymentsQuery.data?.methods ?? [];
  const tax = paymentsQuery.data?.taxSummary ?? null;
  const contracts = contractsQuery.data ?? [];
  const payable: Contract[] = contracts.filter((c) => c.status === 'company_approved' || c.status === 'completed');

  if (paymentsQuery.isLoading || contractsQuery.isLoading) return <p className="lead">{t('stage_loading')}</p>;

  const methodLabel = (m: string) => methodLabelOf(t, m);
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

  const startEdit = (p: Payment) => setEditing(p);

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
        <PaymentSheet
          wsId={wsId}
          methods={methods}
          currencies={effectiveCurrencies}
          defaultAmount={payments.length === 0 ? String(tax?.grand_total ?? payable[0]?.value ?? '') : ''}
          defaultCurrency={cur}
          editing={editing}
          onDone={() => { setEditing(null); onChanged(); }}
          onCancelEdit={() => setEditing(null)}
        />
      ) : (
        <div className="acts2"><span className="hint">{t('need_perm_pay')}</span></div>
      )}
    </>
  );
}
