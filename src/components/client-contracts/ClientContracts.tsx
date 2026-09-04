'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import ContractStatusStepper from '@/components/ui/ContractStatusStepper';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import ContractDetailModal from './ContractDetailModal';
import { useTranslations } from 'next-intl';
import { notifyWriteError } from '@/lib/utils';
import { useWorkspaceContracts, useClientContractAction } from '@/hooks/queries/useContracts';

export default function ClientContracts({ wsId, clientType, onGoToPayments }: { wsId: number; clientType?: string; onGoToPayments?: () => void }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [viewContractId, setViewContractId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: number; action: string } | null>(null);

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

  const doAction = (id: number, action: string) => {
    clientActionMutation.mutate({ id, action }, {
      onSuccess: () => setViewContractId(null),
      onError: (err) => notifyWriteError(tc, 'ClientContracts.doAction', err),
      onSettled: () => setConfirmAction(null),
    });
  };

  if (loading) return <TableSkeleton />;
  if (error) return <p className="text-sm text-red-500 text-center py-8">{error}</p>;

  return (
    <div className="space-y-3">
      {contracts.length === 0 ? <EmptyState message={t('contract_no_contracts')} /> : null}
      {contracts.map((c) => (
        <div key={c.id} className="border border-[var(--color-card-border)] rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium">{c.title}</h4>
              {Number(c.value) > 0 && <p className="text-xs text-[var(--color-text-secondary)]">{c.value} {c.currency || 'SAR'}</p>}
              {(c.required_documents?.length ?? 0) > 0 && <p className="text-xs text-amber-600 mt-0.5">{t('contract_docs_required', { count: c.required_documents?.length ?? 0 })}</p>}
            </div>
            <StatusBadge status={c.status} />
          </div>
          <ContractStatusStepper status={c.status} compact />
          <div className="mt-2 flex gap-2">
            <button onClick={() => setViewContractId(c.id)} className="text-xs text-[var(--color-gold-text)] hover:underline">
              {t('contract_view_details')}
            </button>
            {c.status === 'sent' && (
              <>
                <button onClick={() => setConfirmAction({ id: c.id, action: 'approved' })}
                  className="text-xs text-emerald-600 hover:underline">{t('contract_approve_action')}</button>
                <button onClick={() => setConfirmAction({ id: c.id, action: 'edit_requested' })}
                  className="text-xs text-amber-600 hover:underline">{t('contract_edit_action')}</button>
              </>
            )}
            {c.status === 'company_approved' && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-emerald-600">{t('contract_company_approved_badge')}</p>
                {c.pdf_url && (
                  <a href={c.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-emerald-600 hover:underline block">{t('contract_download_final')}</a>
                )}
                {onGoToPayments && (
                  <button onClick={onGoToPayments}
                    className="text-xs bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-lg hover:bg-[var(--color-primary-dark)] mt-1">
                    {t('contract_go_to_payment')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

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
        onConfirm={() => confirmAction && doAction(confirmAction.id, confirmAction.action)}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
