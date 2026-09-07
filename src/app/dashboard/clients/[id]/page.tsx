'use client';

import { useEffect, useRef, useState } from 'react';
import { getUser } from '@/lib/auth';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Settings, Trash2, CheckCircle2 } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
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
import { reportError } from '@/lib/error-reporting';
import { resolveFileUrl } from '@/lib/utils';
import { useClient, useDeleteClient } from '@/hooks/queries/useClients';
import type { Client } from '@/types';

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
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({} as Record<Tab, HTMLButtonElement | null>);

  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  const clientQuery = useClient(id as string);
  const client = clientQuery.data ?? null;
  const deleteMutation = useDeleteClient();

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

  const deleteClient = async () => {
    try {
      await deleteMutation.mutateAsync(Number(id));
      window.location.href = '/dashboard/clients';
    } catch (err) {
      reportError('ClientWorkspace.deleteClient', err);
      setDeleteConfirm(false);
      setDeleteError(t('delete_client_failed'));
    }
  };

  if (clientQuery.isLoading) return <div className="py-20"><LoadingSkeleton message={t('loading_workspace')} /></div>;
  if (!client) return <EmptyState message={t('not_found')} />;

  const isSA = getUser()?.role === 'super_admin';
  const wsId = client.workspace?.id;

  return (
    <div className="space-y-6">
      {deleteError && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-300 text-sm">{deleteError}</div>}

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
            {!isSA && <button onClick={() => { setDeleteError(''); setDeleteConfirm(true); }} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-red-900/30 transition-colors text-[var(--color-text-secondary)] hover:text-red-400" title={t('delete')} aria-label={t('delete')}><Trash2 size={16} strokeWidth={1.5} /></button>}
            <StatusBadge status={client.workspace?.status === 'active' ? 'active' : 'inactive'} />
            <span className={`px-2.5 py-1 rounded-full text-xs ${client.signed_at ? 'bg-purple-900/30 text-purple-400' : 'bg-[var(--color-input-fill)] text-[var(--color-text-secondary)]'}`}>
              {client.signed_at ? <><CheckCircle2 size={14} strokeWidth={1.5} className="inline text-purple-400" /> {t('signed')}</> : t('not_signed')}
            </span>
          </div>
        </div>
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

      <ConfirmDialog
        open={deleteConfirm}
        title={t('delete_title')}
        message={t('delete_message')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={deleteClient}
        onCancel={() => setDeleteConfirm(false)}
      />
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
