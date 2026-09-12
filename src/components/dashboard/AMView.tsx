'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, FileText, CreditCard, MessageCircle } from 'lucide-react';
import DashboardStatCard from '@/components/dashboard/DashboardStatCard';
import ActivityFeed, { ActivityItem } from '@/components/dashboard/ActivityFeed';
import { ClientTypeBadge } from '@/components/ui/ClientTypeBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { resolveFileUrl } from '@/lib/utils';
import type { Client, Contract, Payment, Meeting, TFunc } from '@/components/dashboard/types';
import { timeAgo } from '@/components/dashboard/format';

// The account manager's grid dashboard (default view when no ?view= is
// present and the signed-in user isn't a super admin).
export default function AMView({ t, locale, clients, allContracts, allPayments, allMeetings, unreadCount, unreadClientsCount }: {
  t: TFunc; locale: string; clients: Client[]; allContracts: Contract[];
  allPayments: Payment[]; allMeetings: Meeting[]; unreadCount: number; unreadClientsCount: number;
}) {
  const router = useRouter();
  const totalClients = clients.length;
  const activeContracts = allContracts.filter(c => c.status === 'company_approved' || c.status === 'completed').length;
  const pendingContractsCount = allContracts.filter(c => c.status === 'sent' || c.status === 'client_approved').length;
  const pendingPaymentsCount = allPayments.filter(p => p.status === 'pending').length;

  const activityItems: ActivityItem[] = [];
  const approvedContracts = allContracts.filter(c => c.status === 'company_approved').slice(0, 2);
  approvedContracts.forEach(c => {
    const name1 = c.workspace?.client?.company_name || t('client_label');
    activityItems.push({ color: 'green', text: t('activity_am_contract_approved', { name: name1 }), time: timeAgo(c.created_at || new Date().toISOString(), locale, t) });
  });
  const pendingContracts = allContracts.filter(c => c.status === 'sent' || c.status === 'client_approved').slice(0, 2);
  pendingContracts.forEach(c => {
    const name2 = c.workspace?.client?.company_name || t('client_label');
    activityItems.push({ color: 'red', text: t('activity_am_contract_pending', { name: name2 }), time: timeAgo(c.created_at || new Date().toISOString(), locale, t) });
  });
  const recentPayments = allPayments.slice(0, 2);
  recentPayments.forEach(p => {
    const amt3 = `${Number(p.amount).toLocaleString()} ${p.currency || 'SAR'}`;
    const client3 = p.workspace?.client?.company_name || t('client_label');
    activityItems.push({ color: 'gold', text: t('activity_am_payment_received', { amount: amt3, client: client3 }), time: timeAgo(p.created_at, locale, t) });
  });
  const recentMeetings = allMeetings.slice(0, 1);
  recentMeetings.forEach(m => {
    const client4 = m.workspace?.client?.company_name || t('client_label');
    activityItems.push({ color: 'blue', text: t('activity_am_meeting_held', { title: m.title, client: client4 }), time: timeAgo(m.created_at || m.scheduled_at, locale, t) });
  });
  activityItems.sort((a, b) => 0).slice(0, 5);

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ minHeight: '640px' }}>
      <div className="p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {/* "+2" here was a literal, not a computed delta — same note as
              SAManagersView. */}
          <DashboardStatCard label={t('my_clients')} value={totalClients} icon={Users} color="crimson" subtitle={t('subtitle_this_month')} />
          <DashboardStatCard label={t('active_contracts')} value={activeContracts} icon={FileText} subtitle={t('awaiting_response', { count: pendingContractsCount })} />
          <DashboardStatCard label={t('pending_payments')} value={pendingPaymentsCount} icon={CreditCard} color="gold" subtitle={t('subtitle_needs_action')} />
          <DashboardStatCard label={t('unread_messages')} value={unreadCount} icon={MessageCircle} color="crimson" subtitle={t('subtitle_from_clients', { count: unreadClientsCount })} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5">
          <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-[length:var(--fs-2)] font-bold">{t('my_clients')}</span>
              <Link href="/dashboard/clients" className="text-[length:var(--fs-1)] text-[var(--color-gold-text)] py-2.5 -my-2.5 inline-block">{t('view_all')}</Link>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  {/* text-start, not text-end: the row cells below (avatar+name flex,
                      StatusBadge, timestamp) all render at the reading-direction start
                      with no explicit alignment override, so a header aligned to "end"
                      drifts away from its own column's data in both languages (mirrored
                      left/right depending on dir) instead of sitting above it. */}
                  <th className="text-start text-[length:var(--fs-1)] text-[var(--color-text-secondary)] uppercase tracking-[0.5px] px-3.5 py-2 border-b border-[var(--border)]">{t('col_client')}</th>
                  <th className="text-start text-[length:var(--fs-1)] text-[var(--color-text-secondary)] uppercase tracking-[0.5px] px-3.5 py-2 border-b border-[var(--border)]">{t('col_status')}</th>
                  <th className="text-start text-[length:var(--fs-1)] text-[var(--color-text-secondary)] uppercase tracking-[0.5px] px-3.5 py-2 border-b border-[var(--border)]">{t('col_last_contact')}</th>
                </tr>
              </thead>
              <tbody>
                {clients.slice(0, 5).map((c, i) => (
                  <tr key={c.id} className="row-slide hover:bg-white/[0.025] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)] focus-visible:-outline-offset-2" style={{ animationDelay: `${(i + 1) * 50}ms` }}
                    tabIndex={0} role="button" aria-label={c.company_name}
                    // uuid || id: the client detail page already redirects a numeric id
                    // to the uuid on load, but writing the uuid straight into the link
                    // (when we have it) skips that transitional numeric-id URL entirely.
                    // Falls back to id for the rare case uuid isn't present - the backend
                    // accepts both, so nothing breaks either way.
                    onClick={() => router.push(`/dashboard/clients/${c.uuid || c.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/dashboard/clients/${c.uuid || c.id}`); } }}>
                    <td className="px-3.5 py-2.5 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        {c.avatar_url ? (
                          <img src={resolveFileUrl(c.avatar_url)} alt="" className="w-[26px] h-[26px] rounded-full object-cover border border-[var(--border)] flex-shrink-0" />
                        ) : (
                          <div className="w-[26px] h-[26px] rounded-full bg-[var(--color-crimson-soft)] border border-[var(--color-crimson-border)] flex items-center justify-center text-[length:var(--fs-1)] font-bold text-[var(--color-gold-text)] flex-shrink-0">
                            {c.company_name?.slice(0, 2) || '?'}
                          </div>
                        )}
                        <div>
                          <div className="text-[length:var(--fs-2)] font-bold">{c.company_name}</div>
                          <div className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)] flex items-center gap-1.5">
                            {c.contact_person}
                            <ClientTypeBadge clientType={c.client_type} compact />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 border-b border-white/[0.04]">
                      <StatusBadge status={c.workspace?.status || c.status} />
                    </td>
                    <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">
                      {timeAgo(c.updated_at, locale, t)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <span className="text-[length:var(--fs-2)] font-bold">{t('recent_activity')}</span>
            </div>
            <ActivityFeed items={activityItems} />
          </div>
        </div>
      </div>
    </div>
  );
}
