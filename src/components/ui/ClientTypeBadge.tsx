'use client';

import { useTranslations } from 'next-intl';
import { Building2, User } from 'lucide-react';

interface ClientTypeBadgeProps {
  clientType?: string | null;
  compact?: boolean;
}

export function ClientTypeBadge({ clientType, compact = false }: ClientTypeBadgeProps) {
  if (!clientType) return null;

  const isBusiness = clientType === 'business';
  const t = useTranslations('dashboard');
  const label = isBusiness ? t('client_type_company') : t('client_type_individual');

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${
        isBusiness
          ? 'bg-[var(--color-gold)]/15 text-[var(--color-gold)]'
          : 'bg-[var(--color-card-border)] text-[var(--color-text-secondary)]'
      }`}
    >
      {isBusiness ? <Building2 size={compact ? 12 : 14} strokeWidth={1.5} /> : <User size={compact ? 12 : 14} strokeWidth={1.5} />}
      {label}
    </span>
  );
}
