'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isClientAuthenticated, getClient, clientLogout, isSubUser, hasSubUserPermission, getSubUser } from '@/lib/client-auth';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import ClientContracts from '@/components/client-contracts/ClientContracts';
import ClientPayments from '@/components/client-payments/ClientPayments';
import ClientApprovals from '@/components/client-approvals/ClientApprovals';
import ClientChat from '@/components/client-chat/ClientChat';
import ClientFiles from '@/components/client-files/ClientFiles';
import ClientMeetings from '@/components/client-meetings/ClientMeetings';
import ClientSignature from '@/components/client-signature/ClientSignature';
import ClientSubUsers from '@/components/client-subusers/ClientSubUsers';
import StagesStepper from '@/components/client-dashboard/StagesStepper';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useClient } from '@/hooks/queries/useClients';
import { useWorkspace } from '@/hooks/queries/useWorkspace';
import { useWorkspaceRealtime } from '@/hooks/queries/useWorkspaceRealtime';
import type { Client } from '@/types';

const ALL_TABS = [
  { key: 'العقود', perm: 'can_view_contracts' },
  { key: 'المدفوعات', perm: 'can_view_payments' },
  { key: 'الموافقات', perm: 'can_view_approvals' },
  { key: 'الشات', perm: 'can_chat' },
  { key: 'الملفات', perm: 'can_view_files' },
  { key: 'الاجتماعات', perm: 'can_view_meetings' },
  { key: 'التوقيع', perm: null },
  { key: 'المستخدمين', perm: null },
] as const;

type Tab = (typeof ALL_TABS)[number]['key'];

export default function ClientDashboardPage() {
  const t = useTranslations('dashboard');
  const TAB_LABELS: Record<string, string> = {
    'العقود': t('tab_contracts'),
    'المدفوعات': t('tab_payments'),
    'الموافقات': t('tab_approvals'),
    'الشات': t('tab_chat'),
    'الملفات': t('tab_files'),
    'الاجتماعات': t('tab_meetings'),
    'التوقيع': t('tab_signature'),
    'المستخدمين': t('tab_users'),
  };
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('العقود');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const match = ALL_TABS.find((item) => item.key === tabParam || TAB_LABELS[item.key] === tabParam || TAB_LABELS[item.key]?.toLowerCase() === tabParam.toLowerCase());
      if (match) {
        setActiveTab(match.key as Tab);
      }
    }
  }, [searchParams, TAB_LABELS]);
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
  const { data: workspace } = useWorkspace(clientWorkspaceId);
  useWorkspaceRealtime(clientWorkspaceId);

  if (!mounted) return <div className="min-h-screen flex items-center justify-center text-[var(--color-text-secondary)]">{t('client_loading')}</div>;
  if (clientLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSkeleton message={t('client_loading_data')} /></div>;
  if (!session || !client) return null;

  const hasSigned = !!client.signed_at;
  const wsId = workspace?.id;
  const wsActive = workspace?.status === 'active';
  const workspaceExists = !!wsId;

  if (!hasSigned) {
    return (
      <div className="min-h-screen bg-[var(--color-background)]">
        <header className="bg-[var(--color-card)] border-b border-[var(--color-card-border)] px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">ShadApp</h1>
          <div className="flex items-center gap-3">
            <button onClick={clientLogout} className="text-xs bg-[var(--color-input-fill)] hover:bg-[var(--color-card-border)] px-3 py-1.5 rounded-lg">{t('client_logout')}</button>
          </div>
        </header>
        <main className="max-w-2xl mx-auto p-6 space-y-6">
          <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-card-border)] p-8 text-center">
            <div className="text-5xl mb-4">👋</div>
            <h2 className="text-2xl font-bold mb-2">{t('client_welcome_title')}</h2>
            <p className="text-[var(--color-text-secondary)] mb-6">{t('client_welcome_desc')}</p>

            <div className="space-y-3 text-right max-w-md mx-auto">
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <span className="text-emerald-400 text-lg">✅</span>
                <span className="text-sm text-emerald-300 font-medium">{t('client_account_created')}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <span className="text-amber-400 text-lg">📝</span>
                <span className="text-sm text-amber-300 font-medium">{t('client_sign_required')}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[var(--color-card-border)] rounded-lg text-[var(--color-text-disabled)]">
                <span className="text-lg">⏳</span>
                <span className="text-sm">{t('client_waiting_workspace')}</span>
              </div>
            </div>
          </div>

          <ClientSignature clientId={session.id} clientData={client} onSigned={() => refetchClient()} />
        </main>
      </div>
    );
  }

  if (!workspaceExists) {
    return (
      <div className="min-h-screen bg-[var(--color-background)]">
        <header className="bg-[var(--color-card)] border-b border-[var(--color-card-border)] px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">ShadApp</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-text-secondary)]">{session.company_name}</span>
            <button onClick={clientLogout} className="text-xs bg-[var(--color-input-fill)] hover:bg-[var(--color-card-border)] px-3 py-1.5 rounded-lg">{t('client_logout')}</button>
          </div>
        </header>
        <main className="max-w-2xl mx-auto p-6 space-y-6">
          <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-card-border)] p-8 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold mb-2">{t('client_signature_saved')}</h2>
            <div className="space-y-3 text-right max-w-md mx-auto mt-6">
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <span className="text-emerald-400 text-lg">✅</span>
                <span className="text-sm text-emerald-300 font-medium">{t('client_e_signature')}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <span className="text-blue-400 text-lg">⏳</span>
                <span className="text-sm text-blue-300 font-medium">{t('client_waiting_workspace_creation')}</span>
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-disabled)] mt-6">{t('client_notifications_incoming')}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <header className="bg-[var(--color-card)] border-b border-[var(--color-card-border)] px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">ShadApp</h1>
          <div className="flex items-center gap-3">
            {isSubUser() ? (
              <span className="text-sm text-[var(--color-gold-text)]">👤 {getSubUser()?.name}</span>
            ) : (
              <span className="text-sm text-[var(--color-text-secondary)]">{session.company_name}</span>
            )}
            <Link href="/client-dashboard/settings" className="text-xs bg-[var(--color-input-fill)] hover:bg-[var(--color-card-border)] px-3 py-1.5 rounded-lg transition-colors" aria-label={t('settings_title')}>⚙️</Link>
            <button onClick={clientLogout} className="text-xs bg-[var(--color-input-fill)] hover:bg-[var(--color-card-border)] px-3 py-1.5 rounded-lg">
              {t('client_logout')}
            </button>
          </div>
        </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <StagesStepper client={client} workspace={workspace} onStageClick={(tab) => setActiveTab(tab as Tab)} />

        {workspace?.payments?.some((p) => p.status === 'approved') && !wsActive && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
            <p className="text-emerald-300 font-medium">✅ {t('client_payment_accepted')}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{workspace?.contracts?.length || 0}</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('client_contracts_count')}</p>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{workspace?.payments?.length || 0}</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('client_payments_count')}</p>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{workspace?.approvals?.length || 0}</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('client_approvals_count')}</p>
          </div>
          <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-4 text-center">
            <p className={`text-2xl font-bold ${wsActive ? 'text-emerald-600' : 'text-[var(--color-text-disabled)]'}`}>
              {wsActive ? '🟢' : '⏳'}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('client_workspace_status')}</p>
          </div>
        </div>

        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
          <div className="flex border-b border-[var(--color-card-border)] overflow-x-auto">
            {ALL_TABS.filter((t) => t.perm === null || hasSubUserPermission(t.perm)).map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-5 py-3 text-sm whitespace-nowrap border-b-2 transition ${activeTab === t.key ? 'border-[var(--color-primary)] text-[var(--color-foreground)] font-medium' : 'border-transparent text-[var(--color-text-disabled)] hover:text-[var(--color-foreground)]'}`}>
                {TAB_LABELS[t.key] || t.key}
              </button>
            ))}
          </div>
          <div className="p-5">
                <TabContent tab={activeTab} wsId={wsId} clientId={session.id} clientData={client} wsActive={wsActive} onGoToPayments={() => setActiveTab('المدفوعات')} />
          </div>
        </div>
      </main>
    </div>
  );
}

function TabContent({ tab, wsId, clientId, clientData, wsActive, onGoToPayments }: { tab: Tab; wsId: number; clientId: number; clientData: Client; wsActive?: boolean; onGoToPayments?: () => void }) {
  switch (tab) {
    case 'العقود': return <ClientContracts wsId={wsId} clientType={clientData?.client_type} onGoToPayments={onGoToPayments} />;
    case 'المدفوعات': return <ClientPayments wsId={wsId} />;
    case 'الموافقات': return <ClientApprovals wsId={wsId} clientId={clientId} />;
    case 'الشات': return <ClientChat wsId={wsId} wsActive={wsActive} />;
    case 'الملفات': return <ClientFiles wsId={wsId} />;
    case 'الاجتماعات': return <ClientMeetings wsId={wsId} />;
    case 'التوقيع': return <ClientSignature clientId={clientId} clientData={clientData} onSigned={() => {}} />;
    case 'المستخدمين': return <ClientSubUsers clientId={clientId} />;
  }
}
