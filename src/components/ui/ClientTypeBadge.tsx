'use client';

import { useTranslations } from 'next-intl';
import { Building2, User } from 'lucide-react';

interface ClientTypeBadgeProps {
  clientType?: string | null;
  compact?: boolean;
}

export function ClientTypeBadge({ clientType, compact = false }: ClientTypeBadgeProps) {
  // Hooks must run unconditionally on every render, so this needs to sit
  // above the early return below — otherwise it's skipped whenever
  // clientType is empty, which React (correctly) treats as a hooks-order
  // violation.
  const t = useTranslations('dashboard');
  if (!clientType) return null;

  const isBusiness = clientType === 'business';
  const label = isBusiness ? t('client_type_company') : t('client_type_individual');

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium ${
        compact ? 'px-1.5 py-0.5 text-[length:var(--fs-1)]' : 'px-2 py-0.5 text-[length:var(--fs-2)]'
      } ${
        isBusiness
          ? 'bg-[var(--color-gold)]/15 text-[var(--color-gold-text)]'
          : 'bg-[var(--color-card-border)] text-[var(--color-text-secondary)]'
      }`}
    >
      {isBusiness ? <Building2 size={compact ? 12 : 14} strokeWidth={1.5} /> : <User size={compact ? 12 : 14} strokeWidth={1.5} />}
      {label}
    </span>
  );
}
