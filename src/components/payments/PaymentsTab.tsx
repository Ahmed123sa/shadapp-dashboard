'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { getUser } from '@/lib/auth';
import type { Client, Workspace } from '@/types';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import ErrorState from '@/components/ErrorState';
import { reportError } from '@/lib/error-reporting';
import { resolveFileUrl, notifyWriteError } from '@/lib/utils';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  useDeletePaymentSchedule,
  useRequestPayment,
  useReviewPayment,
  useSchedulePayments,
  useWorkspaceContracts,
  useWorkspacePayments,
} from '@/hooks/queries/usePayments';

// A payment's currency is derived from the contract it's linked to, never
// chosen freely — PaymentController::resolveCurrency() enforces this
// server-side regardless of what's sent here (see
// plans/payment-currency-plan.md ح2). `contract_id` replaces the old free
// `currency` dropdown; `currency` below is only pre-filled for display/
// backward compatibility and is recomputed from the selected contract (or
// the workspace's single shared currency) via resolvedCurrency().
type ScheduleForm = { amount: string; contract_id: string; due_date: string; installment_label: string };
type Installment = ScheduleForm & { currency: string };
type RequestForm = { amount: string; contract_id: string; notes: string };

export default function PaymentsTab({ wsId, client, onWorkspaceUpdate }: { wsId: number; client: Client; onWorkspaceUpdate?: (ws: Workspace) => void }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [requestForm, setRequestForm] = useState<RequestForm>({ amount: '', contract_id: '', notes: '' });
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({ amount: '', contract_id: '', due_date: '', installment_label: '' });
  const [installments, setInstallments] = useState<Installment[]>([]);
  const scheduleTitleId = useId();
  const requestTitleId = useId();
  const { dialogRef: scheduleDialogRef, dialogProps: scheduleDialogProps } = useModalA11y<HTMLDivElement>(showSchedule, () => setShowSchedule(false));
  const { dialogRef: requestDialogRef, dialogProps: requestDialogProps } = useModalA11y<HTMLDivElement>(showRequest, () => setShowRequest(false));
  const user = getUser();
  const canReview = user?.role === 'super_admin';
  const isSA = user?.role === 'super_admin';

  const paymentsQuery = useWorkspacePayments(wsId);
  const contractsQuery = useWorkspaceContracts(wsId);
  const reviewMutation = useReviewPayment(wsId);
  const scheduleMutation = useSchedulePayments(wsId);
  const requestMutation = useRequestPayment(wsId);
  const deleteScheduleMutation = useDeletePaymentSchedule(wsId);

  const payments = paymentsQuery.data?.payments ?? [];
  const taxSummary = paymentsQuery.data?.taxSummary ?? null;
  const contracts = contractsQuery.data ?? [];

  // A payment's currency is server-enforced from its linked contract (see
  // PaymentController::resolveCurrency(), plans/payment-currency-plan.md
  // ح2) — this mirrors that logic on the client for display/pre-fill only.
  // Uses ALL of the workspace's contracts (not just payable ones), matching
  // the backend's ambiguity check.
  const contractCurrencies = Array.from(new Set(contracts.map((c) => c.currency || 'SAR')));
  const hasSingleCurrency = contractCurrencies.length <= 1;
  const singleCurrency = contractCurrencies[0] || 'SAR';
  const resolvedCurrency = (contractId: string) => {
    if (contractId) {
      const c = contracts.find((c) => c.id === Number(contractId));
      if (c?.currency) return c.currency;
    }
    return singleCurrency;
  };

  // Only the *first* fetch failing should replace the screen with a full
  // error state — once we've shown real data at least once (query.data is
  // set), a later background poll hiccup shouldn't yank it away. TanStack
  // Query keeps the last successful `data` around across a failed refetch by
  // default, so this mirrors the manual `hasLoadedOnceRef` guard the old
  // useEffect-based version used.
  const loading = paymentsQuery.isLoading || contractsQuery.isLoading;
  const loadError = (paymentsQuery.isError && paymentsQuery.data === undefined)
    || (contractsQuery.isError && contractsQuery.data === undefined);
  const retry = () => { paymentsQuery.refetch(); contractsQuery.refetch(); };

  const methodLabels: Record<string, string> = {
    bank_transfer: t('method_bank_transfer'), swift: t('method_swift'), corporate_account: t('method_corporate_account'),
    instapay: t('method_instapay'), vodafone_cash: t('method_vodafone_cash'), mobile_wallet: t('method_mobile_wallet'),
  };

  const reviewPayment = (pid: number, action: string) => {
    reviewMutation.mutate({ pid, action }, {
      onError: (err) => notifyWriteError(tc, 'PaymentsTab.reviewPayment', err),
      onSuccess: (data) => {
        if (data?.workspace && onWorkspaceUpdate) onWorkspaceUpdate(data.workspace);
      },
    });
  };

  const addInstallment = () => {
    if (!scheduleForm.amount || !scheduleForm.due_date) return;
    if (!hasSingleCurrency && !scheduleForm.contract_id) return;
    setInstallments((prev) => [...prev, {
      ...scheduleForm,
      installment_label: scheduleForm.installment_label || `Installment ${prev.length + 1}`,
      currency: resolvedCurrency(scheduleForm.contract_id),
    }]);
    setScheduleForm({ amount: '', contract_id: '', due_date: '', installment_label: '' });
  };

  const removeInstallment = (idx: number) => setInstallments((prev) => prev.filter((_, i) => i !== idx));

  const submitSchedule = () => {
    if (installments.length === 0) return;
    const payload = installments.map(({ amount, due_date, installment_label, currency, contract_id }) => ({
      amount,
      due_date,
      installment_label,
      currency,
      ...(contract_id ? { contract_id: Number(contract_id) } : {}),
    }));
    scheduleMutation.mutate(payload, {
      onSuccess: () => { setShowSchedule(false); setInstallments([]); },
      onError: (e: any) => {
        alert(t('schedule_failed') + (e?.response?.data?.message || e?.message || t('unknown_error')));
      },
    });
  };

  const submitRequest = () => {
    if (!requestForm.amount || Number(requestForm.amount) <= 0) return;
    if (!hasSingleCurrency && !requestForm.contract_id) return;
    requestMutation.mutate({
      amount: Number(requestForm.amount),
      currency: resolvedCurrency(requestForm.contract_id),
      notes: requestForm.notes || undefined,
      ...(requestForm.contract_id ? { contract_id: Number(requestForm.contract_id) } : {}),
    }, {
      onSuccess: () => { setShowRequest(false); setRequestForm({ amount: '', contract_id: '', notes: '' }); },
      onError: (e: any) => {
        alert(t('request_failed') + (e?.response?.data?.message || e?.message || t('unknown_error')));
      },
    });
  };

  const deleteSchedule = (pid: number) => {
    if (!confirm(t('confirm_delete_schedule'))) return;
    deleteScheduleMutation.mutate(pid, {
      onError: (err) => reportError('PaymentsTab.deleteSchedule', err),
    });
  };

  if (loading) return <TableSkeleton />;
  if (loadError) return <ErrorState onRetry={retry} />;

  const payableContracts = contracts.filter((c) => c.status === 'company_approved' || c.status === 'completed');
  const contractValue = payableContracts.reduce((s, c) => s + Number(c.value), 0);
  const contractCurrency = payableContracts.length > 0 ? (payableContracts[0]?.currency || 'SAR') : 'SAR';
  const totalPaid = payments.filter(p => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0);
  const grandTotal = taxSummary?.grand_total != null ? Number(taxSummary.grand_total) : (contractValue > 0 ? contractValue : payments.reduce((s, p) => s + Number(p.amount), 0));
  const remaining = grandTotal - totalPaid;
  const isFullyPaid = grandTotal > 0 && totalPaid >= grandTotal;
  const progress = grandTotal > 0 ? Math.min(totalPaid / grandTotal, 1) : 0;

  const installmentLabels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
  const installmentName = (i: number) => i < installmentLabels.length ? `Payment ${installmentLabels[i]}` : `Payment ${i + 1}`;

  return (
    <div className="space-y-4">
      {/* ملخص الدفعات */}
      <div className="bg-[var(--bg-dark)] border border-[var(--color-card-border)] rounded-xl p-4">
        {isFullyPaid ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-400 text-lg">✅</span>
              <p className="text-sm font-bold text-green-400">{t('fully_paid')}</p>
            </div>
            <p className="text-2xl font-bold text-[var(--color-gold-text)] font-display">
              {totalPaid.toFixed(2)} {contractCurrency}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-[var(--color-gold-text)] font-medium">{t('total_paid_label')}</p>
            <p className="text-2xl font-bold text-[var(--color-gold-text)] mt-1 font-display">
              {totalPaid.toFixed(2)} {contractCurrency}
            </p>
            <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">
              {t('from_prefix_ext')}{grandTotal.toFixed(2)} {contractCurrency}{t('remaining_prefix')}{remaining.toFixed(2)}
            </p>
            {taxSummary && taxSummary.tax_percentage > 0 && (
              <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">
                {t('value_detail')}{Number(taxSummary.contracts_total).toFixed(2)}{t('plus_tax')}{taxSummary.tax_percentage}% = {Number(taxSummary.tax_amount).toFixed(2)} {contractCurrency}
              </p>
            )}
          </>
        )}
        <div className="mt-3">
          <div className="w-full h-1.5 bg-[var(--color-card-border)] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isFullyPaid ? 'bg-green-500' : 'bg-[var(--color-gold)]'}`} style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-disabled)]">{t('client_type_prefix')}{client?.client_type === 'individual' ? t('individual_type') : t('company_type')}</p>
      {!isSA && (
        <div className="flex gap-2">
          <button onClick={() => setShowRequest(true)} className="px-4 py-2 bg-[var(--color-gold)] text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
            {t('request_payment')}
          </button>
          <button onClick={() => setShowSchedule(true)} className="px-4 py-2 border border-[var(--color-gold)] text-[var(--color-gold-text)] text-sm font-medium rounded-lg hover:bg-[var(--color-gold)]/10 transition-colors">
            {t('schedule_payments')}
          </button>
        </div>
      )}
      {payments.length === 0 ? <EmptyState message={t('no_payments')} /> : null}
      {payments.map((p, idx) => {
        const isPending = p.status === 'pending';
        const isApproved = p.status === 'approved';
        const isScheduled = p.status === 'scheduled';
        const isOverdue = p.status === 'overdue';
        const isManagerScheduled = p.requested_by_manager === true;
        const isRequested = isManagerScheduled && !p.due_date;
        const statusColor = isApproved ? 'text-green-400' : isPending ? 'text-yellow-400' : isOverdue ? 'text-red-400' : isRequested ? 'text-yellow-400' : isScheduled ? 'text-yellow-400' : 'text-[var(--color-text-disabled)]';
        const statusDot = isApproved ? 'bg-green-400' : isPending ? 'bg-yellow-400' : isOverdue ? 'bg-red-400' : isRequested ? 'bg-yellow-400' : isScheduled ? 'bg-yellow-400' : 'bg-gray-500';
        const statusText = isApproved ? t('approved_status') : isPending ? t('pending_status') : isOverdue ? t('overdue_status') : isRequested ? t('payment_request_status') : isScheduled ? t('scheduled_status') : p.status;

        return (
          <div key={p.id} className={`border rounded-xl overflow-hidden ${isPending ? 'border-[var(--color-gold)]' : 'border-[var(--color-card-border)]'}`}>
            {/* ── القسم العلوي ── */}
            <div className="px-5 pt-5 pb-4">
              <p className="text-xs text-[var(--color-gold-text)] font-medium">{installmentName(idx)}</p>
              <p className="text-2xl font-bold text-[var(--color-foreground)] mt-1 font-display">{p.amount} <span className="text-sm font-normal text-[var(--color-text-disabled)]">{p.currency || contractCurrency}</span></p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span>
                <span className={`text-xs font-medium ${statusColor}`}>{statusText}</span>
              </div>
              {p.due_date && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-[var(--color-text-secondary)]'}`}>
                    {t('due_date_prefix')}{p.due_date}
                  </span>
                </div>
              )}
            </div>

            {/* ── الفاصل ── */}
            <div className="h-px bg-[var(--color-card-border)]"></div>

            {/* ── القسم السفلي ── */}
            <div className="px-5 py-4 space-y-2">
              {p.method_type && (
                <div className="flex items-center gap-2">
                  <span className="text-xs">💳</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{methodLabels[p.method_type] || p.method_type}</span>
                </div>
              )}
              {p.contract?.title && (
                <div className="flex items-center gap-2">
                  <span className="text-xs">📄</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{p.contract.title}</span>
                </div>
              )}
              {p.proof_file_url && (
                <div className="flex items-center gap-2">
                  <span className="text-xs">📎</span>
                  <a href={resolveFileUrl(p.proof_file_url)} target="_blank" className="text-xs text-[var(--color-gold-text)] hover:underline">{t('view_proof')}</a>
                </div>
              )}
              {isPending && canReview && (
                <div className="pt-2 flex gap-2">
                  <button onClick={() => reviewPayment(p.id, 'approved')} className="flex-1 text-sm bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 font-medium">{t('approve_payment')}</button>
                  <button onClick={() => reviewPayment(p.id, 'rejected')} className="flex-1 text-sm bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-medium">{t('reject_payment')}</button>
                </div>
              )}
              {isManagerScheduled && (isScheduled || isOverdue) && (
                <div className="pt-2 flex gap-2">
                  <button onClick={() => deleteSchedule(p.id)} className="flex-1 text-sm bg-red-600/20 text-red-400 py-2 rounded-lg hover:bg-red-600/30 font-medium">{t('delete_schedule')}</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {showSchedule && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowSchedule(false)}>
          <div
            ref={scheduleDialogRef}
            {...scheduleDialogProps}
            aria-labelledby={scheduleTitleId}
            className="bg-[var(--color-sidebar-hover)] border border-[var(--color-card-border)] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id={scheduleTitleId} className="text-lg font-bold text-[var(--color-foreground)]">{t('schedule_title')}</h3>
              <button onClick={() => setShowSchedule(false)} aria-label={t('close')} className="text-[var(--color-text-secondary)] hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="pay-schedule-amount" className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('amount_required')}</label>
                <input id="pay-schedule-amount" type="number" value={scheduleForm.amount} onChange={(e) => setScheduleForm({ ...scheduleForm, amount: e.target.value })} className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-foreground)]" placeholder="0.00" />
              </div>
              <div>
                <label htmlFor="pay-schedule-label" className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('description_optional')}</label>
                <input id="pay-schedule-label" type="text" value={scheduleForm.installment_label} onChange={(e) => setScheduleForm({ ...scheduleForm, installment_label: e.target.value })} className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-foreground)]" placeholder={t('installment_ph')} />
              </div>
              <div>
                <label htmlFor="pay-schedule-currency" className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('currency_label')}</label>
                {hasSingleCurrency ? (
                  <div id="pay-schedule-currency" className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-gold-text)] font-medium">
                    {singleCurrency}
                  </div>
                ) : (
                  <>
                    <select id="pay-schedule-currency" value={scheduleForm.contract_id} onChange={(e) => setScheduleForm({ ...scheduleForm, contract_id: e.target.value })} className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-foreground)]">
                      <option value="">{t('select_contract_ph')}</option>
                      {contracts.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.currency || 'SAR'})</option>)}
                    </select>
                    <p className="text-[length:var(--fs-1)] text-[var(--color-text-disabled)] mt-1">{t('multi_currency_contract_hint')}</p>
                  </>
                )}
              </div>
              <div>
                <label htmlFor="pay-schedule-due-date" className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('due_date_required')}</label>
                <input id="pay-schedule-due-date" type="date" value={scheduleForm.due_date} onChange={(e) => setScheduleForm({ ...scheduleForm, due_date: e.target.value })} className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-foreground)]" />
              </div>
              <button onClick={addInstallment} disabled={!scheduleForm.amount || !scheduleForm.due_date || (!hasSingleCurrency && !scheduleForm.contract_id)} className="w-full text-sm border border-[var(--color-gold)] text-[var(--color-gold-text)] py-2 rounded-lg hover:bg-[var(--color-gold)]/10 disabled:opacity-40">{t('add_installment')}</button>
              {installments.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {installments.map((inst, i) => (
                    <div key={i} className="flex items-center justify-between bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs text-[var(--color-foreground)]">{inst.installment_label}</p>
                        <p className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{inst.amount} {inst.currency} — {inst.due_date}</p>
                      </div>
                      <button onClick={() => removeInstallment(i)} className="text-red-400 hover:text-red-300 text-xs">{t('remove_installment')}</button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={submitSchedule} disabled={installments.length === 0} className="w-full text-sm bg-[var(--color-gold)] text-black py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-40">
                {t('schedule_count', { count: installments.length })}
              </button>
            </div>
          </div>
        </div>
      )}
      {showRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowRequest(false)}>
          <div
            ref={requestDialogRef}
            {...requestDialogProps}
            aria-labelledby={requestTitleId}
            className="bg-[var(--color-sidebar-hover)] border border-[var(--color-card-border)] rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id={requestTitleId} className="text-lg font-bold text-[var(--color-foreground)]">{t('request_title')}</h3>
              <button onClick={() => setShowRequest(false)} aria-label={t('close')} className="text-[var(--color-text-secondary)] hover:text-white">✕</button>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">{t('request_desc')}</p>
            <div className="space-y-3">
              <div>
                <label htmlFor="pay-request-amount" className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('amount_required')}</label>
                <input id="pay-request-amount" type="number" value={requestForm.amount} onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })} className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-foreground)]" placeholder="0.00" />
              </div>
              <div>
                <label htmlFor="pay-request-currency" className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('currency_label')}</label>
                {hasSingleCurrency ? (
                  <div id="pay-request-currency" className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-gold-text)] font-medium">
                    {singleCurrency}
                  </div>
                ) : (
                  <>
                    <select id="pay-request-currency" value={requestForm.contract_id} onChange={(e) => setRequestForm({ ...requestForm, contract_id: e.target.value })} className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-foreground)]">
                      <option value="">{t('select_contract_ph')}</option>
                      {contracts.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.currency || 'SAR'})</option>)}
                    </select>
                    <p className="text-[length:var(--fs-1)] text-[var(--color-text-disabled)] mt-1">{t('multi_currency_contract_hint')}</p>
                  </>
                )}
              </div>
              <div>
                <label htmlFor="pay-request-notes" className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('notes_optional')}</label>
                <input id="pay-request-notes" type="text" value={requestForm.notes} onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })} className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-foreground)]" placeholder={t('payment_request_ph')} />
              </div>
              <button onClick={submitRequest} disabled={!requestForm.amount || Number(requestForm.amount) <= 0 || (!hasSingleCurrency && !requestForm.contract_id)} className="w-full text-sm bg-[var(--color-gold)] text-black py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-40">
                {t('send_request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
