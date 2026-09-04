'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { getUser } from '@/lib/auth';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import ErrorState from '@/components/ErrorState';
import { resolveFileUrl, notifyWriteError } from '@/lib/utils';
import { useWorkspaceFiles, useUploadFile, useAddDocumentDefinition, useReviewFile } from '@/hooks/queries/useFiles';

export default function FilesTab({ wsId }: { wsId: number }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const isSA = getUser()?.role === 'super_admin';
  const [showDefForm, setShowDefForm] = useState(false);
  const [defName, setDefName] = useState('');
  const [uploadDef, setUploadDef] = useState('');

  const filesQuery = useWorkspaceFiles(wsId);
  const uploadMutation = useUploadFile(wsId);
  const addDefMutation = useAddDocumentDefinition(wsId);
  const reviewMutation = useReviewFile(wsId);

  const files = filesQuery.data?.files ?? [];
  const paymentFiles = filesQuery.data?.paymentFiles ?? [];
  const definitions = filesQuery.data?.definitions ?? [];
  const loading = filesQuery.isLoading;
  // Only show the full error screen when no data has ever loaded — a later
  // background retry failing should not yank away files already on screen.
  const loadError = filesQuery.isError && filesQuery.data === undefined;

  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const form = new FormData(); form.append('file', file);
    if (uploadDef) form.append('document_definition_id', uploadDef);
    uploadMutation.mutate(form, {
      onSuccess: () => setUploadDef(''),
      onError: (err) => notifyWriteError(tc, 'FilesTab.upload', err),
    });
  };

  const addDef = () => {
    if (!defName) return;
    addDefMutation.mutate(defName, {
      onSuccess: () => { setDefName(''); setShowDefForm(false); },
      onError: (err) => notifyWriteError(tc, 'FilesTab.addDef', err),
    });
  };

  const reviewFile = (fid: number, action: string, rejection_reason?: string) => {
    reviewMutation.mutate({ fid, action, rejection_reason }, {
      onError: (err) => notifyWriteError(tc, 'FilesTab.reviewFile', err),
    });
  };

  if (loading) return <TableSkeleton />;
  if (loadError) return <ErrorState onRetry={() => filesQuery.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {definitions.map((d) => <span key={d.id} className="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-full text-xs">{d.name} {d.is_required ? '*' : ''}</span>)}
        <button onClick={() => setShowDefForm(!showDefForm)} className="text-xs text-[var(--color-gold-text)] hover:underline">{t('define_document')}</button>
      </div>
      {showDefForm && (
        <div className="flex gap-2">
          <input value={defName} onChange={(e) => setDefName(e.target.value)} placeholder={t('doc_name_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm flex-1 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
          <button onClick={addDef} className="bg-[var(--color-primary)] text-white px-3 py-2 rounded-lg text-sm">{tc('save')}</button>
        </div>
      )}

      {!isSA && (
        <div className="flex gap-2 items-center">
          <select value={uploadDef} onChange={(e) => setUploadDef(e.target.value)} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-input-fill)] text-[var(--color-foreground)]">
            <option value="">{t('no_category')}</option>
            {definitions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 text-sm text-[var(--color-gold-text)] cursor-pointer hover:text-[var(--color-gold-text)]">
            <input type="file" className="hidden" onChange={upload} />{t('upload_file')}
          </label>
        </div>
      )}

      {files.length === 0 && paymentFiles.length === 0 ? <EmptyState message={t('no_files')} /> : null}
      <div className="space-y-2">
        {files.map((f) => (
          <div key={f.id} className="border border-[var(--color-card-border)] rounded-lg p-3 text-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{f.name}</p>
                {f.tag && (
                  <span className="px-2 py-0.5 bg-red-900/20 text-red-400 rounded text-[length:var(--fs-1)] font-bold">{f.tag}</span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-disabled)]">
                {f.document_definition?.name ? `${f.document_definition.name} • ` : ''}
                {f.size ? `${(f.size / 1024).toFixed(0)} KB` : ''}
                {f.reviewed_by ? ` • ${t('reviewed')}` : ''}
              </p>
              {f.rejection_reason && <p className="text-xs text-red-500 mt-1">{t('reason')}{f.rejection_reason}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs ${f.status === 'approved' ? 'bg-green-900/30 text-green-400' : f.status === 'rejected' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                {f.status === 'approved' ? t('approved_status') : f.status === 'rejected' ? t('rejected_status') : t('pending_review')}
              </span>
              {f.file_url && (
                <a href={resolveFileUrl(f.file_url)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">{t('view_file')}</a>
              )}
              {isSA && f.status === 'pending' && (
                <>
                  <button onClick={() => reviewFile(f.id, 'approved')} className="text-xs text-green-600 hover:underline">{t('accept')}</button>
                  <button onClick={() => { const r = prompt(t('rejection_reason_prompt')); if (r) reviewFile(f.id, 'rejected', r); }} className="text-xs text-red-600 hover:underline">{t('reject')}</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {paymentFiles.length > 0 && (
        <>
          <h4 className="text-sm font-bold text-[var(--color-gold-text)] mt-4">{t('payment_proofs_heading')}</h4>
          <div className="space-y-2">
            {paymentFiles.map((pf) => (
              <div key={pf.id} className="border border-[var(--color-card-border)] rounded-lg p-3 text-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{pf.name}</p>
                    <span className="px-2 py-0.5 bg-green-900/20 text-green-400 rounded text-[length:var(--fs-1)] font-bold">{t('payment_proof_tag')}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-disabled)]">{pf.amount} {pf.currency}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${pf.status === 'approved' || pf.status === 'verified' ? 'bg-green-900/30 text-green-400' : pf.status === 'rejected' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                    {pf.status === 'approved' || pf.status === 'verified' ? t('approved_status') : pf.status === 'rejected' ? t('rejected_status') : t('pending_review')}
                  </span>
                  {pf.file_url && (
                    <a href={resolveFileUrl(pf.file_url)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">{t('view_file')}</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
