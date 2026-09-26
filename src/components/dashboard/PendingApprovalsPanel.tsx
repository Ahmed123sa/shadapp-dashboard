'use client';

import Link from 'next/link';
import { usePendingApprovals } from '@/hooks/queries/usePendingApprovals';
import { timeAgo } from '@/components/dashboard/format';
import type { TFunc } from '@/components/dashboard/types';
import type { PendingApprovalItem, PendingApprovalsResponse } from '@/types';

// pending-approvals-plan.md ك2/ك3 — shared between the SA and AM home
// screens (and, from ك4, the full /dashboard?view=approvals page). Replaces
// SAManagersView's old "Pending Approvals" card, which only ever listed
// approval-request items and disappeared entirely once that one sub-count
// hit zero (ن1), and existed on the AM home not at all (ن2) — even though
// the badge/card next to it always summed three item types. This panel
// reads GET /dashboard/pending-approvals, the same list the badge's count
// comes from, and shows an explicit empty state instead of hiding.
export interface PendingApprovalRow {
  key: string;
  type: PendingApprovalItem['type'];
  href: string;
  title: string;
  subtitle: string;
  accentClass: string;
  waitingLabel: string;
  badgeClass: string;
}

function clientHref(item: PendingApprovalItem, tab: string): string {
  const id = item.client?.uuid || item.client?.id;
  return id ? `/dashboard/clients/${id}?tab=${tab}` : '#';
}

// Exported for PendingApprovalsListView (ك4, the full /dashboard?view=approvals
// page) so both places build rows the same way instead of drifting apart.
export function buildPendingApprovalRows(data: PendingApprovalsResponse, t: TFunc, locale: string): PendingApprovalRow[] {
  const rows: PendingApprovalRow[] = [];
  const onYou = t('pending_approvals_on_you');
  const onClient = t('pending_approvals_on_client');
  // gold = needs the staff member's own action; blue = blocked on the
  // client instead (ن4 — the plan is explicit these are not the same
  // urgency, even though both count toward the same total).
  const youAccent = 'bg-[var(--color-gold)]';
  const youBadge = 'bg-[var(--color-gold-soft)] text-[var(--color-gold-text)]';
  const clientAccent = 'bg-[var(--color-blue)]';
  const clientBadge = 'bg-[var(--color-blue)]/20 text-[var(--color-blue-text)]';

  data.awaiting_you.contracts.forEach((c) => {
    const time = timeAgo(c.updated_at || c.created_at || '', locale, t);
    rows.push({
      key: `contract-you-${c.id}`,
      type: 'contract',
      href: clientHref(c, 'contracts'),
      title: c.title || '',
      subtitle: `${c.client?.company_name || ''} • ${Number(c.value || 0).toLocaleString()} ${c.currency || ''} — ${time}`,
      accentClass: youAccent,
      waitingLabel: onYou,
      badgeClass: youBadge,
    });
  });
  data.awaiting_you.payments.forEach((p) => {
    const time = timeAgo(p.created_at || '', locale, t);
    rows.push({
      key: `payment-you-${p.id}`,
      type: 'payment',
      href: clientHref(p, 'payments'),
      title: t('pending_approval_payment_title', { client: p.client?.company_name || '' }),
      subtitle: `${Number(p.amount || 0).toLocaleString()} ${p.currency || ''} — ${time}`,
      accentClass: youAccent,
      waitingLabel: onYou,
      badgeClass: youBadge,
    });
  });
  data.awaiting_client.contracts.forEach((c) => {
    const time = timeAgo(c.updated_at || c.created_at || '', locale, t);
    rows.push({
      key: `contract-client-${c.id}`,
      type: 'contract',
      href: clientHref(c, 'contracts'),
      title: c.title || '',
      subtitle: `${c.client?.company_name || ''} • ${Number(c.value || 0).toLocaleString()} ${c.currency || ''} — ${time}`,
      accentClass: clientAccent,
      waitingLabel: onClient,
      badgeClass: clientBadge,
    });
  });
  data.awaiting_client.approvals.forEach((a) => {
    const time = timeAgo(a.created_at || '', locale, t);
    rows.push({
      key: `approval-client-${a.id}`,
      type: 'approval',
      href: clientHref(a, 'approvals'),
      title: a.title || '',
      subtitle: `${a.client?.company_name || ''} — ${time}`,
      accentClass: clientAccent,
      waitingLabel: onClient,
      badgeClass: clientBadge,
    });
  });

  return rows;
}

// Exported so PendingApprovalsListView (ك4) renders identical rows without
// duplicating the markup.
export function PendingApprovalRowLink({ row }: { row: PendingApprovalRow }) {
  return (
    <Link
      href={row.href}
      className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors"
    >
      <div className={`w-[3px] h-9 rounded-sm flex-shrink-0 ${row.accentClass}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[length:var(--fs-2)] font-bold truncate">{row.title}</div>
        <div className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)] truncate">{row.subtitle}</div>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold flex-shrink-0 ${row.badgeClass}`}>
        {row.waitingLabel}
      </span>
    </Link>
  );
}

export default function PendingApprovalsPanel({ t, locale, limit = 5 }: { t: TFunc; locale: string; limit?: number }) {
  const { data, isError, refetch } = usePendingApprovals();
  const total = data?.counts.total ?? 0;
  // plans/pending-approvals-fixes-plan.md ح٣ — a failed request used to fall
  // through to the "Nothing pending" empty state, telling staff there was
  // nothing to act on when the list simply hadn't loaded. Only when there is
  // no data at all, though: a failed background refetch keeps showing the
  // last list it did get rather than replacing it with an error.
  const loadFailed = isError && !data;
  const rows = data ? buildPendingApprovalRows(data, t, locale).slice(0, limit) : [];

  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <span className="text-[length:var(--fs-2)] font-bold">{t('pending_approvals')}</span>
        {total > 0 && (
          <Link href="/dashboard?view=approvals" className="text-[length:var(--fs-1)] text-[var(--color-gold-text)] py-2.5 -my-2.5 inline-block">
            {t('pending_approvals_view_all', { count: total })}
          </Link>
        )}
      </div>
      {loadFailed ? (
        <div className="p-6 text-center text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">
          {t('pending_approvals_load_failed')}
          <button onClick={() => refetch()} className="ms-2 text-[var(--color-gold-text)] hover:underline">
            {t('retry')}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">
          {t('pending_approvals_empty')}
        </div>
      ) : (
        rows.map((row) => <PendingApprovalRowLink key={row.key} row={row} />)
      )}
    </div>
  );
}
