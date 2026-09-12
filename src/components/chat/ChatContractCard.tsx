'use client';

import { useTranslations } from 'next-intl';
import type { Contract } from '@/types';

export default function ChatContractCard({ contract, clientType, onAction }: { contract: Contract; clientType?: string; onAction?: (id: number, action: string) => void }) {
  const t = useTranslations('dashboard');
  const statusBadge = (s: string) => {
    const m: Record<string, string> = {
      draft: 'bg-zinc-700/30 text-zinc-400', sent: 'bg-blue-900/30 text-blue-400',
      client_approved: 'bg-green-900/30 text-green-400', client_rejected: 'bg-red-900/30 text-red-400',
      company_approved: 'bg-purple-900/30 text-purple-400', completed: 'bg-emerald-900/30 text-emerald-400',
      archived: 'bg-zinc-700/30 text-zinc-400',
    };
    const l: Record<string, string> = {
      draft: t('label_draft'), sent: t('label_sent'), client_approved: t('label_client_approved'),
      client_rejected: t('label_client_rejected_badge'), company_approved: t('label_company_approved_badge'),
      completed: t('label_completed'), archived: t('label_archived'),
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs ${m[s] || 'bg-zinc-700/30 text-zinc-400'}`}>{l[s] || s}</span>;
  };

  return (
    <div className="border border-[var(--color-card-border)] rounded-xl bg-[var(--color-card)] overflow-hidden">
      <div className="bg-[var(--color-card-border)] px-4 py-2 border-b border-[var(--color-card-border)] flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--color-gold-text)]">{t('contract_card_service')}</span>
        {statusBadge(contract.status)}
      </div>
      <div className="p-4 space-y-2">
        <h4 className="font-bold text-[var(--color-foreground)]">{contract.title}</h4>
        {/* The currency used to be the literal string "SAR" here, so a contract
            priced in any other currency (EGP, USD...) was displayed as riyals
            while the generated PDF - which reads contract.currency - showed the
            real one. Same `currency || 'SAR'` fallback the other contract views
            already use. */}
        {contract.value && <p className="text-sm text-[var(--color-text-secondary)]">{contract.value} {contract.currency || 'SAR'}</p>}
        {clientType === 'business' && <p className="text-xs text-[var(--color-text-disabled)]">{t('contract_card_excl_vat')}</p>}
        {(contract.start_date || contract.end_date) && (
          <p className="text-xs text-[var(--color-text-disabled)]">
            {contract.start_date && contract.end_date
              ? t('contract_card_from_to', { start: contract.start_date, end: contract.end_date })
              : contract.start_date
              ? t('contract_card_starts', { start: contract.start_date })
              : t('contract_card_ends', { end: contract.end_date ?? '' })}
          </p>
        )}
        {contract.clauses?.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-[var(--color-card-border)] pt-2">
            {contract.clauses.map((cl) => (
              <p key={cl.id} className="text-xs text-[var(--color-text-secondary)] pr-2 border-r-2 border-[var(--color-card-border)]">{cl.content}</p>
            ))}
          </div>
        )}
      </div>
      {onAction && contract.status === 'draft' && (
        <div className="px-4 pb-3 flex gap-2 flex-wrap">
          <button onClick={() => onAction(contract.id, 'send')} className="text-xs bg-[var(--color-primary)] text-white px-3 py-1 rounded-lg hover:bg-[var(--color-primary-dark)]">{t('contract_card_send_to_client')}</button>
        </div>
      )}
      {onAction && contract.status === 'company_approved' && (
        <div className="px-4 pb-3 flex gap-2 flex-wrap">
          <button onClick={() => onAction(contract.id, 'archive')} className="text-xs bg-zinc-500 text-white px-3 py-1 rounded-lg hover:bg-zinc-600">{t('contract_card_archive')}</button>
        </div>
      )}
    </div>
  );
}
