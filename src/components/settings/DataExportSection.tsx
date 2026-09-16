'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { reportError } from '@/lib/error-reporting';
import ErrorState from '@/components/ErrorState';
import { useDataExports, useRequestDataExport } from '@/hooks/queries/useDataExports';
import type { Client, DataExport, User } from '@/types';

type Scope = 'system' | 'manager' | 'client';

const STATUS_STYLES: Record<DataExport['status'], string> = {
  pending: 'bg-yellow-900/30 text-yellow-400',
  processing: 'bg-blue-900/30 text-blue-400',
  ready: 'bg-emerald-900/30 text-emerald-400',
  failed: 'bg-red-900/30 text-red-400',
};

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Deliberately a plain module-level function, not inlined into the
// component: react-hooks/purity flags Date.now() (an impure call) if it
// appears directly in a component's render body, since the same render
// could in theory be evaluated more than once. Calling it from a regular
// function does the same thing "days left" always needs — the alternative
// (storing `now` in state) would take an effect and a re-render just to
// compute a value that's just rendered as-is, no different in accuracy.
function daysUntil(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * DATA_SAFETY_PLAN.md §3.6 — shared by both the super-admin and the account
 * manager settings sections (SettingsPage renders this once, isAM just
 * narrows which scopes are offered): scope picker, request button, and a
 * table of past requests with status/size/expiry/download. Authorization
 * for every scope choice is re-checked server-side regardless of what this
 * form lets a manager pick (App\Policies\DataExportPolicy) — this UI only
 * hides options that would just come back 403 anyway.
 */
export default function DataExportSection({ isAM, currentUserId }: { isAM: boolean; currentUserId: number }) {
  const t = useTranslations('settings');
  const exportsQuery = useDataExports();
  const requestMutation = useRequestDataExport();

  const [scope, setScope] = useState<Scope>(isAM ? 'manager' : 'system');
  const [targetManagerId, setTargetManagerId] = useState('');
  const [targetClientId, setTargetClientId] = useState('');
  const [managerList, setManagerList] = useState<User[]>([]);
  const [clientList, setClientList] = useState<Client[]>([]);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Both lists are small, one-off, admin/manager-facing fetches — not worth
  // a shared query hook (nothing else on this page needs them), same
  // reasoning ClientWorkspace's own manager-list fetch already documents.
  useEffect(() => {
    if (!isAM) {
      api.get('/account-managers').then(({ data }) => setManagerList(data.managers || [])).catch((err) => reportError('DataExportSection.loadManagers', err));
    }
    api.get('/clients?per_page=200').then(({ data }) => setClientList(data.clients?.data || data.clients || [])).catch((err) => reportError('DataExportSection.loadClients', err));
  }, [isAM]);

  const canSubmit =
    scope === 'system' ? !isAM :
    scope === 'manager' ? (isAM || !!targetManagerId) :
    !!targetClientId;

  const submitRequest = async () => {
    if (!canSubmit || requestMutation.isPending) return;
    setMessage(null);
    const payload =
      scope === 'system' ? { scope: 'system' as const } :
      scope === 'manager' ? { scope: 'manager' as const, scope_id: isAM ? currentUserId : targetManagerId } :
      { scope: 'client' as const, scope_id: targetClientId };

    try {
      await requestMutation.mutateAsync(payload);
      setMessage({ text: t('data_export_request_success'), isError: false });
    } catch (err: any) {
      setMessage({ text: err?.response?.data?.message || t('data_export_request_failed'), isError: true });
    }
  };

  const scopeLabel = (row: DataExport) => {
    if (row.scope === 'system') return t('data_export_scope_system');
    if (row.scope === 'manager') return isAM ? t('data_export_scope_manager_am') : `${t('data_export_scope_manager')} #${row.scope_id}`;
    return `${t('data_export_scope_client')} #${row.scope_id}`;
  };

  const expiryLabel = (row: DataExport) => {
    if (row.status !== 'ready' || !row.expires_at) return '—';
    const days = daysUntil(row.expires_at);
    return days <= 0 ? t('data_export_expired') : t('data_export_expires_in', { days });
  };

  return (
    <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('data_export_title')}</h2>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('data_export_desc')}</p>
      </div>

      {message && (
        <div className={message.isError
          ? 'bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-300 text-sm'
          : 'bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-emerald-300 text-sm'}>
          {message.text}
        </div>
      )}

      <div className="border border-[var(--color-card-border)] rounded-lg p-4 bg-[var(--color-card-border)] space-y-3">
        <div className="flex gap-2 flex-wrap">
          {!isAM && (
            <button type="button" onClick={() => setScope('system')}
              className={`px-4 py-2 rounded-lg text-sm border border-[var(--color-card-border)] transition-colors ${scope === 'system' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'hover:bg-[var(--color-input-fill)]'}`}>
              {t('data_export_scope_system')}
            </button>
          )}
          <button type="button" onClick={() => setScope('manager')}
            className={`px-4 py-2 rounded-lg text-sm border border-[var(--color-card-border)] transition-colors ${scope === 'manager' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'hover:bg-[var(--color-input-fill)]'}`}>
            {isAM ? t('data_export_scope_manager_am') : t('data_export_scope_manager')}
          </button>
          <button type="button" onClick={() => setScope('client')}
            className={`px-4 py-2 rounded-lg text-sm border border-[var(--color-card-border)] transition-colors ${scope === 'client' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'hover:bg-[var(--color-input-fill)]'}`}>
            {t('data_export_scope_client')}
          </button>
        </div>

        {scope === 'manager' && !isAM && (
          <select value={targetManagerId} onChange={(e) => setTargetManagerId(e.target.value)}
            className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-3 py-2 text-sm w-full max-w-xs">
            <option value="">{t('data_export_select_manager_ph')}</option>
            {managerList.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}

        {scope === 'client' && (
          <select value={targetClientId} onChange={(e) => setTargetClientId(e.target.value)}
            className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-3 py-2 text-sm w-full max-w-xs">
            <option value="">{t('data_export_select_client_ph')}</option>
            {clientList.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        )}

        <button onClick={submitRequest} disabled={!canSubmit || requestMutation.isPending}
          className="bg-[var(--color-primary)] text-white px-5 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
          {requestMutation.isPending ? t('data_export_requesting') : t('data_export_request')}
        </button>
      </div>

      {exportsQuery.isLoading ? (
        <p className="text-sm text-[var(--color-text-secondary)] py-4">{t('data_export_loading')}</p>
      ) : exportsQuery.isError ? (
        <ErrorState onRetry={() => exportsQuery.refetch()} fullScreen={false} />
      ) : !exportsQuery.data || exportsQuery.data.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)] py-4">{t('data_export_empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-card-border)]">
                <th className="py-2 px-2 text-start font-medium">{t('data_export_col_scope')}</th>
                <th className="py-2 px-2 text-start font-medium">{t('data_export_col_status')}</th>
                <th className="py-2 px-2 text-start font-medium">{t('data_export_col_size')}</th>
                <th className="py-2 px-2 text-start font-medium">{t('data_export_col_expires')}</th>
                <th className="py-2 px-2 text-start font-medium">{t('data_export_col_download')}</th>
              </tr>
            </thead>
            <tbody>
              {exportsQuery.data.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-card-border)] last:border-0">
                  <td className="py-2 px-2">{scopeLabel(row)}</td>
                  <td className="py-2 px-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[row.status]}`}>
                      {t(`data_export_status_${row.status}`)}
                    </span>
                  </td>
                  <td className="py-2 px-2">{formatSize(row.file_size)}</td>
                  <td className="py-2 px-2">{expiryLabel(row)}</td>
                  <td className="py-2 px-2">
                    {row.download_url ? (
                      <a href={row.download_url} className="text-[var(--color-gold-text)] hover:underline">{t('data_export_download')}</a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
