'use client';
 
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import UploadFileModal from './UploadFileModal';
import { resolveFileUrl } from '@/lib/utils';
import type { FileEntry, PaymentProofFile, DocumentDefinition } from '@/types';

export default function ClientFiles({ wsId }: { wsId: number }) {
  const t = useTranslations('dashboard');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [paymentFiles, setPaymentFiles] = useState<PaymentProofFile[]>([]);
  const [definitions, setDefinitions] = useState<DocumentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const load = () => api.get(`/workspaces/${wsId}/files`)
    .then(({ data }) => { setFiles(data.files || []); setPaymentFiles(data.paymentFiles || []); setDefinitions(data.definitions || []); })
    .catch(() => setError(t('file_load_failed')))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, [wsId]);

  if (loading) return <TableSkeleton />;
  if (error) return <p className="text-sm text-red-500 text-center py-8">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {definitions.map((d) => (
          <span key={d.id} className="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-full text-xs">
            {d.name} {d.is_required ? '*' : ''}
          </span>
        ))}
      </div>

      <button onClick={() => setShowUpload(true)} className="text-sm text-[var(--color-gold-text)] hover:underline font-medium">
        {t('file_upload_button')}
      </button>

      {files.length === 0 && paymentFiles.length === 0 ? <EmptyState message={t('file_no_files')} /> : null}
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
              </p>
              {f.rejection_reason && <p className="text-xs text-red-500 mt-1">{t('file_rejection_reason', { reason: f.rejection_reason })}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                f.status === 'approved' ? 'bg-green-900/30 text-green-400' :
                f.status === 'rejected' ? 'bg-red-900/30 text-red-400' :
                'bg-yellow-900/30 text-yellow-400'
              }`}>
                {f.status === 'approved' ? t('file_approved_status') : f.status === 'rejected' ? t('file_rejected_status') : t('file_pending_review')}
              </span>
              {f.file_url && (
                <a href={resolveFileUrl(f.file_url)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">{t('file_view')}</a>
              )}
            </div>
          </div>
        ))}
      </div>

      {paymentFiles.length > 0 && (
        <>
          <h4 className="text-sm font-bold text-[var(--color-gold-text)] mt-4">{t('file_payment_proofs')}</h4>
          <div className="space-y-2">
            {paymentFiles.map((pf) => (
              <div key={pf.id} className="border border-[var(--color-card-border)] rounded-lg p-3 text-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{pf.name}</p>
                    <span className="px-2 py-0.5 bg-green-900/20 text-green-400 rounded text-[length:var(--fs-1)] font-bold">{t('file_payment_proof_badge')}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-disabled)]">{pf.amount} {pf.currency}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    pf.status === 'approved' || pf.status === 'verified' ? 'bg-green-900/30 text-green-400' :
                    pf.status === 'rejected' ? 'bg-red-900/30 text-red-400' :
                    'bg-yellow-900/30 text-yellow-400'
                  }`}>
                    {pf.status === 'approved' || pf.status === 'verified' ? t('file_approved_status') : pf.status === 'rejected' ? t('file_rejected_status') : t('file_pending_review')}
                  </span>
                  {pf.file_url && (
                    <a href={resolveFileUrl(pf.file_url)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">{t('file_view')}</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showUpload && (
        <UploadFileModal
          wsId={wsId}
          definitions={definitions}
          onClose={() => setShowUpload(false)}
          onCreated={(file) => { setFiles((prev) => [...prev, file]); setShowUpload(false); }}
        />
      )}
    </div>
  );
}
