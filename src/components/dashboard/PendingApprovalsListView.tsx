'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock } from 'lucide-react';
import { usePendingApprovals } from '@/hooks/queries/usePendingApprovals';
import ErrorState from '@/components/ErrorState';
import { buildPendingApprovalRows, PendingApprovalRowLink } from '@/components/dashboard/PendingApprovalsPanel';
import type { TFunc } from '@/components/dashboard/types';
import type { PendingApprovalItem } from '@/types';

// pending-approvals-plan.md ك4 — the full page behind PendingApprovalsPanel's
// "view all" link (?view=approvals). Reads the same GET /dashboard/pending-
// approvals endpoint with a higher limit so the filter tabs below have more
// than the home panel's top-5 to show; mirrors the mobile app's
// sa_approvals_page.dart filter pills (all/contracts/payments/approvals),
// which already solved this exact "list doesn't match the count" problem
// there on 23 Sept 2026.
const FULL_LIST_LIMIT = 200;

type FilterType = 'all' | PendingApprovalItem['type'];

const FILTER_TYPES: FilterType[] = ['all', 'contract', 'payment', 'approval'];

// plans/pending-approvals-fixes-plan.md ح٧ — the active filter lives in the
// URL (?view=approvals&type=payment) instead of only in component state, so
// opening an item and coming back with the browser's Back button lands on
// the same filter, and a link can open the page pre-filtered. Anything
// missing or unrecognised falls back to "all".
function filterFromUrl(type: string | null): FilterType {
  return FILTER_TYPES.includes(type as FilterType) ? (type as FilterType) : 'all';
}

export default function PendingApprovalsListView({ t, locale }: { t: TFunc; locale: string }) {
  const { data, isLoading, isError, refetch } = usePendingApprovals(FULL_LIST_LIMIT);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlFilter = filterFromUrl(searchParams.get('type'));
  // Local state so a click shows the new filter immediately, re-synced
  // whenever the URL's own value changes (React's "adjust state when a prop
  // changes" pattern, no effect needed).
  const [filter, setFilterState] = useState<FilterType>(urlFilter);
  const [syncedUrlFilter, setSyncedUrlFilter] = useState<FilterType>(urlFilter);
  if (syncedUrlFilter !== urlFilter) {
    setSyncedUrlFilter(urlFilter);
    setFilterState(urlFilter);
  }
  const setFilter = (next: FilterType) => {
    setFilterState(next);
    // replace, not push: switching filters shouldn't pile up history entries
    // the Back button then has to step through.
    router.replace(next === 'all' ? '/dashboard?view=approvals' : `/dashboard?view=approvals&type=${next}`, { scroll: false });
  };

  const rows = data ? buildPendingApprovalRows(data, t, locale) : [];
  const filteredRows = filter === 'all' ? rows : rows.filter((r) => r.type === filter);

  const counts = data?.counts ?? { pending_requests: 0, pending_contracts: 0, pending_payments: 0, total: 0 };
  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: t('pending_approvals_filter_all'), count: counts.total },
    { key: 'contract', label: t('contracts_nav'), count: counts.pending_contracts },
    { key: 'payment', label: t('payments_nav'), count: counts.pending_payments },
    { key: 'approval', label: t('pending_approvals_filter_approvals'), count: counts.pending_requests },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ minHeight: '640px' }}>
      <div className="p-5">
        <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Clock size={20} strokeWidth={1.5} />
              <span className="text-[length:var(--fs-2)] font-bold">{t('pending_approvals')}</span>
              <span className="text-[length:var(--fs-1)] bg-[var(--color-card-border)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full">{counts.total}</span>
            </div>
            <Link href="/dashboard" className="text-[length:var(--fs-1)] text-[var(--color-gold-text)] py-2.5 -my-2.5 inline-block">{t('paginated_back')}</Link>
          </div>

          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--border)] flex-wrap">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-[length:var(--fs-1)] font-semibold border transition-colors ${
                  filter === f.key
                    ? 'bg-[var(--color-gold)]/10 border-[var(--color-gold)] text-[var(--color-gold-text)]'
                    : 'border-[var(--border)] text-[var(--color-text-secondary)] hover:bg-white/[0.04]'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* plans/pending-approvals-fixes-plan.md ح٣ — same rule as the home
              panel: a failed load is an error, not "Nothing pending". */}
          {isError && !data ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">{t('paginated_loading')}</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">{t('pending_approvals_empty')}</div>
          ) : (
            filteredRows.map((row) => <PendingApprovalRowLink key={row.key} row={row} />)
          )}
        </div>
      </div>
    </div>
  );
}
