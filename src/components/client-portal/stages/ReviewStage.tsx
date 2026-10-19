'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/api';
import { canDo } from '@/lib/client-auth';
import { getErrorCode, getErrorMessage, notifyWriteError, resolveFileUrl } from '@/lib/utils';
import { reportError } from '@/lib/error-reporting';
import { showToast } from '@/components/ToastNotification';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import ContractDetailModal from '@/components/client-contracts/ContractDetailModal';
import { useClientContractAction, useWorkspaceContracts } from '@/hooks/queries/useContracts';
import { Btn, Icon, StatusDot } from '../ui';

interface Props {
  wsId: number;
  clientType?: string;
  /** Called after anything that can move the client to another stage. */
  onChanged: () => void;
}

/** Stage 2 — read the contract, upload required documents, approve or ask for edits. */
export default function ReviewStage({ wsId, clientType, onChanged }: Props) {
  const t = useTranslations('client_portal');
  const tc = useTranslations('common');
  const locale = useLocale();
  const contractsQuery = useWorkspaceContracts(wsId);
  const actionMutation = useClientContractAction(wsId);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [uploadError, setUploadError] = useState('');

  const contract = (contractsQuery.data ?? []).find((c) => c.status === 'sent') ?? null;

  if (contractsQuery.isLoading) return <p className="lead">{t('stage_loading')}</p>;
  if (!contract) {
    return <p className="lead">{contractsQuery.isError ? t('contract_load_failed') : t('stage_loading')}</p>;
  }

  const docs = contract.required_documents ?? [];
  const liveFile = (d: (typeof docs)[number]) => (d.files ?? []).find((f) => f.status !== 'rejected');
  const rejectedFile = (d: (typeof docs)[number]) => (d.files ?? []).find((f) => f.status === 'rejected');
  const missing = docs.filter((d) => !liveFile(d));
  const hasMissing = missing.length > 0;
  const canApprove = canDo('can_approve_contracts');
  const canUpload = canDo('can_upload_files');
  const busy = actionMutation.isPending;

  const nf = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 });
  const value = Number(contract.value);
  const dateLabel = contract.created_at
    ? new Date(contract.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })
    : null;
  const count = contract.clauses?.length ?? 0;
  const sub = dateLabel ? t('sub_line', { date: dateLabel, count }) : t('sub_line_nodate', { count });

  const uploadDoc = async (docId: number, file: File) => {
    setUploading((p) => ({ ...p, [docId]: true }));
    setUploadError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('contract_id', String(contract.id));
      form.append('contract_required_document_id', String(docId));
      const { data } = await api.post(`/workspaces/${wsId}/files`, form);
      if (data) await contractsQuery.refetch();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setUploadError(err?.response?.data?.message || err?.message || '');
    } finally {
      setUploading((p) => ({ ...p, [docId]: false }));
    }
  };

  const run = (action: 'approved' | 'edit_requested') => {
    actionMutation.mutate(
      { id: contract.id, action, ...(action === 'edit_requested' && reason.trim() ? { reason: reason.trim() } : {}) },
      {
        onSuccess: () => {
          setEditing(false);
          setReason('');
          setPreviewOpen(false);
          onChanged();
        },
        onError: (err) => {
          if (getErrorCode(err) === 'signature_required') {
            reportError('ReviewStage.run', err);
            showToast({ id: 'ReviewStage.signatureRequired', title: t('sig_required_title'), message: getErrorMessage(err) || t('sig_required_msg') });
            return;
          }
          if (getErrorCode(err) === 'required_documents_missing') {
            reportError('ReviewStage.run', err);
            showToast({ id: 'ReviewStage.docsRequired', title: t('docs_required_title'), message: getErrorMessage(err) || t('docs_required_msg') });
            return;
          }
          notifyWriteError(tc, 'ReviewStage.run', err);
        },
        onSettled: () => setConfirmApprove(false),
      },
    );
  };

  return (
    <>
      <div className="k">{t('step_of', { a: 3, b: 6 })}</div>
      <h2 className="serifx">{t('rev_title')}</h2>
      <p className="lead">{t('rev_desc')}</p>

      <div className="ccard">
        <div>
          <div className="kind">{contract.contract_type === 'additional' ? t('kind_extra') : t('kind_main')}</div>
          <div className="title serifx">{contract.title}</div>
          <div className="sub">{sub}</div>
        </div>
        {value > 0 && (
          <div className="amt">
            {nf.format(value)}
            <small>{contract.currency || 'SAR'}</small>
            {clientType === 'business' && <div className="sub" style={{ fontSize: 11 }}>{t('excl_vat')}</div>}
          </div>
        )}
        <div className="row2">
          <button type="button" className="lnk" onClick={() => setPreviewOpen(true)}>
            <Icon name="eye" />
            {t('preview')}
          </button>
          {contract.pdf_url && (
            <a className="lnk" href={resolveFileUrl(contract.pdf_url)} target="_blank" rel="noopener noreferrer">
              <Icon name="doc" />
              {t('download')}
            </a>
          )}
        </div>
      </div>

      {docs.length > 0 && (
        <div className="docs">
          <div className="h">{t('docs_h')}</div>
          {docs.map((d) => {
            const file = liveFile(d);
            const rej = rejectedFile(d);
            return (
              <div className="doc" key={d.id}>
                <div>
                  <span className="nm">{d.name}</span>
                  {!file && rej?.rejection_reason && (
                    <div className="sub" style={{ fontSize: 12, color: 'var(--faint)' }}>{t('reject_reason_label', { reason: rej.rejection_reason })}</div>
                  )}
                </div>
                <span className="st">
                  <StatusDot tone={file ? 'ok' : 'crimson'} />
                  {file ? t('doc_uploaded') : t('doc_missing')}
                </span>
                <div className="end">
                  {file ? (
                    <a className="lnk" href={resolveFileUrl(file.file_url)} target="_blank" rel="noopener noreferrer">{t('doc_view')}</a>
                  ) : canUpload ? (
                    <label className="btn" style={uploading[d.id] ? { opacity: 0.5 } : undefined}>
                      <Icon name="up" />
                      {uploading[d.id] ? t('doc_uploading') : t('doc_upload')}
                      <input
                        type="file"
                        aria-label={`${t('doc_upload')} ${d.name}`}
                        style={{ display: 'none' }}
                        disabled={uploading[d.id]}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadDoc(d.id, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            );
          })}
          {uploadError && <p role="alert" style={{ color: 'var(--crimson-ink)', fontSize: 12.5, marginTop: 8 }}>{uploadError}</p>}
        </div>
      )}

      {canApprove ? (
        <>
          <div className="acts2">
            <Btn variant="primary" size="lg" disabled={hasMissing || busy} onClick={() => setConfirmApprove(true)}>
              {busy && !editing ? t('approving') : t('approve')}
            </Btn>
            <Btn size="lg" disabled={busy} onClick={() => setEditing(true)}>{t('req_edit')}</Btn>
            {hasMissing && <span className="hint">{t('approve_hint')}</span>}
          </div>
          {editing && (
            <div className="editbox">
              <label htmlFor="cx-edit-reason">{t('edit_label')}</label>
              <textarea
                id="cx-edit-reason"
                className="ta"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('edit_ph')}
                rows={3}
              />
              <div className="acts2" style={{ marginTop: 16 }}>
                <Btn variant="primary" disabled={busy} onClick={() => run('edit_requested')}>{busy ? t('sending') : t('send_request')}</Btn>
                <Btn onClick={() => { setEditing(false); setReason(''); }}>{t('cancel')}</Btn>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="acts2">
          <span className="hint">{t('need_perm_approve')}</span>
        </div>
      )}

      <ConfirmDialog
        open={confirmApprove}
        title={t('approve_confirm_title')}
        message={t('approve_confirm_msg')}
        confirmLabel={t('approve_confirm_btn')}
        cancelLabel={t('cancel')}
        onConfirm={() => run('approved')}
        onCancel={() => setConfirmApprove(false)}
      />

      {previewOpen && (
        <ContractDetailModal
          contract={contract}
          wsId={wsId}
          clientType={clientType}
          onClose={() => setPreviewOpen(false)}
          onAction={(action) => {
            setPreviewOpen(false);
            if (action === 'approved') setConfirmApprove(true);
            else setEditing(true);
          }}
          onUpload={() => contractsQuery.refetch()}
        />
      )}
    </>
  );
}
