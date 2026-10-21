'use client';

import { useId, useState } from 'react';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import ContractStatusStepper from '@/components/ui/ContractStatusStepper';
import { useTranslations } from 'next-intl';
import { useModalA11y } from '@/hooks/useModalA11y';
import { canDo, isMyUpload } from '@/lib/client-auth';
import { resolveFileUrl } from '@/lib/utils';
import type { Contract, FileEntry } from '@/types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function ContractDetailModal({ contract, wsId, onClose, onAction, onUpload, clientType }: {
  contract: Contract;
  wsId: number;
  onClose: () => void;
  onAction: (action: string) => void;
  onUpload: () => void;
  clientType?: string;
}) {
  const t = useTranslations('dashboard');
  const titleId = useId();
  const { dialogRef, dialogProps } = useModalA11y<HTMLDivElement>(true, onClose);
  const canAct = contract.status === 'sent';
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<FileEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // The uploader can remove a file until it is approved (FileController::destroy).
  const deleteFile = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/workspaces/${wsId}/files/${pendingDelete.id}`);
      onUpload();
    } catch (e: any) {
      setError(e?.response?.data?.message || t('doc_delete_failed'));
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const uploadDoc = async (docId: number, file: File) => {
    setUploading((prev) => ({ ...prev, [docId]: true }));
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('contract_id', String(contract.id));
      form.append('contract_required_document_id', String(docId));
      const { data } = await api.post(`/workspaces/${wsId}/files`, form);
      if (data) onUpload();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || t('doc_upload_failed'));
    } finally {
      setUploading((prev) => ({ ...prev, [docId]: false }));
    }
  };

  const docs = contract.required_documents || [];
  const hasMissingDocs = docs.length > 0 && docs.some((d) => !(d.files ?? []).some((f) => f.status !== 'rejected'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        ref={dialogRef}
        {...dialogProps}
        aria-labelledby={titleId}
        className="bg-[var(--color-card)] rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto border border-[var(--color-card-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 id={titleId} className="text-lg font-bold">{contract.title}</h3>
            <StatusBadge status={contract.status} className="mt-1" />
          </div>
          <button onClick={onClose} aria-label={t('close')} className="text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)] text-xl">&times;</button>
        </div>

        <ContractStatusStepper status={contract.status} />

        {Number(contract.value) > 0 && (
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">{t('contract_value', { value: contract.value ?? '', currency: contract.currency || 'SAR' })}</p>
        )}
        {clientType === 'business' && Number(contract.value) > 0 && (
          <p className="text-xs text-[var(--color-text-disabled)] mb-1">{t('contract_excl_vat')}</p>
        )}
        {contract.start_date && (
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">{t('contract_date_range', { start: contract.start_date, endSuffix: contract.end_date ? t('contract_date_to', { end: contract.end_date }) : '' })}</p>
        )}

        {contract.clauses?.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-bold text-[var(--color-foreground)] mb-2">{t('contract_clauses_heading')}</h4>
            {/* dir="auto" below: see the matching note in ContractsTab. */}
            {contract.clauses.map((cl) => (
              <div key={cl.id} dir="auto" className="text-sm text-[var(--color-text-secondary)] pr-3 border-r-2 border-[var(--color-card-border)] py-1">
                {cl.content}
                <span className="text-xs text-[var(--color-text-disabled)] mr-2">
                  ({cl.type === 'fixed' ? t('doc_type_fixed') : cl.type === 'optional' ? t('doc_type_optional') : t('doc_type_custom')})
                </span>
              </div>
            ))}
          </div>
        )}

        {docs.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-bold text-[var(--color-foreground)] mb-2">{t('documents_heading')}</h4>
            {docs.map((doc) => {
              const files = doc.files ?? [];
              const approved = files.some((f) => f.status === 'approved');
              const lastRejected = [...files].reverse().find((f) => f.status === 'rejected');
              const hasLive = files.some((f) => f.status !== 'rejected');
              return (
                <div key={doc.id} className="flex items-start justify-between gap-3 text-sm border border-[var(--color-card-border)] rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{doc.name}</p>
                    {files.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {/* Every file uploaded for this document, each with its
                            own status; not-yet-approved ones the client uploaded
                            can be deleted. */}
                        {files.map((file) => (
                          <div key={file.id} className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              file.status === 'approved' ? 'bg-green-900/30 text-green-400' :
                              file.status === 'rejected' ? 'bg-red-900/30 text-red-400' :
                              'bg-yellow-900/30 text-yellow-400'
                            }`}>
                              {file.status === 'approved' ? t('file_approved_status') : file.status === 'rejected' ? t('file_rejected_status') : t('file_pending_review')}
                            </span>
                            {file.file_url ? (
                              <a href={resolveFileUrl(file.file_url)} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-text-disabled)] hover:underline truncate max-w-[180px]">{file.name}</a>
                            ) : (
                              <span className="text-xs text-[var(--color-text-disabled)]">{file.name}</span>
                            )}
                            {file.status !== 'approved' && isMyUpload(file) && (
                              <button type="button" onClick={() => setPendingDelete(file)}
                                aria-label={`${t('doc_delete')} ${file.name || ''}`.trim()}
                                className="text-xs text-red-400 hover:underline">
                                {t('doc_delete')}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-text-disabled)] mt-1">{t('doc_not_uploaded')}</p>
                    )}
                    {!hasLive && lastRejected?.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">{t('doc_reason_prefix')}{lastRejected.rejection_reason}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {/* subuser-review-plan.md م٦ — required-document uploads
                        map to can_upload_files, per the plan's action table.
                        More files can be added until one is approved. */}
                    {!approved && canDo('can_upload_files') ? (
                      <label className={`inline-flex items-center gap-1 text-xs text-[var(--color-gold-text)] cursor-pointer hover:text-[var(--color-gold-text)] ${uploading[doc.id] ? 'opacity-50' : ''}`}>
                        <input type="file" className="hidden" disabled={uploading[doc.id]} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(doc.id, f); e.target.value = ''; }} />
                        {uploading[doc.id] ? t('doc_uploading') : hasLive ? t('doc_add_more') : files.length > 0 ? t('doc_upload_new') : t('doc_upload')}
                      </label>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
        )}

        {canAct && canDo('can_approve_contracts') && (
          <div className="mt-6">
            {hasMissingDocs && (
              <p className="mb-3 text-xs text-amber-500 text-center font-medium">
                {t('contract_upload_required_first_msg')}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => onAction('approved')}
                disabled={hasMissingDocs}
                className="flex-1 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {t('contract_approve_action')}
              </button>
              <button onClick={() => onAction('edit_requested')}
                className="flex-1 bg-amber-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-700">
                {t('contract_edit_action')}
              </button>
            </div>
          </div>
        )}
        {contract.pdf_url && ['client_approved', 'company_approved', 'completed', 'archived'].includes(contract.status) && (
          <div className="mt-4 text-center">
            <a href={resolveFileUrl(contract.pdf_url)} target="_blank" rel="noopener noreferrer"
              className="inline-block px-4 py-2 rounded-lg border border-[var(--color-card-border)] text-sm text-[var(--color-foreground)] hover:bg-[var(--color-input-fill)]">
              {contract.status === 'client_approved' ? t('view_signed_contract').replace('📄 ', '') : t('download_final_contract').replace('📄 ', '')}
            </a>
          </div>
        )}

        {canAct && !canDo('can_approve_contracts') && (
          <p className="mt-4 text-sm text-[var(--color-text-disabled)] text-center">{t('subuser_action_needs_owner')}</p>
        )}

        {!canAct && contract.status !== 'draft' && contract.status !== 'archived' && (
          <p className="mt-4 text-sm text-[var(--color-text-disabled)] text-center">
            {contract.status === 'client_approved' ? t('contract_you_approved') :

             contract.status === 'edit_requested' ? t('contract_you_edit_requested') :
             contract.status === 'company_approved' ? t('contract_company_approve_msg') :
             contract.status === 'completed' ? t('contract_completed_msg') : ''}
          </p>
        )}
      </div>
      {/* Clicks inside the confirm must not reach the backdrop above (it closes this sheet). */}
      <div onClick={(e) => e.stopPropagation()}>
      <ConfirmDialog
        open={!!pendingDelete}
        title={t('doc_delete_confirm_title')}
        message={t('doc_delete_confirm_msg')}
        confirmLabel={deleting ? '...' : t('doc_delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={deleteFile}
        onCancel={() => setPendingDelete(null)}
      />
      </div>
    </div>
  );
}
