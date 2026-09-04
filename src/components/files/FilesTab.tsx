'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import ErrorState from '@/components/ErrorState';
import { reportError } from '@/lib/error-reporting';
import { resolveFileUrl } from '@/lib/utils';
import type { FileEntry, PaymentProofFile, DocumentDefinition } from '@/types';

export default function FilesTab({ wsId }: { wsId: number }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const isSA = getUser()?.role === 'super_admin';
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [paymentFiles, setPaymentFiles] = useState<PaymentProofFile[]>([]);
  const [definitions, setDefinitions] = useState<DocumentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showDefForm, setShowDefForm] = useState(false);
  const [defName, setDefName] = useState('');
  const [uploadDef, setUploadDef] = useState('');

  const load = () => {
    setLoading(true);
    setLoadError(false);
    return api.get(`/workspaces/${wsId}/files`)
      .then(({ data }) => { setFiles(data.files || []); setPaymentFiles(data.paymentFiles || []); setDefinitions(data.definitions || []); })
      .catch((err) => { reportError('FilesTab.load', err); setLoadError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [wsId]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const form = new FormData(); form.append('file', file);
    if (uploadDef) form.append('document_definition_id', uploadDef);
    const { data } = await api.post(`/workspaces/${wsId}/files`, form).catch(() => ({ data: null }));
    if (data) { setFiles((prev) => [...prev, data.file]); setUploadDef(''); }
  };

  const addDef = async () => {
    if (!defName) return;
    const { data } = await api.post(`/workspaces/${wsId}/document-definitions`, { name: defName }).catch(() => ({ data: null }));
    if (data) { setDefinitions((prev) => [...prev, data.definition]); setDefName(''); setShowDefForm(false); }
  };

  const reviewFile = async (fid: number, action: string, rejection_reason?: string) => {
    const body: { action: string; rejection_reason?: string } = { action };
    if (rejection_reason) body.rejection_reason = rejection_reason;
    const { data } = await api.post(`/files/${fid}/review`, body).catch(() => ({ data: null }));
    if (data) setFiles((prev) => prev.map((f) => f.id === fid ? data.file : f));
  };

  if (loading) return <TableSkeleton />;
  if (loadError) return <ErrorState onRetry={load} />;

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
