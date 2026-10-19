'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import ContractDetailModal from './ContractDetailModal';
import { notifyWriteError, getErrorCode, getErrorMessage, resolveFileUrl } from '@/lib/utils';
import { formatNumber, formatShortDate } from '@/lib/client-format';
import { showToast } from '@/components/ToastNotification';
import { reportError } from '@/lib/error-reporting';
import { useWorkspaceContracts, useClientContractAction } from '@/hooks/queries/useContracts';
import { canDo } from '@/lib/client-auth';
import { Btn, Icon } from '@/components/client-portal/ui';
import type { Contract } from '@/types';

/** Where a contract sits on the four-step line: Sent · You approved · Company approved · In force. */
export function contractStepIndex(status: Contract['status']): number {
  switch (status) {
    case 'client_approved': return 2;
    case 'company_approved': return 3;
    case 'completed':
    case 'archived': return 4;
    default: return 1; // draft / sent / edit_requested: waiting on the client
  }
}

const STEP_KEYS = ['cstep_sent', 'cstep_you', 'cstep_company', 'cstep_force'] as const;

export default function ClientContracts({ wsId, clientType, onGoToPayments }: { wsId: number; clientType?: string; onGoToPayments?: () => void }) {
  const t = useTranslations('dashboard');
  const tp = useTranslations('client_portal');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [viewContractId, setViewContractId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: number; action: string } | null>(null);
  const [editReason, setEditReason] = useState('');

  const contractsQuery = useWorkspaceContracts(wsId);
  const clientActionMutation = useClientContractAction(wsId);

  const contracts = contractsQuery.data ?? [];
  const loading = contractsQuery.isLoading;
  const error = contractsQuery.isError && contractsQuery.data === undefined ? t('contract_load_failed') : '';
  // Deriving from the live query data (rather than keeping a separate
  // snapshot in state, as the original did) means the open modal always
  // reflects the latest fetched contract automatically — including after
  // the refetch triggered by a document upload — without a manual re-sync.
  const viewContract = contracts.find((c) => c.id === viewContractId) ?? null;
  const canApprove = canDo('can_approve_contracts');

  const doAction = (id: number, action: string, reason?: string) => {
    clientActionMutation.mutate({ id, action, ...(reason?.trim() ? { reason: reason.trim() } : {}) }, {
      onSuccess: () => {
        setViewContractId(null);
        setEditReason('');
      },
      onError: (err) => {
        // client-signature-plan.md ن6 — a 422 signature_required rejection
        // (ك3) means the client reached the approve button without a saved
        // profile signature (e.g. cleared it after this contract was sent).
        // notifyWriteError's generic "فشلت العملية" gives no clue why, so
        // surface the real reason and point them at the signature page.
        if (getErrorCode(err) === 'signature_required') {
          reportError('ClientContracts.doAction', err);
          showToast({
            id: 'ClientContracts.signatureRequired',
            title: t('contract_signature_required_title'),
            message: getErrorMessage(err) || t('contract_signature_required_message'),
            href: '/client-dashboard/signature',
          });
          return;
        }
        if (getErrorCode(err) === 'required_documents_missing') {
          reportError('ClientContracts.doAction', err);
          showToast({
            id: 'ClientContracts.requiredDocumentsMissing',
            title: t('contract_docs_required_title'),
            message: getErrorMessage(err) || t('contract_upload_required_first_msg'),
          });
          setViewContractId(id);
          return;
        }
        notifyWriteError(tc, 'ClientContracts.doAction', err);
      },
      onSettled: () => {
        setConfirmAction(null);
        setEditReason('');
      },
    });
  };

  if (loading) return <TableSkeleton />;
  if (error) return <p className="locked" style={{ padding: '40px 0', justifyContent: 'center', width: '100%' }}>{error}</p>;

  return (
    <div className="ledger">
      {contracts.length === 0 ? (
        <p className="locked" style={{ padding: '48px 0', justifyContent: 'center', width: '100%' }}>{t('contract_no_contracts')}</p>
      ) : null}
      {contracts.map((c) => {
        const missingDocs = (c.required_documents ?? []).filter(
          (d) => !(d.files ?? []).some((f) => f.status !== 'rejected')
        );
        const hasMissingDocs = missingDocs.length > 0;
        const awaiting = c.status === 'sent';
        const cur = contractStepIndex(c.status);
        const value = Number(c.value);
        const sentOn = formatShortDate(c.created_at, locale);
        const sub = [
          sentOn ? tp('c_sent', { date: sentOn }) : null,
          awaiting && canApprove ? tp('c_await') : null,
          (c.required_documents?.length ?? 0) > 0 ? t('contract_docs_required', { count: c.required_documents?.length ?? 0 }) : null,
        ].filter(Boolean).join(' · ');

        return (
          <div key={c.id} className={`lrow ${awaiting ? 'apcard' : ''}`.trim()}>
            <div>
              <div className="kind">{c.contract_type === 'additional' ? tp('kind_extra') : tp('kind_main')}</div>
              <div className="title">{c.title}</div>
              {sub && <div className="sub">{sub}</div>}
              {c.status === 'company_approved' && <div className="sub">{tp('c_company_ok')}</div>}
              {awaiting && !canApprove && <div className="sub">{t('subuser_action_needs_owner')}</div>}
              {awaiting && canApprove && hasMissingDocs && (
                <div className="sub">{t('contract_upload_required_first', { docs: missingDocs.map((d) => d.name).join('، ') })}</div>
              )}
            </div>
            <div className="amt">
              {value > 0 ? (
                <span className="num-ltr">{formatNumber(value, locale)}<small>{c.currency || 'SAR'}</small></span>
              ) : null}
              {value > 0 && clientType === 'business' && <div className="sub" style={{ fontSize: 11 }}>{tp('excl_vat')}</div>}
            </div>
            <div className="steps">
              {STEP_KEYS.map((key, i) => (
                <div key={key} className={`step ${i < cur ? 'done' : i === cur ? 'now' : ''}`.trim()}>
                  <span className="b" />
                  <span>{tp(key)}</span>
                </div>
              ))}
            </div>
            <div className="acts">
              {/* subuser-review-plan.md م٦ — the tab was already gated on
                  can_view_contracts, but the approve/edit buttons themselves
                  were not gated on can_approve_contracts, so a sub-user with
                  view-only access saw them and only found out they were
                  forbidden after a raw 403 on click. */}
              {awaiting && canApprove ? (
                <>
                  <Btn onClick={() => setConfirmAction({ id: c.id, action: 'edit_requested' })}>{t('contract_edit_action')}</Btn>
                  <Btn variant="primary" disabled={hasMissingDocs} onClick={() => setConfirmAction({ id: c.id, action: 'approved' })}>
                    {t('contract_approve_action')}
                  </Btn>
                </>
              ) : null}
              {c.status === 'company_approved' && c.pdf_url && (
                <a className="lnk" href={resolveFileUrl(c.pdf_url)} target="_blank" rel="noopener noreferrer">{tp('c_final_pdf')}</a>
              )}
              {c.status === 'company_approved' && onGoToPayments && (
                <Btn variant="primary" onClick={onGoToPayments}>{tp('c_go_pay')}</Btn>
              )}
              <Btn onClick={() => setViewContractId(c.id)}>
                <Icon name="eye" />
                {tp('preview_short')}
              </Btn>
            </div>
          </div>
        );
      })}

      {viewContract && (
        <ContractDetailModal
          contract={viewContract}
          wsId={wsId}
          clientType={clientType}
          onClose={() => setViewContractId(null)}
          onAction={(action) => setConfirmAction({ id: viewContract.id, action })}
          onUpload={() => contractsQuery.refetch()}
        />
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.action === 'approved' ? t('contract_approve_title') : t('contract_edit_request_title')}
        message={confirmAction?.action === 'approved' ? t('contract_confirm_approve') : t('contract_confirm_edit_request')}
        confirmLabel={confirmAction?.action === 'approved' ? t('contract_confirm_approve_btn') : t('contract_confirm_edit_request_btn')}
        cancelLabel={t('contract_confirm_cancel')}
        variant="default"
        onConfirm={() => confirmAction && doAction(confirmAction.id, confirmAction.action, confirmAction.action === 'edit_requested' ? editReason : undefined)}
        onCancel={() => {
          setConfirmAction(null);
          setEditReason('');
        }}
      >
        {confirmAction?.action === 'edit_requested' && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-foreground)]">{t('client_edit_reason')}</label>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder={t('client_edit_reason_ph')}
              rows={3}
              className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)] resize-none"
            />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
