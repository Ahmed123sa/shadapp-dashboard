'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTranslations } from 'next-intl';
import { resolveFileUrl } from '@/lib/utils';
import type { Approval } from '@/types';

export default function ClientApprovals({ wsId, clientId }: { wsId: number; clientId: number }) {
  const t = useTranslations('dashboard');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [respondTarget, setRespondTarget] = useState<{ id: number; action: string } | null>(null);

  useEffect(() => {
    api.get(`/workspaces/${wsId}/approvals`)
      .then(({ data }) => setApprovals(data.approvals?.data || data.approvals || []))
      .catch((e) => { console.error(e); setError(t('approval_load_failed')); })
      .finally(() => setLoading(false));
  }, [wsId]);

  const respond = async () => {
    if (!respondTarget) return;
    const { data } = await api.post(`/approvals/${respondTarget.id}/respond`, { action: respondTarget.action }).catch(() => ({ data: null }));
    if (data) {
      setApprovals((prev) => prev.map((a) => a.id === respondTarget.id ? data.approval : a));
    }
    setRespondTarget(null);
  };

  if (loading) return <TableSkeleton />;
  if (error) return <p className="text-sm text-red-500 text-center py-8">{error}</p>;

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
    <div className="space-y-3">
      {approvals.length === 0 ? <EmptyState message={t('approval_no_approvals')} /> : null}
      {approvals.map((a) => (
        <div key={a.id} className="border border-[var(--color-card-border)] rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium">{a.title}</h4>
              {a.description && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{a.description}</p>}
              <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">{t('approval_ref_prefix')}{a.reference_no}</p>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] || ''}`}>
              {statusLabels[a.status] || a.status}
            </span>
          </div>

          {a.files && a.files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {a.files.map((f) => (
                <a key={f.id} href={resolveFileUrl(f.file_url)} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-[var(--color-gold-text)] underline bg-blue-900/30 px-2 py-0.5 rounded">
                  📎 {f.name || t('approval_file_label')}
                </a>
              ))}
            </div>
          )}

          {a.certificate?.pdf_url && (
              <div className="mt-1 text-xs text-[var(--color-gold-text)]">
                📄 <a href={resolveFileUrl(a.certificate.pdf_url)} target="_blank" rel="noopener noreferrer" className="hover:underline">{t('approval_certificate')}</a>
            </div>
          )}

          {a.status === 'pending' && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => setRespondTarget({ id: a.id, action: 'approved' })}
                className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">{t('approval_respond_approve')}</button>
              <button onClick={() => setRespondTarget({ id: a.id, action: 'edit_requested' })}
                className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700">{t('approval_respond_edit_request')}</button>
            </div>
          )}
        </div>
      ))}

      <ConfirmDialog
        open={!!respondTarget}
        title={respondTarget?.action === 'approved' ? t('approval_confirm_approve_btn') : t('approval_confirm_edit_btn')}
        message={respondTarget?.action === 'approved' ? t('approval_confirm_approve') : t('approval_confirm_edit_request')}
        confirmLabel={t('approval_confirm_approve_btn')}
        cancelLabel={t('approval_confirm_cancel')}
        variant="default"
        onConfirm={respond}
        onCancel={() => setRespondTarget(null)}
      />
    </div>
  );
}
