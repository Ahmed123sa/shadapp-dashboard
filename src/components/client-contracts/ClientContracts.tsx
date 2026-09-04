'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import ContractStatusStepper from '@/components/ui/ContractStatusStepper';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import ContractDetailModal from './ContractDetailModal';
import { useTranslations } from 'next-intl';
import { notifyWriteError } from '@/lib/utils';
import type { Contract } from '@/types';

export default function ClientContracts({ wsId, clientType, onGoToPayments }: { wsId: number; clientType?: string; onGoToPayments?: () => void }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: number; action: string } | null>(null);

  const load = () => {
    setLoading(true);
    api.get(`/workspaces/${wsId}/contracts`)
      .then(({ data }) => {
        const list = data.contracts?.data ?? data.contracts ?? [];
        const arr: Contract[] = Array.isArray(list) ? list : [];
        setContracts(arr);
        setViewContract((prev) => prev ? arr.find((c) => c.id === prev.id) || prev : prev);
      })
      .catch(() => setError(t('contract_load_failed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [wsId]);

  const doAction = async (id: number, action: string) => {
    const { data } = await api.post(`/contracts/${id}/client-action`, { action }).catch((err) => { notifyWriteError(tc, 'ClientContracts.doAction', err); return { data: null }; });
    if (data) {
      setContracts((prev) => Array.isArray(prev) ? prev.map((c) => c.id === id ? data.contract : c) : prev);
      setViewContract(null);
    }
    setConfirmAction(null);
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
            <button onClick={() => setViewContract(c)} className="text-xs text-[var(--color-gold-text)] hover:underline">
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
          onClose={() => setViewContract(null)}
          onAction={(action) => setConfirmAction({ id: viewContract.id, action })}
          onUpload={load}
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
