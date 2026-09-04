'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getUser } from '@/lib/auth';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { resolveFileUrl, notifyWriteError } from '@/lib/utils';
import { useWorkspaceApprovals, useSendApproval } from '@/hooks/queries/useApprovals';

export default function ApprovalsTab({ wsId }: { wsId: number }) {
  const isSA = getUser()?.role === 'super_admin';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');

  const approvalsQuery = useWorkspaceApprovals(wsId);
  const sendMutation = useSendApproval(wsId);

  const approvals = approvalsQuery.data ?? [];
  const loading = approvalsQuery.isLoading;
  const error = approvalsQuery.isError && approvalsQuery.data === undefined ? t('approvals_load_error') : '';

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const sendApproval = () => {
    if (!title || sendMutation.isPending) return;
    const form = new FormData();
    form.append('title', title);
    if (description) form.append('description', description);
    files.forEach((f) => form.append('files[]', f));
    sendMutation.mutate(form, {
      onSuccess: () => { setTitle(''); setDescription(''); setFiles([]); },
      onError: (err) => notifyWriteError(tc, 'ApprovalsTab.sendApproval', err),
    });
  };

  if (loading) return <TableSkeleton />;
  if (error) return <p className="text-sm text-red-400 text-center py-8">{error}</p>;

  return (
    <div className="space-y-4">
      {!isSA && (
        <div className="space-y-2 border border-[var(--color-card-border)] rounded-lg p-4 bg-[var(--color-card-border)]">
          <h3 className="font-medium text-sm text-[var(--color-foreground)]">{t('new_approval_request')}</h3>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('approval_title_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('approval_desc_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" rows={2} />

          <div className="flex items-center gap-2">
            <input type="file" ref={fileRef} multiple className="hidden" onChange={(e) => { if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }} />
            <button onClick={() => fileRef.current?.click()} className="text-sm text-[var(--color-gold-text)] hover:underline">{t('attach_files')}</button>
            {files.length > 0 && (
              <div className="flex items-center gap-1">
                {files.map((f, i) => (
                  <span key={i} className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded flex items-center gap-1">
                    {f.name}
                    <button onClick={() => removeFile(i)} aria-label={t('remove_file', { file: f.name })} className="text-red-500 hover:text-red-700">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button onClick={sendApproval} disabled={sendMutation.isPending || !title} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
            {sendMutation.isPending ? t('sending_label') : t('send_approval_request')}
          </button>
        </div>
      )}

      {approvals.length === 0 ? <EmptyState message={t('no_approvals')} /> : null}
      {approvals.map((a) => {
        const statusColors: Record<string, string> = {
          approved: 'bg-emerald-900/30 text-emerald-400',
          pending: 'bg-yellow-900/30 text-yellow-400',
          rejected: 'bg-red-900/30 text-red-400',
          edit_requested: 'bg-amber-900/30 text-amber-400',
        };
        const statusLabels: Record<string, string> = {
          approved: t('approval_approved_status'),
          pending: t('approval_pending_status'),
          rejected: t('approval_rejected_status'),
          edit_requested: t('approval_edit_requested_status'),
        };
        return (
          <div key={a.id} className="border border-[var(--color-card-border)] rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{a.title}</h3>
                {a.description && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{a.description}</p>}
                {a.reference_no && <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">{t('reference_prefix')}{a.reference_no}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[a.status] || 'bg-zinc-700/30 text-zinc-400'}`}>
                {statusLabels[a.status] || a.status}
              </span>
            </div>

            {/* Files */}
            {a.files && a.files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {a.files.map((f) => (
                  <a key={f.id} href={resolveFileUrl(f.file_url)} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[var(--color-gold-text)] underline bg-blue-900/30 px-2 py-0.5 rounded">
                    📎 {f.name || t('file_label')}
                  </a>
                ))}
              </div>
            )}

            {/* Certificate */}
            {a.certificate && (
              <div className="mt-2 text-xs text-[var(--color-gold-text)]">
                <a href={resolveFileUrl(a.certificate.pdf_url)} target="_blank" rel="noopener noreferrer">{t('download_certificate')}</a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
