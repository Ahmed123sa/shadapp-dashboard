'use client';

import { useTranslations } from 'next-intl';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import ClientSubUsers from '@/components/client-subusers/ClientSubUsers';
import ClientShell from '@/components/client-portal/ClientShell';
import { useClientPortalPage } from '@/hooks/useClientPortalPage';

/** "My team" — the owner's assistants (sub-users). Owner only. */
export default function ClientTeamPage() {
  const t = useTranslations('client_portal');
  const td = useTranslations('dashboard');
  const { ready, session, client, wsCount } = useClientPortalPage({ ownerOnly: true });

  if (!ready || !session || !client) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSkeleton message={td('client_loading_data')} /></div>;
  }

  return (
    <ClientShell company={session.company_name} userName={client.contact_person ?? session.company_name} active="team" wsCount={wsCount}>
      <div className="page">
        <div className="ph2">
          <div>
            <div className="eyebrow">{t('grp_account')}</div>
            <h1 className="serifx">{t('team_title')}<i>.</i></h1>
            <p>{t('team_desc', { company: client.company_name })}</p>
          </div>
        </div>
        {/* The list/form keep their previous markup until ع٥ restyles them. */}
        <ClientSubUsers clientId={client.id} />
      </div>
    </ClientShell>
  );
}
