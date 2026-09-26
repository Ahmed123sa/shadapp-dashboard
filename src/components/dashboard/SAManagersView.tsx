'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { Users, FileText, DollarSign, Clock } from 'lucide-react';
import api from '@/lib/api';
import { useDashboardStats } from '@/hooks/queries/useDashboardStats';
import DashboardStatCard from '@/components/dashboard/DashboardStatCard';
import ActivityFeed, { ActivityItem } from '@/components/dashboard/ActivityFeed';
import PendingApprovalsPanel from '@/components/dashboard/PendingApprovalsPanel';
import ManagerTableRow from '@/components/dashboard/ManagerTableRow';
import { ClientTypeBadge } from '@/components/ui/ClientTypeBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Client, Contract, Payment, Meeting, Manager, Approval, TFunc } from '@/components/dashboard/types';
import { timeAgo } from '@/components/dashboard/format';

// The super admin's grid dashboard (default view when no ?view= is present
// and the signed-in user is a super admin) — a manager table plus pending
// approvals, instead of AMView's client table.
export default function SAManagersView({ t, locale, managers, allContracts, allPayments, allMeetings, pendingApprovals, unreadCount }: {
  t: TFunc; locale: string; managers: Manager[]; allContracts: Contract[];
  allPayments: Payment[]; allMeetings: Meeting[]; pendingApprovals: Approval[]; unreadCount: number;
}) {
  // 24 Sept 2026 — total clients, active contracts, and monthly revenue
  // (server-side-stats-plan.md) used to be computed here from managers'
  // managed_clients_count (which counts archived clients too) and from
  // allContracts/allPayments (capped at the first 100 rows the parent
  // fetched, and — for revenue — summed across currencies with no date
  // filter despite the "Monthly Revenue" label, so it was really revenue-
  // since-the-beginning-of-time). GET /dashboard/stats now computes all
  // three as full COUNT/SUMs over the whole table, so these track the same
  // numbers /badge-counts and the mobile app show. Falls back to 0 / no
  // breakdown while the request is in flight.
  const { data: stats } = useDashboardStats();
  const totalClients = stats?.clients.total ?? 0;
  const activeContracts = stats?.contracts.active ?? 0;
  const pendingApprovalsTotal = stats?.approvals.total ?? pendingApprovals.length;
  const revenueEntries = Object.entries(stats?.revenue_this_month ?? {}).sort(([a], [b]) => a.localeCompare(b));

  const activityItems: ActivityItem[] = [];
  const approvedContracts = allContracts.filter(c => c.status === 'company_approved').slice(0, 2);
  approvedContracts.forEach(c => {
    const name1 = c.workspace?.client?.company_name || '#' + c.id;
    activityItems.push({ color: 'green', text: t('activity_sa_contract_approved', { name: name1 }), time: timeAgo(c.created_at || new Date().toISOString(), locale, t) });
  });
  // 26 Sept 2026 — 'client_approved' and 'sent' contracts used to also show
  // up here ("Client X approved the contract" / "Contract sent") on top of
  // the "Pending Approvals" panel above, which lists the exact same
  // contracts (awaiting_you / awaiting_client) — the same item duplicated in
  // two places on one screen (pending-approvals-plan.md ن4/س4). Dropped from
  // this feed; a contract only shows up here again once it's actually
  // resolved (company_approved, below).
  const recentPayments = allPayments.slice(0, 2);
  recentPayments.forEach(p => {
    const amt4 = `${Number(p.amount).toLocaleString()} ${p.currency || 'SAR'}`;
    const client4 = p.workspace?.client?.company_name || t('client_label');
    activityItems.push({ color: 'gold', text: t('activity_sa_payment_received', { amount: amt4, client: client4 }), time: timeAgo(p.created_at, locale, t) });
  });
  const recentMeetings = allMeetings.slice(0, 2);
  recentMeetings.forEach(m => {
    const client5 = m.workspace?.client?.company_name;
    const msg = client5 ? t('activity_sa_meeting_with_client', { title: m.title, client: client5 }) : t('activity_sa_meeting_held', { title: m.title });
    activityItems.push({ color: 'blue', text: msg, time: timeAgo(m.created_at || m.scheduled_at, locale, t) });
  });

  const [expandedManager, setExpandedManager] = useState<number | null>(null);
  const [managerClients, setManagerClients] = useState<Client[]>([]);
  const [managerClientsLoading, setManagerClientsLoading] = useState(false);

  const toggleManager = async (managerId: number) => {
    if (expandedManager === managerId) {
      setExpandedManager(null);
      setManagerClients([]);
      return;
    }
    setExpandedManager(managerId);
    setManagerClientsLoading(true);
    try {
      const { data } = await api.get(`/account-managers/${managerId}`);
      setManagerClients(data.clients || []);
    } catch {
      setManagerClients([]);
    } finally {
      setManagerClientsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ minHeight: '640px' }}>
      <div className="p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {/* The "+6" / "+3" that used to be here were literal strings, not a
              computed delta — they showed the same growth figures no matter
              what the data was. Dropped rather than faked; a real
              period-over-period delta needs backend aggregation we don't
              have yet. */}
          <DashboardStatCard label={t('total_clients')} value={totalClients} icon={Users} />
          <DashboardStatCard label={t('active_contracts')} value={activeContracts} icon={FileText} />
          <DashboardStatCard
            label={t('monthly_revenue')}
            icon={DollarSign}
            color="gold"
            value={
              revenueEntries.length === 0 ? (
                '—'
              ) : (
                <div className="flex flex-col gap-0.5">
                  {revenueEntries.map(([currency, total]) => (
                    <div key={currency} className="leading-tight">
                      {total.toLocaleString()}
                      <span className="text-[length:var(--fs-1)] font-normal opacity-70 ms-1">{currency}</span>
                    </div>
                  ))}
                </div>
              )
            }
          />
          <DashboardStatCard label={t('pending_approvals')} value={pendingApprovalsTotal} icon={Clock} color="red" subtitle={t('subtitle_urgent')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5">
          <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-[length:var(--fs-2)] font-bold">{t('managers')}</span>
              <Link href="/dashboard/account-managers" className="text-[length:var(--fs-1)] text-[var(--color-gold-text)] py-2.5 -my-2.5 inline-block">{t('manage')}</Link>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  {/* text-start, not text-end: same fix as AMView.tsx's client table -
                      ManagerTableRow's cells (avatar+name flex, clients count, pending
                      badge) all render at the reading-direction start, so an "end"
                      aligned header drifts off its own column in both languages. */}
                  <th className="text-start text-[length:var(--fs-1)] text-[var(--color-text-secondary)] uppercase tracking-[0.5px] px-3.5 py-2 border-b border-[var(--border)]">{t('col_manager')}</th>
                  <th className="text-start text-[length:var(--fs-1)] text-[var(--color-text-secondary)] uppercase tracking-[0.5px] px-3.5 py-2 border-b border-[var(--border)]">{t('col_clients')}</th>
                  <th className="text-start text-[length:var(--fs-1)] text-[var(--color-text-secondary)] uppercase tracking-[0.5px] px-3.5 py-2 border-b border-[var(--border)]">{t('col_pending')}</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m, i) => (
                  // Fragment (not a bare array) so the expanded-clients row can sit
                  // as a real sibling <tr> right after its own manager's row inside
                  // tbody. This used to be one block rendered after the whole
                  // </table> - correct for whichever manager was expanded, but always
                  // pinned to the bottom of the card instead of appearing under the
                  // row the admin actually clicked.
                  <Fragment key={m.id}>
                    <ManagerTableRow
                      manager={m} index={i}
                      expanded={expandedManager === m.id}
                      onToggle={() => toggleManager(m.id)}
                    />
                    {expandedManager === m.id && (
                      <tr>
                        <td colSpan={3} className="p-0 border-b border-white/[0.04] bg-white/[0.015]">
                          {managerClientsLoading ? (
                            <div className="p-4 text-center text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{t('loading_clients')}</div>
                          ) : managerClients.length === 0 ? (
                            <div className="p-4 text-center text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{t('no_clients')}</div>
                          ) : (
                            <div className="divide-y divide-white/[0.04]">
                              {managerClients.map((c) => (
                                <Link
                                  key={c.id}
                                  // uuid || id: see the matching comment in AMView.tsx.
                                  href={c.workspace ? `/dashboard/clients/${c.uuid || c.id}` : '#'}
                                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.03] transition-colors"
                                >
                                  <div className="w-7 h-7 rounded-full bg-[var(--color-crimson-soft)] border border-[var(--color-crimson-border)] flex items-center justify-center text-[9px] font-bold text-[var(--color-gold-text)] flex-shrink-0">
                                    {c.company_name?.slice(0, 2) || '?'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[length:var(--fs-2)] font-bold truncate">{c.company_name}</div>
                                    <div className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)] flex items-center gap-1.5">
                                      {c.contact_person}
                                      <ClientTypeBadge clientType={c.client_type} compact />
                                    </div>
                                  </div>
                                  <StatusBadge status={c.workspace?.status || c.status} />
                                </Link>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3.5">
            <PendingApprovalsPanel t={t} locale={locale} />

            <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl overflow-hidden flex-1">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <span className="text-[length:var(--fs-2)] font-bold">{t('recent_activity')}</span>
              </div>
              <ActivityFeed items={activityItems} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
