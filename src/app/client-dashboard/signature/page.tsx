'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import ClientSignature from '@/components/client-signature/ClientSignature';
import ClientShell from '@/components/client-portal/ClientShell';
import { useClientPortalPage } from '@/hooks/useClientPortalPage';

/** The owner's e-signature (draw / type / upload). Owner only. */
export default function ClientSignaturePage() {
  const t = useTranslations('client_portal');
  const td = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const { ready, session, client, wsCount } = useClientPortalPage({ ownerOnly: true });

  if (!ready || !session || !client) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSkeleton message={td('client_loading_data')} /></div>;
  }

  return (
    <ClientShell company={session.company_name} userName={client.contact_person ?? session.company_name} active="sig" wsCount={wsCount}>
      <div className="page">
        <div className="ph2">
          <div>
            <div className="eyebrow">{t('grp_account')}</div>
            <h1 className="serifx">{t('sig_page_title')}<i>.</i></h1>
            <p>{t('sig_page_desc')}</p>
          </div>
        </div>
        <div className="fsec2">
          <div>
            <h3>{t('sig_saved_h')}</h3>
            <p>{t('sig_page_desc')}</p>
          </div>
          <div>
            <ClientSignature clientId={client.id} clientData={client} onSigned={() => queryClient.invalidateQueries({ queryKey: ['clients'] })} />
          </div>
        </div>
      </div>
    </ClientShell>
  );
}
