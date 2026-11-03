'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { canDo } from '@/lib/client-auth';
import { resolveFileUrl } from '@/lib/utils';
import { useWorkspaceContracts } from '@/hooks/queries/useContracts';
import type { Contract } from '@/types';
import { Icon, StatusDot } from './ui';

interface Props {
  wsId: number;
  /** Only this contract; otherwise every contract the client already approved. */
  contractId?: number;
}

type DocState = 'ok' | 'pending' | 'rejected' | 'missing';

/**
 * After the client approved a contract, the company still has to accept each
 * required document. This lists them with where each one stands, the reason a
 * rejected one was refused, and lets the client upload a replacement. It
 * renders nothing once every required document is accepted.
 */
export default function ContractDocsReview({ wsId, contractId }: Props) {
  const t = useTranslations('client_portal');
  const contractsQuery = useWorkspaceContracts(wsId);
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');
  const canUpload = canDo('can_upload_files');

  const contracts: Contract[] = (contractsQuery.data ?? []).filter((c) =>
    contractId !== undefined ? c.id === contractId : c.status === 'client_approved',
  );

  const stateOf = (files: { status: string }[]): DocState => {
    if (files.some((f) => f.status === 'approved')) return 'ok';
    if (files.length === 0) return 'missing';
    return files.every((f) => f.status === 'rejected') ? 'rejected' : 'pending';
  };

  const rows = contracts.flatMap((c) =>
    (c.required_documents ?? [])
      .filter((d) => d.is_required !== false)
      .map((d) => {
        const files = d.files ?? [];
        const rejected = [...files].reverse().find((f) => f.status === 'rejected');
        return { contract: c, doc: d, files, state: stateOf(files), reason: rejected?.rejection_reason };
      }),
  );

  if (rows.length === 0 || rows.every((r) => r.state === 'ok')) return null;

  const upload = async (contract: Contract, docId: number, file: File) => {
    setUploading((p) => ({ ...p, [docId]: true }));
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('contract_id', String(contract.id));
      form.append('contract_required_document_id', String(docId));
      await api.post(`/workspaces/${wsId}/files`, form);
      await contractsQuery.refetch();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || '');
    } finally {
      setUploading((p) => ({ ...p, [docId]: false }));
    }
  };

  const label: Record<DocState, string> = {
    ok: t('doc_state_ok'),
    pending: t('doc_state_pending'),
    rejected: t('doc_state_rejected'),
    missing: t('doc_missing'),
  };
  const tone: Record<DocState, 'ok' | 'wait' | 'crimson'> = { ok: 'ok', pending: 'wait', rejected: 'crimson', missing: 'crimson' };

  return (
    <div className="docs" style={{ marginTop: 18 }}>
      <div className="h">{t('docs_review_h')}</div>
      <p className="lead" style={{ margin: '0 0 6px', fontSize: 12.5 }}>{t('docs_review_desc')}</p>
      {rows.map(({ contract, doc, files, state, reason }) => (
        <div className="doc" key={`${contract.id}-${doc.id}`}>
          <div>
            <span className="nm">{doc.name}</span>
            {state === 'rejected' && reason && (
              <div className="sub" style={{ fontSize: 12, color: 'var(--faint)' }}>{t('reject_reason_label', { reason })}</div>
            )}
            {files.length > 0 && (
              <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                {files.map((f) => (
                  <a key={f.id} className="lnk" style={{ fontSize: 12.5 }} href={resolveFileUrl(f.file_url)} target="_blank" rel="noopener noreferrer">
                    {f.name || t('doc_view')}
                  </a>
                ))}
              </div>
            )}
          </div>
          <span className="st">
            <StatusDot tone={tone[state]} />
            {label[state]}
          </span>
          <div className="end">
            {(state === 'rejected' || state === 'missing') && canUpload ? (
              <label className="btn" style={uploading[doc.id] ? { opacity: 0.5 } : undefined}>
                <Icon name="up" />
                {uploading[doc.id] ? t('doc_uploading') : state === 'rejected' ? t('doc_replace') : t('doc_upload')}
                <input
                  type="file"
                  aria-label={`${state === 'rejected' ? t('doc_replace') : t('doc_upload')} ${doc.name}`}
                  style={{ display: 'none' }}
                  disabled={uploading[doc.id]}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(contract, doc.id, f);
                    e.target.value = '';
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>
      ))}
      {error && <p role="alert" style={{ color: 'var(--crimson-ink)', fontSize: 12.5, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
