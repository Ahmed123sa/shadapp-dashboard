'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { resolveFileUrl } from '@/lib/utils';
import { formatNumber, formatShortDate } from '@/lib/client-format';
import type { Payment, Contract } from '@/types';
import { useWorkspaceContracts, useWorkspacePayments } from '@/hooks/queries/usePayments';
import { canDo } from '@/lib/client-auth';
import { Btn, Icon, StatusDot, type DotTone } from '@/components/client-portal/ui';
import PaymentSheet, { methodLabelOf } from '@/components/client-portal/PaymentSheet';

const STATUS_TONE: Record<string, DotTone> = {
  approved: 'ok',
  pending: 'wait',
  scheduled: 'wait',
  overdue: 'crimson',
  rejected: 'crimson',
};

export default function ClientPayments({ wsId }: { wsId: number }) {
  const t = useTranslations('dashboard');
  const tp = useTranslations('client_portal');
  const locale = useLocale();
  const [editing, setEditing] = useState<Payment | null>(null);
  const [showNew, setShowNew] = useState(false);

  const paymentsQuery = useWorkspacePayments(wsId);
  const contractsQuery = useWorkspaceContracts(wsId);

  const payments = paymentsQuery.data?.payments ?? [];
  const methods = paymentsQuery.data?.methods ?? [];
  const taxSummary = paymentsQuery.data?.taxSummary ?? null;
  const contracts: Contract[] = contractsQuery.data ?? [];
  const loading = paymentsQuery.isLoading || contractsQuery.isLoading;
  const error = (paymentsQuery.isError || contractsQuery.isError) ? t('load_error') : '';
  // subuser-review-plan.md م٦ — uploading/re-uploading a payment proof maps
  // to can_upload_payment_proof, per the plan's action table.
  const canUpload = canDo('can_upload_payment_proof');

  if (loading) return <TableSkeleton />;
  if (error) return <p className="locked" style={{ padding: '40px 0', justifyContent: 'center', width: '100%' }}>{error}</p>;

  const payable = contracts.filter((c) => c.status === 'company_approved' || c.status === 'completed');
  const contractCurrency = payable[0]?.currency || contracts[0]?.currency || 'SAR';
  const currencies = Array.from(new Set(payable.map((c) => c.currency || 'SAR')));
  const effectiveCurrencies = currencies.length > 0 ? currencies : ['SAR'];

  const totalPaid = payments.filter((p) => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0);
  const grandTotal = taxSummary?.grand_total != null
    ? Number(taxSummary.grand_total)
    : payable.length > 0 ? payable.reduce((s, c) => s + Number(c.value), 0) : payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = grandTotal - totalPaid;

  const money = (n: number, cur = contractCurrency) => <span className="num-ltr">{formatNumber(n, locale)}<small>{cur}</small></span>;
  const methodLabel = (m: string) => methodLabelOf(tp, m);
  const statusLabel = (s: string) => ({
    approved: t('pay_status_approved'),
    pending: t('pay_status_pending'),
    rejected: t('pay_status_rejected'),
    scheduled: tp('p_scheduled'),
    overdue: tp('p_overdue'),
  } as Record<string, string>)[s] ?? s;

  const canStartNew = canUpload && payable.length > 0 && !editing && !showNew;
  const sheetOpen = canUpload && (editing !== null || showNew);

  return (
    <div className="ledger">
      <div className="sum">
        <div><div className="lbl">{tp('p_total_contracts')}</div><div className="num">{money(grandTotal)}</div></div>
        <div><div className="lbl">{tp('paid')}</div><div className="num hl">{money(totalPaid)}</div></div>
        <div><div className="lbl">{tp('remaining')}</div><div className="num">{money(remaining)}</div></div>
      </div>

      {!canUpload && (payable.length > 0 || payments.some((p) => p.status !== 'approved')) && (
        <span className="locked" style={{ margin: '4px 0 14px' }}><Icon name="lock" />{t('subuser_action_needs_owner')}</span>
      )}

      {canStartNew && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <Btn variant="primary" onClick={() => setShowNew(true)}>
            <Icon name="up" />
            {tp('p_new')}
          </Btn>
        </div>
      )}

      {sheetOpen && (
        <PaymentSheet
          wsId={wsId}
          methods={methods}
          currencies={effectiveCurrencies}
          defaultAmount={payments.length === 0 ? String(taxSummary?.grand_total ?? payable[0]?.value ?? '') : ''}
          defaultCurrency={contractCurrency}
          editing={editing}
          onDone={() => { setEditing(null); setShowNew(false); }}
          onCancelEdit={() => { setEditing(null); setShowNew(false); }}
        />
      )}

      <div className="rows" style={{ marginTop: sheetOpen ? 18 : 0 }}>
        {payments.length === 0 && (
          <p className="locked" style={{ padding: '36px 0', justifyContent: 'center', width: '100%' }}>{t('pay_no_payments')}</p>
        )}
        {payments.map((p, idx) => {
          const isScheduled = p.status === 'scheduled' || p.status === 'overdue';
          const editable = ['pending', 'rejected', 'scheduled', 'overdue'].includes(p.status);
          const proofUrl = p.proof_file_url ? resolveFileUrl(p.proof_file_url) || null : null;
          const dateText = p.due_date
            ? tp('p_due', { date: formatShortDate(p.due_date, locale) })
            : formatShortDate(p.created_at, locale);
          const kindParts = [
            p.method_type && p.method_type !== 'scheduled' ? methodLabel(p.method_type) : null,
            p.contract?.title ?? null,
          ].filter(Boolean).join(' · ');
          return (
            <div key={p.id} className={`rowx ${isScheduled || p.status === 'rejected' ? 'apcard' : ''}`.trim()}>
              <div>
                {kindParts && <div className="kind">{kindParts}</div>}
                <div className="title">{p.installment_label || t('pay_installment_num', { num: idx + 1 })}</div>
                {dateText && <div className="sub">{dateText}</div>}
                {/* payments-fixes-2-plan.md ت٢ — rejection_reason and notes are
                    different things: notes is the manager's note when
                    requesting the payment, rejection_reason is why it was
                    later rejected. Each is shown under its own label,
                    independently. */}
                {p.status === 'rejected' && p.rejection_reason && (
                  <div className="sub" style={{ color: 'var(--crimson-ink)' }}><b>{t('pay_rejection_reason')}:</b> <span>{p.rejection_reason}</span></div>
                )}
                {p.notes && <div className="sub"><b>{t('notes')}:</b> <span>{p.notes}</span></div>}
              </div>
              <div className="amt">{money(Number(p.amount), p.currency || contractCurrency)}</div>
              <span className="st2"><StatusDot tone={STATUS_TONE[p.status] ?? 'faint'} />{statusLabel(p.status)}</span>
              <div className="acts">
                {proofUrl && (
                  <a className="lnk" href={proofUrl} target="_blank" rel="noopener noreferrer">{t('pay_view_proof')}</a>
                )}
                {editable && canUpload && (
                  <Btn
                    variant={p.status === 'pending' ? 'default' : 'primary'}
                    onClick={() => { setShowNew(false); setEditing(p); }}
                  >
                    <Icon name="up" />
                    {p.status === 'rejected' ? t('pay_reupload_proof') : p.status === 'pending' ? t('pay_edit') : tp('p_upload')}
                  </Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
