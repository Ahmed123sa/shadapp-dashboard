'use client';

import { useTranslations, useLocale } from 'next-intl';
import type { OnboardingStage as Stage } from '@/lib/client-onboarding';
import type { Client, Contract, Payment, Workspace } from '@/types';
import { StatusDot } from './ui';
import SignStage from './stages/SignStage';
import WaitingStage from './stages/WaitingStage';
import ReviewStage from './stages/ReviewStage';
import PaymentStage, { METHOD_KEYS } from './stages/PaymentStage';

interface Props {
  stage: Stage;
  client: Client;
  workspace: Workspace | null | undefined;
  /** Refetch client + workspace after anything that can change the stage. */
  onChanged: () => void;
}

/** Picks the card for the current onboarding stage (mockup screens 0-6). */
export default function OnboardingStage({ stage, client, workspace, onChanged }: Props) {
  const t = useTranslations('client_portal');
  const locale = useLocale();
  const manager = workspace?.manager ?? client.workspace?.manager ?? null;
  const wsId = workspace?.id;

  switch (stage) {
    case 0:
      return <SignStage client={client} onSigned={onChanged} />;
    case 1:
      return (
        <WaitingStage
          stepNo={2}
          title={t('wait_contract_title')}
          description={manager?.name ? t('wait_contract_desc', { manager: manager.name }) : t('wait_contract_desc_nomgr')}
        />
      );
    case 2:
      return wsId ? <ReviewStage wsId={wsId} clientType={client.client_type} onChanged={onChanged} /> : null;
    case 3:
      return <WaitingStage stepNo={4} title={t('wait_company_title')} description={t('wait_company_desc')} />;
    case 4:
      return wsId ? <PaymentStage wsId={wsId} onChanged={onChanged} /> : null;
    case 5: {
      const sent: Payment | undefined = [...(workspace?.payments ?? [])]
        .reverse()
        .find((p) => p.status === 'pending' || p.status === 'approved');
      const nf = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 });
      const cur = sent?.currency || 'SAR';
      const method = sent && (METHOD_KEYS as readonly string[]).includes(sent.method_type) ? t(`method_${sent.method_type}`) : sent?.method_type;
      return (
        <WaitingStage
          stepNo={6}
          title={t('review_pay_title')}
          description={t('review_pay_desc', { amount: nf.format(Number(sent?.amount ?? 0)), currency: cur })}
        >
          {sent && (
            <div className="doc" style={{ marginTop: 18, borderTop: '1px solid var(--line)' }}>
              <span className="nm">{t('pay_sent')}{method ? ` · ${method}` : ''}</span>
              <span className="st">
                <StatusDot tone={sent.status === 'approved' ? 'ok' : 'wait'} />
                {sent.status === 'approved' ? t('pay_approved') : t('pay_under_review')}
              </span>
              <div className="end">
                <b style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 18 }}>
                  {nf.format(Number(sent.amount))} <small style={{ fontSize: 11, color: 'var(--muted)' }}>{cur}</small>
                </b>
              </div>
            </div>
          )}
        </WaitingStage>
      );
    }
    case 6: {
      const edit: Contract | undefined = workspace?.contracts?.find((c) => c.status === 'edit_requested');
      return (
        <WaitingStage stepNo={3} title={t('edit_title')} description={t('edit_desc')} wide>
          {edit?.edit_reason && (
            <div className="docs" style={{ marginTop: 0 }}>
              <div className="h">{t('your_request')}</div>
              <div className="quote">{edit.edit_reason}</div>
            </div>
          )}
        </WaitingStage>
      );
    }
    default:
      return null;
  }
}
