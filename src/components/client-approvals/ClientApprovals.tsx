'use client';

import { useState } from 'react';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTranslations } from 'next-intl';
import { resolveFileUrl, notifyWriteError } from '@/lib/utils';
import { useWorkspaceApprovals, useRespondApproval } from '@/hooks/queries/useApprovals';
import { canDo } from '@/lib/client-auth';
import { Btn, Icon, StatusDot, type DotTone } from '@/components/client-portal/ui';

const TONE: Record<string, DotTone> = {
  approved: 'ok',
  pending: 'wait',
  rejected: 'crimson',
  edit_requested: 'crimson',
};

export default function ClientApprovals({ wsId }: { wsId: number; clientId: number }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [respondTarget, setRespondTarget] = useState<{ id: number; action: string } | null>(null);

  const approvalsQuery = useWorkspaceApprovals(wsId);
  const respondMutation = useRespondApproval(wsId);

  const approvals = approvalsQuery.data ?? [];
  const loading = approvalsQuery.isLoading;
  const error = approvalsQuery.isError && approvalsQuery.data === undefined ? t('approval_load_failed') : '';
  const canRespond = canDo('can_respond_approvals');

  const respond = () => {
    if (!respondTarget) return;
    respondMutation.mutate(respondTarget, {
      onError: (err) => notifyWriteError(tc, 'ClientApprovals.respond', err),
    });
    setRespondTarget(null);
  };

  if (loading) return <TableSkeleton />;
  if (error) return <p className="locked" style={{ padding: '40px 0', justifyContent: 'center', width: '100%' }}>{error}</p>;

  const statusLabels: Record<string, string> = {
    approved: t('approval_approved_status'),
    pending: t('approval_pending_status'),
    rejected: t('approval_rejected_status'),
    edit_requested: t('approval_edit_requested_status'),
  };

  return (
    <div className="ledger">
      {approvals.length === 0 ? (
        <p className="locked" style={{ padding: '48px 0', justifyContent: 'center', width: '100%' }}>{t('approval_no_approvals')}</p>
      ) : null}
      <div className="rows">
        {approvals.map((a) => (
          <div key={a.id} className={`rowx ${a.status === 'pending' ? 'apcard' : ''}`.trim()}>
            <div>
              <div className="title">{a.title}</div>
              {a.description && <div className="sub">{a.description}</div>}
              <div className="sub">{t('approval_ref_prefix')}{a.reference_no}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              {(a.files ?? []).map((f) => (
                <a key={f.id} className="lnk" href={resolveFileUrl(f.file_url)} target="_blank" rel="noopener noreferrer">
                  <Icon name="clip" />
                  {f.name || t('approval_file_label')}
                </a>
              ))}
              {a.certificate?.pdf_url && (
                <a className="lnk" href={resolveFileUrl(a.certificate.pdf_url)} target="_blank" rel="noopener noreferrer">
                  <Icon name="doc" />
                  {t('approval_certificate')}
                </a>
              )}
            </div>
            <span className="st2"><StatusDot tone={TONE[a.status] ?? 'faint'} />{statusLabels[a.status] || a.status}</span>
            <div className="acts">
              {/* subuser-review-plan.md م٦ — responding to an approval request
                  maps to can_respond_approvals, per the plan's action table. */}
              {a.status === 'pending' && canRespond && (
                <>
                  <Btn onClick={() => setRespondTarget({ id: a.id, action: 'edit_requested' })}>{t('approval_respond_edit_request')}</Btn>
                  <Btn variant="primary" onClick={() => setRespondTarget({ id: a.id, action: 'approved' })}>{t('approval_respond_approve')}</Btn>
                </>
              )}
              {a.status === 'pending' && !canRespond && (
                <span className="locked"><Icon name="lock" />{t('subuser_action_needs_owner')}</span>
              )}
            </div>
          </div>
        ))}
      </div>

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
