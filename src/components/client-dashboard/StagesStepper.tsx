'use client';

import { useTranslations } from 'next-intl';
import type { Client, Workspace } from '@/types';

function getCurrentStage(client: Client | null, workspace: Workspace | null): number {
  if (!client || !workspace) return 0;
  if (workspace.status === 'active') return 6;
  const payments = workspace.payments || [];
  if (payments.some((p) => p.status === 'approved')) return 5;
  const contracts = workspace.contracts || [];
  if (contracts.some((c) => c.status === 'company_approved' || c.status === 'completed')) return 4;
  if (contracts.some((c) => c.status === 'client_approved')) return 3;
  if (contracts.some((c) => c.status === 'sent')) return 2;
  if (client.signed_at) return 1;
  return 0;
}

export default function StagesStepper({ client, workspace, onStageClick }: { client: Client | null; workspace: Workspace | null; onStageClick?: (tab: string) => void }) {
  const t = useTranslations('dashboard');
  const current = getCurrentStage(client, workspace);

  const STAGES = [
    { key: 'signed', icon: '🔏', label: t('stages_signed') },
    { key: 'sent', icon: '📄', label: t('stages_sent') },
    { key: 'client_approved', icon: '✅', label: t('stages_client_approved') },
    { key: 'company_approved', icon: '🏢', label: t('stages_company_approved') },
    { key: 'payment', icon: '💳', label: t('stages_payment') },
    { key: 'active', icon: '🚀', label: t('stages_active') },
  ];

  const STAGE_TO_TAB: Record<number, string> = {
    1: t('stage_tab_contracts'),
    2: t('stage_tab_contracts'),
    3: t('stage_tab_contracts'),
    4: t('stage_tab_payments'),
    5: t('stage_tab_payments'),
  };

  return (
    <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-4">
      <div className="flex items-center gap-0">
        {STAGES.map((stage, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={stage.key} className="flex-1 flex flex-col items-center gap-1">
              <button onClick={() => onStageClick?.(STAGE_TO_TAB[i] || t('stage_tab_contracts'))}
                className={`w-full h-1.5 rounded-full transition-colors cursor-pointer ${
                  done ? 'bg-[var(--color-primary)]' :
                  active ? 'bg-[var(--color-gold)]' :
                  'bg-[var(--color-card-border)]'
                }`} />
              <button onClick={() => onStageClick?.(STAGE_TO_TAB[i] || t('stage_tab_contracts'))}
                className={`text-[10px] whitespace-nowrap text-center transition-colors cursor-pointer ${
                  done ? 'text-[var(--color-primary)] font-medium' :
                  active ? 'text-[var(--color-gold)] font-medium' :
                  'text-[var(--color-text-disabled)]'
                }`}>
                {stage.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
