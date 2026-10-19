'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import UploadFileModal from './UploadFileModal';
import { resolveFileUrl } from '@/lib/utils';
import { formatFileSize, formatShortDate } from '@/lib/client-format';
import { useWorkspaceFiles, fileKeys } from '@/hooks/queries/useFiles';
import { canDo } from '@/lib/client-auth';
import { Btn, Icon, StatusDot, type DotTone } from '@/components/client-portal/ui';
import type { FileEntry, PaymentProofFile, DocumentDefinition } from '@/types';

const TONE: Record<string, DotTone> = { approved: 'ok', verified: 'ok', pending: 'wait', rejected: 'crimson' };

/** "PDF", "ZIP"… for the little file badge. */
function extOf(name: string | undefined): string {
  const m = /\.([A-Za-z0-9]{1,4})$/.exec(name ?? '');
  return (m ? m[1] : 'FILE').toUpperCase();
}

export default function ClientFiles({ wsId }: { wsId: number }) {
  const t = useTranslations('dashboard');
  const tp = useTranslations('client_portal');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);

  const filesQuery = useWorkspaceFiles(wsId);
  const files = filesQuery.data?.files ?? [];
  const paymentFiles = filesQuery.data?.paymentFiles ?? [];
  const definitions = filesQuery.data?.definitions ?? [];
  const loading = filesQuery.isLoading;
  // Same "only show a full error screen on the very first failed load"
  // guard used elsewhere in this migration (Payments slice) — a later
  // background refetch failing leaves stale data on screen instead.
  const error = filesQuery.isError && filesQuery.data === undefined ? t('file_load_failed') : '';

  if (loading) return <TableSkeleton />;
  if (error) return <p className="locked" style={{ padding: '40px 0', justifyContent: 'center', width: '100%' }}>{error}</p>;

  const statusLabel = (s: string) =>
    s === 'approved' || s === 'verified' ? t('file_approved_status') : s === 'rejected' ? t('file_rejected_status') : t('file_pending_review');
  const sharedBy = (type: string) => (/User$/.test(type) ? tp('f_by_team') : tp('f_by_you'));

  const head = (
    <thead>
      <tr><th>{tp('f_name')}</th><th>{tp('f_by')}</th><th>{tp('f_date')}</th><th>{tp('f_size')}</th><th></th></tr>
    </thead>
  );

  return (
    <div className="ledger">
      {definitions.length > 0 && (
        <div className="perm" style={{ marginBottom: 14 }}>
          {definitions.map((d) => (
            <span key={d.id}>{d.name} {d.is_required ? '*' : ''}</span>
          ))}
        </div>
      )}

      {/* subuser-review-plan.md م٦ — uploading a file maps to
          can_upload_files, per the plan's action table. */}
      {canDo('can_upload_files') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Btn variant="primary" onClick={() => setShowUpload(true)}>
            <Icon name="up" />
            {tp('f_upload')}
          </Btn>
        </div>
      )}

      {files.length === 0 && paymentFiles.length === 0 ? (
        <p className="locked" style={{ padding: '48px 0', justifyContent: 'center', width: '100%' }}>{t('file_no_files')}</p>
      ) : null}

      {files.length > 0 && (
        <div className="tblbox">
          <table className="tbl2">
            {head}
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td>
                    <div className="who2">
                      <div className="fileic">{extOf(f.name)}</div>
                      <div>
                        <div className="n" style={{ fontFamily: 'var(--sans)', fontSize: 14 }}>{f.name}</div>
                        <div className="e">
                          {f.tag && <span style={{ color: 'var(--crimson-ink)', marginInlineEnd: 8 }}>{f.tag}</span>}
                          {f.document_definition?.name ? `${f.document_definition.name} · ` : ''}
                          <StatusDot tone={TONE[f.status] ?? 'faint'}>{statusLabel(f.status)}</StatusDot>
                        </div>
                        {f.rejection_reason && <div className="e" style={{ color: 'var(--crimson-ink)' }}>{t('file_rejection_reason', { reason: f.rejection_reason })}</div>}
                      </div>
                    </div>
                  </td>
                  <td>{sharedBy(f.uploaded_by_type)}</td>
                  <td className="num-ltr">{formatShortDate(f.created_at, locale)}</td>
                  <td className="num-ltr">{formatFileSize(f.size)}</td>
                  <td>
                    {f.file_url && (
                      <a className="lnk" href={resolveFileUrl(f.file_url)} target="_blank" rel="noopener noreferrer">
                        <Icon name="down" />
                        {t('file_view')}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paymentFiles.length > 0 && (
        <>
          <div className="section-h">{t('file_payment_proofs')}</div>
          <div className="tblbox">
            <table className="tbl2">
              {head}
              <tbody>
                {paymentFiles.map((pf) => (
                  <tr key={pf.id}>
                    <td>
                      <div className="who2">
                        <div className="fileic">{extOf(pf.name)}</div>
                        <div>
                          <div className="n" style={{ fontFamily: 'var(--sans)', fontSize: 14 }}>{pf.name}</div>
                          <div className="e">
                            <span style={{ marginInlineEnd: 8 }}>{t('file_payment_proof_badge')}</span>
                            <StatusDot tone={TONE[pf.status] ?? 'faint'}>{statusLabel(pf.status)}</StatusDot>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{tp('f_by_you')}</td>
                    <td className="num-ltr">{formatShortDate(pf.created_at, locale)}</td>
                    <td className="num-ltr">{`${pf.amount} ${pf.currency ?? ''}`.trim()}</td>
                    <td>
                      {pf.file_url && (
                        <a className="lnk" href={resolveFileUrl(pf.file_url)} target="_blank" rel="noopener noreferrer">
                          <Icon name="down" />
                          {t('file_view')}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showUpload && (
        <UploadFileModal
          wsId={wsId}
          definitions={definitions}
          onClose={() => setShowUpload(false)}
          onCreated={(file: FileEntry) => {
            queryClient.setQueryData<{ files: FileEntry[]; paymentFiles: PaymentProofFile[]; definitions: DocumentDefinition[] } | undefined>(
              fileKeys.workspace(wsId),
              (old) => (old ? { ...old, files: [...old.files, file] } : old)
            );
            setShowUpload(false);
          }}
        />
      )}
    </div>
  );
}
