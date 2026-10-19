'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { Client, Workspace } from '@/types';
import { Avatar, StatusDot } from './ui';

/** "Your workspace" heading: company, meta line, status line and the account manager. */
export default function WorkspaceHeader({ client, workspace }: { client: Client; workspace: Workspace }) {
  const t = useTranslations('client_portal');
  const locale = useLocale();
  const managerName = workspace.manager?.name ?? client.workspace?.manager?.name ?? null;
  const contractInForce = (workspace.contracts ?? []).some((c) => c.status === 'company_approved' || c.status === 'completed');
  const sinceRaw = workspace.activated_at ?? client.created_at;
  const since = sinceRaw
    ? new Date(sinceRaw).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' })
    : null;

  const meta = [
    client.client_type === 'business' ? t('type_business') : t('type_individual'),
    client.country || null,
    managerName ? t('meta_mgr', { name: managerName }) : null,
  ].filter(Boolean) as string[];

  return (
    <div className="dossier">
      <div>
        <div className="eyebrow">{t('ws_eyebrow')}</div>
        <h1 className="cname">{client.company_name}<i>.</i></h1>
        <div className="meta">
          {meta.map((m, i) => (
            <span key={m} style={{ display: 'contents' }}>
              {i > 0 && <span className="sep">/</span>}
              <span>{m}</span>
            </span>
          ))}
        </div>
        <div className="state">
          <span><StatusDot tone="ok" />{t('ws_active')}</span>
          {contractInForce && <span><StatusDot tone="ok" />{t('ws_contract')}</span>}
          {since && <span style={{ color: 'var(--faint)' }}>{t('ws_since', { date: since })}</span>}
        </div>
      </div>
      {managerName && (
        <div className="side">
          <div className="owner">
            <Avatar name={managerName} />
            <div>
              <span>{t('mgr_role')}</span>
              <b>{managerName}</b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
