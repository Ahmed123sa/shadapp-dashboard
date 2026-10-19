'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isClientAuthenticated, getClient, isSubUser, hasSubUserPermission, getSubUser, syncSubUserPermissions } from '@/lib/client-auth';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import ClientContracts from '@/components/client-contracts/ClientContracts';
import ClientPayments from '@/components/client-payments/ClientPayments';
import ClientApprovals from '@/components/client-approvals/ClientApprovals';
import ClientChat from '@/components/client-chat/ClientChat';
import ClientFiles from '@/components/client-files/ClientFiles';
import ClientMeetings from '@/components/client-meetings/ClientMeetings';
import OnboardingShell from '@/components/client-portal/OnboardingShell';
import OnboardingStage from '@/components/client-portal/OnboardingStage';
import WaitingStage from '@/components/client-portal/stages/WaitingStage';
import { resolveOnboardingStage, stageToStep } from '@/lib/client-onboarding';
import ClientShell from '@/components/client-portal/ClientShell';
import WorkspaceHeader from '@/components/client-portal/WorkspaceHeader';
import WorkspaceTabs from '@/components/client-portal/WorkspaceTabs';
import { visibleClientTabs, resolveTabParam, type ClientTabKey } from '@/lib/client-tabs';
import { useBadgeCounts } from '@/hooks/queries/useBadgeCounts';
import { useTranslations } from 'next-intl';
import { useClient } from '@/hooks/queries/useClients';
import { useWorkspace } from '@/hooks/queries/useWorkspace';
import { useWorkspaceRealtime } from '@/hooks/queries/useWorkspaceRealtime';
import { useSubUserPermissions } from '@/hooks/queries/useSubUsers';
import type { Client } from '@/types';

export default function ClientDashboardPage() {
  const t = useTranslations('dashboard');
  const tp = useTranslations('client_portal');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientTabKey>('contracts');

  // `?tab=` accepts the slug, the old Arabic key, or a localized label
  // (NotificationBell links carry the label).
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const labels = Object.fromEntries(
      (['contracts', 'payments', 'chat', 'approvals', 'files', 'meetings'] as const).map((k) => [k, [t(`tab_${k}`), tp(`tab_${k}`)]]),
    );
    const match = resolveTabParam(tabParam, labels);
    if (match) setActiveTab(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selectTab = (key: ClientTabKey) => {
    setActiveTab(key);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `/client-dashboard?tab=${key}`);
  };
  const session = getClient();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && !isClientAuthenticated()) {
      router.push('/client-login');
    }
  }, [router]);

  // REALTIME_PLAN.md Stage 3 — migrated off manual useState/useEffect/
  // api.get() onto TanStack Query. `enabled: !!session?.id` reproduces the
  // old effect's own `if (!session?.id) return;` guard: no session yet ⇒ no
  // request. `clientLoading` folds "no session yet" into "still loading" so
  // this keeps showing the loading skeleton (not a blank `null`) during the
  // brief window before the redirect effect above fires — matching the old
  // `loading` state, which likewise never flipped to `false` in that case.
  const { data: client, isLoading: clientQueryLoading, refetch: refetchClient } = useClient(session?.id ?? '', { enabled: !!session?.id });
  const clientLoading = !session?.id || clientQueryLoading;
  const clientWorkspaceId = client?.workspace?.id;
  const { data: workspace, isLoading: workspaceLoading, refetch: refetchWorkspace } = useWorkspace(clientWorkspaceId);
  useWorkspaceRealtime(clientWorkspaceId);
  const { data: badgeCounts } = useBadgeCounts(true);

  // SUBUSER_PLAN.md §5.3 — refetches this sub-user's permissions from the
  // server on every load instead of trusting whatever was cached in
  // localStorage at login, then writes the result back so getSubUser()
  // elsewhere on the page also sees it. `data` is undefined until this
  // resolves, so hasFreshSubUserPermission() below falls back to the
  // (possibly stale) cached value only for that first render.
  const subUserId = getSubUser()?.id;
  const { data: freshSubUserPermissions } = useSubUserPermissions(subUserId, { enabled: isSubUser() });
  useEffect(() => {
    if (freshSubUserPermissions) {
      syncSubUserPermissions(freshSubUserPermissions);
    }
  }, [freshSubUserPermissions]);
  const hasFreshSubUserPermission = (key: string): boolean => {
    if (!isSubUser()) return true;
    if (freshSubUserPermissions) return freshSubUserPermissions[key] === true;
    return hasSubUserPermission(key);
  };

  if (!mounted) return <div className="min-h-screen flex items-center justify-center text-[var(--color-text-secondary)]">{t('client_loading')}</div>;
  if (clientLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSkeleton message={t('client_loading_data')} /></div>;
  if (!session || !client) return null;

  const wsActive = workspace?.status === 'active';

  // The workspace opens only once it is active; until then the client walks
  // through onboarding (same stage rule as the mobile app) and an assistant
  // just waits. Hold the loading state while the workspace is still being
  // fetched so an active client never flashes the onboarding screens.
  if (!wsActive) {
    if (clientWorkspaceId && workspaceLoading) {
      return <div className="min-h-screen flex items-center justify-center"><LoadingSkeleton message={t('client_loading_data')} /></div>;
    }
    const manager = workspace?.manager ?? client.workspace?.manager ?? null;
    if (isSubUser()) {
      return (
        <OnboardingShell company={session.company_name} userName={getSubUser()?.name ?? ''} step={0} assistant>
          <WaitingStage title={tp('asst_title')} description={tp('asst_desc')} />
        </OnboardingShell>
      );
    }
    const stage = resolveOnboardingStage(client, workspace);
    const onChanged = () => { refetchClient(); refetchWorkspace?.(); };
    return (
      <OnboardingShell company={session.company_name} userName={client.contact_person ?? session.company_name} step={stageToStep(stage)} manager={manager}>
        <OnboardingStage stage={stage} client={client} workspace={workspace} onChanged={onChanged} />
      </OnboardingShell>
    );
  }

  if (!workspace) return null;
  const wsId = workspace.id;

  const tabs = visibleClientTabs(hasFreshSubUserPermission);
  const current = tabs.find((x) => x.key === activeTab) ?? tabs[0];
  const wsCount = tabs.reduce((sum, x) => sum + (x.badge ? badgeCounts?.[x.badge] ?? 0 : 0), 0);

  return (
    <ClientShell
      company={session.company_name}
      userName={isSubUser() ? (getSubUser()?.name ?? '') : (client.contact_person ?? session.company_name)}
      active="ws"
      wsCount={wsCount}
    >
      <div className="scroll">
        <WorkspaceHeader client={client} workspace={workspace} />
        <WorkspaceTabs tabs={tabs} active={current?.key ?? activeTab} counts={badgeCounts} onSelect={selectTab} />
        <div className="panel">
          {/* Tab bodies still carry their previous markup; they are restyled one by one (ع٤). */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 0 40px' }}>
            {current && (
              <TabContent tab={current.key} wsId={wsId} clientId={session.id} clientData={client} wsActive={wsActive} onGoToPayments={() => selectTab('payments')} />
            )}
          </div>
        </div>
      </div>
    </ClientShell>
  );
}

function TabContent({ tab, wsId, clientId, clientData, wsActive, onGoToPayments }: { tab: ClientTabKey; wsId: number; clientId: number; clientData: Client; wsActive?: boolean; onGoToPayments?: () => void }) {
  switch (tab) {
    case 'contracts': return <ClientContracts wsId={wsId} clientType={clientData?.client_type} onGoToPayments={onGoToPayments} />;
    case 'payments': return <ClientPayments wsId={wsId} />;
    case 'approvals': return <ClientApprovals wsId={wsId} clientId={clientId} />;
    case 'chat': return <ClientChat wsId={wsId} wsActive={wsActive} />;
    case 'files': return <ClientFiles wsId={wsId} />;
    case 'meetings': return <ClientMeetings wsId={wsId} />;
  }
}
