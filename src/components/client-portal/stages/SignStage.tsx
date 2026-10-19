'use client';

import { useTranslations } from 'next-intl';
import ClientSignature from '@/components/client-signature/ClientSignature';
import type { Client } from '@/types';

/** Stage 0 — the account owner adds the company's e-signature (once). */
export default function SignStage({ client, onSigned }: { client: Client; onSigned: () => void }) {
  const t = useTranslations('client_portal');
  return (
    <>
      <div className="k">{t('step_of', { a: 1, b: 6 })}</div>
      <h2 className="serifx">{t('sign_title')}</h2>
      <p className="lead">{t('sign_desc')}</p>
      <ClientSignature clientId={client.id} clientData={client} onSigned={onSigned} />
    </>
  );
}
