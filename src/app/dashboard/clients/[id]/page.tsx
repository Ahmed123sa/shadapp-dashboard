'use client';

import { useEffect, useRef, useState } from 'react';
import { getUser } from '@/lib/auth';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Settings, CheckCircle2 } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ClientTypeBadge } from '@/components/ui/ClientTypeBadge';
import ChatTab from '@/components/chat/ChatTab';
import FilesTab from '@/components/files/FilesTab';
import ContractsTab from '@/components/contracts/ContractsTab';
import PaymentsTab from '@/components/payments/PaymentsTab';
import ApprovalsTab from '@/components/approvals/ApprovalsTab';
import MeetingsTab from '@/components/meetings/MeetingsTab';
import CalendarTab from '@/components/calendar/CalendarTab';
import NoWorkspace from '@/components/workspace/NoWorkspace';
import ClientProfileTab from '@/components/clients/ClientProfileTab';
import { resolveFileUrl, clientHasSignedContract } from '@/lib/utils';
import { useArchiveClient, useClient, useTransferClient, useUnarchiveClient } from '@/hooks/queries/useClients';
import api from '@/lib/api';
import { reportError } from '@/lib/error-reporting';
import type { Client, User } from '@/types';

const TABS = ['profile', 'chat', 'files', 'contracts', 'payments', 'approvals', 'meetings', 'calendar'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  profile: 'tab_client_profile',
  chat: 'tab_chat',
  files: 'tab_files',
  contracts: 'tab_contracts',
  payments: 'tab_payments',
  approvals: 'tab_approvals',
  meetings: 'tab_meetings',
  calendar: 'tab_calendar',
};

export default function ClientWorkspace() {
  const t = useTranslations('dashboard');
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const match = TABS.find((k) => k === tabParam || t(TAB_LABELS[k]) === tabParam || t(TAB_LABELS[k])?.toLowerCase() === tabParam.toLowerCase());
      if (match) {
        setActiveTab(match);
      }
    }
  }, [searchParams, t]);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({} as Record<Tab, HTMLButtonElement | null>);

  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  const clientQuery = useClient(id as string);
  const client = clientQuery.data ?? null;
  const archiveMutation = useArchiveClient();
  const unarchiveMutation = useUnarchiveClient();
  const [archiveError, setArchiveError] = useState('');

  // Transfer — reassigns the client to a different account manager,
  // super-admin only (ClientPolicy::transfer). The manager list is fetched
  // once up front (gated on role, same as reports/page.tsx's own
  // account-managers fetch) rather than via a query hook, since nothing
  // else on this page needs it and no shared hook for it exists yet.
  const transferMutation = useTransferClient();
  const [managerList, setManagerList] = useState<User[]>([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferManagerId, setTransferManagerId] = useState('');
  const [transferError, setTransferError] = useState('');

  useEffect(() => {
    if (getUser()?.role === 'super_admin') {
      api.get('/account-managers').then(({ data }) => setManagerList(data.managers || [])).catch((err) => reportError('ClientWorkspace.loadManagers', err));
    }
  }, []);

  // The URL should show the client's uuid, not the numeric id — a
  // sequential integer in the address bar lets anyone glance at it and guess
  // how many clients exist or which id maps to which company. Plenty of
  // existing links (notifications, the SA/AM dashboard views, older
  // bookmarks) still point at the numeric id; rather than updating every one
  // of those call sites, the backend accepts both (Client::resolveRouteBinding)
  // and this redirect corrects the visible URL the moment the client loads,
  // no matter which id form was used to get here.
  useEffect(() => {
    if (client?.uuid && id !== client.uuid) {
      const qs = searchParams.toString();
      router.replace(`/dashboard/clients/${client.uuid}${qs ? `?${qs}` : ''}`);
    }
  }, [client?.uuid, id, searchParams, router]);

  if (clientQuery.isLoading) return <div className="py-20"><LoadingSkeleton message={t('loading_workspace')} /></div>;
  if (!client) return <EmptyState message={t('not_found')} />;

  const isSA = getUser()?.role === 'super_admin';
  const wsId = client.workspace?.id;
  const isArchived = client.status === 'archived';

  // Archive/unarchive — the client-delete replacement, see
  // DATA_SAFETY_PLAN.md §2.3. Mirrors ClientsPage's archiveClient/
  // unarchiveClient; refetching happens automatically via the mutations'
  // broad ['clients'] cache invalidation, same as this page's own
  // useClient(id) query.
  const archiveClient = async () => {
    if (!confirm(t('client_archive_confirm'))) return;
    setArchiveError('');
    try {
      await archiveMutation.mutateAsync(client.id);
    } catch (err: any) {
      setArchiveError(err?.response?.data?.message || t('client_archive_failed'));
    }
  };

  const unarchiveClient = async () => {
    if (!confirm(t('client_unarchive_confirm'))) return;
    setArchiveError('');
    try {
      await unarchiveMutation.mutateAsync(client.id);
    } catch (err: any) {
      setArchiveError(err?.response?.data?.message || t('client_unarchive_failed'));
    }
  };

  const openTransfer = () => {
    setTransferError('');
    setTransferManagerId('');
    setShowTransfer(true);
  };

  const submitTransfer = async () => {
    if (!transferManagerId) return;
    if (!confirm(t('client_transfer_confirm'))) return;
    setTransferError('');
    try {
      await transferMutation.mutateAsync({ id: client.id, newManagerId: transferManagerId });
      setShowTransfer(false);
    } catch (err: any) {
      setTransferError(err?.response?.data?.message || t('client_transfer_failed'));
    }
  };

  return (
    <div className="space-y-6">
      {archiveError && (
        <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg">{archiveError}</div>
      )}
      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-5 border-e-2 border-e-[var(--color-primary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-input-fill)] overflow-hidden border-2 border-[var(--color-card-border)] flex-shrink-0">
              {client.avatar_url ? (
                <img src={resolveFileUrl(client.avatar_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg text-[var(--color-text-disabled)]">
                  {client.company_name?.[0] || '?'}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{client.company_name}</h2>
                <ClientTypeBadge clientType={client.client_type} />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">{client.contact_person} • {client.email}{client.country ? ` • ${client.country}` : ''}{client.industry ? ` • ${client.industry}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isSA && <Link href={`/dashboard/clients/${client.uuid ?? id}/settings`} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--color-card-border)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)]" title={t('settings_title')} aria-label={t('settings_title')}><Settings size={16} strokeWidth={1.5} /></Link>}
            {isArchived && <StatusBadge status="archived" />}
            <StatusBadge status={client.workspace?.status === 'active' ? 'active' : 'inactive'} />
            {/* has_signed_contract, not signed_at — see client-signature-plan.md
                ن1. signed_at only records a saved profile signature, which is
                a different thing from having approved a contract; a paid,
                active client used to show as "not signed" here. */}
            <span className={`px-2.5 py-1 rounded-full text-xs ${clientHasSignedContract(client) ? 'bg-purple-900/30 text-purple-400' : 'bg-[var(--color-input-fill)] text-[var(--color-text-secondary)]'}`}>
              {clientHasSignedContract(client) ? <><CheckCircle2 size={14} strokeWidth={1.5} className="inline text-purple-400" /> {t('contracted')}</> : t('not_contracted')}
            </span>
            {isArchived ? (
              <button
                onClick={unarchiveClient}
                disabled={unarchiveMutation.isPending}
                className="text-xs text-green-400 hover:underline border border-green-900/30 rounded px-2 py-1 disabled:opacity-50"
              >
                {t('client_unarchive')}
              </button>
            ) : (
              <button
                onClick={archiveClient}
                disabled={archiveMutation.isPending}
                className="text-xs text-red-400 hover:underline border border-red-900/30 rounded px-2 py-1 disabled:opacity-50"
              >
                {t('client_archive')}
              </button>
            )}
            {isSA && (
              <button
                onClick={openTransfer}
                className="text-xs text-[var(--color-gold-text)] hover:underline border border-[var(--color-card-border)] rounded px-2 py-1"
              >
                {t('client_transfer')}
              </button>
            )}
          </div>
        </div>

        {showTransfer && (
          <div className="mt-4 pt-4 border-t border-[var(--color-card-border)] space-y-3">
            {transferError && <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg">{transferError}</div>}
            <label htmlFor="transfer-manager" className="block text-xs font-medium text-[var(--color-text-secondary)]">{t('client_transfer_to')}</label>
            <div className="flex items-center gap-2">
              <select
                id="transfer-manager"
                value={transferManagerId}
                onChange={(e) => setTransferManagerId(e.target.value)}
                className="flex-1 bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-foreground)]"
              >
                <option value="">{t('client_transfer_select_placeholder')}</option>
                {managerList.filter((m) => m.id !== client.manager_id).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <button
                onClick={submitTransfer}
                disabled={!transferManagerId || transferMutation.isPending}
                className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
              >
                {t('client_transfer')}
              </button>
              <button onClick={() => setShowTransfer(false)} className="bg-[var(--color-input-fill)] px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-card-border)]">{t('cancel')}</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
        <div className="flex border-b border-[var(--color-card-border)] overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab} ref={(el) => { tabRefs.current[tab] = el; }} onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm whitespace-nowrap border-b-2 transition ${activeTab === tab ? 'border-[var(--color-primary)] text-[var(--color-foreground)] font-medium' : 'border-transparent text-[var(--color-text-disabled)] hover:text-[var(--color-foreground)]'}`}>
              {t(TAB_LABELS[tab])}
            </button>
          ))}
        </div>
        <div className="p-5">
          {wsId ? <TabContent tab={activeTab} wsId={wsId} client={client} onClientRefresh={() => clientQuery.refetch()} onNavigate={(tab) => setActiveTab(tab)} /> :
            <NoWorkspace client={client} />}
        </div>
      </div>
    </div>
  );
}

function TabContent({ tab, wsId, client, onClientRefresh, onNavigate }: { tab: Tab; wsId: number; client: Client; onClientRefresh?: () => void; onNavigate?: (tab: Tab) => void }) {
  const wsActive = client.workspace?.status === 'active';
  switch (tab) {
    case 'profile': return <ClientProfileTab clientId={client.id} onNavigate={(t) => onNavigate?.(t as Tab)} />;
    case 'chat': return <ChatTab wsId={wsId} wsActive={wsActive} clientType={client.client_type} />;
    case 'files': return <FilesTab wsId={wsId} />;
    case 'contracts': return <ContractsTab wsId={wsId} clientType={client.client_type} wsActive={wsActive} />;
    case 'payments': return <PaymentsTab wsId={wsId} client={client} onWorkspaceUpdate={onClientRefresh} />;
    case 'approvals': return <ApprovalsTab wsId={wsId} />;
    case 'meetings': return <MeetingsTab wsId={wsId} />;
    case 'calendar': return <CalendarTab wsId={wsId} />;
  }
}
