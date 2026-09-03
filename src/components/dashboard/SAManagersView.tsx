'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, FileText, DollarSign, Clock } from 'lucide-react';
import api from '@/lib/api';
import DashboardStatCard from '@/components/dashboard/DashboardStatCard';
import ActivityFeed, { ActivityItem } from '@/components/dashboard/ActivityFeed';
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
  const totalClients = managers.reduce((sum, m) => sum + (m.managed_clients_count || 0), 0);
  const activeContracts = allContracts.filter(c => c.status === 'company_approved' || c.status === 'completed').length;
  const monthlyRevenue = allPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const activityItems: ActivityItem[] = [];
  const approvedContracts = allContracts.filter(c => c.status === 'company_approved').slice(0, 2);
  approvedContracts.forEach(c => {
    const name1 = c.workspace?.client?.company_name || '#' + c.id;
    activityItems.push({ color: 'green', text: t('activity_sa_contract_approved', { name: name1 }), time: timeAgo(c.created_at || new Date().toISOString(), locale, t) });
  });
  const clientApprovedContracts = allContracts.filter(c => c.status === 'client_approved').slice(0, 2);
  clientApprovedContracts.forEach(c => {
    const name2 = c.workspace?.client?.company_name || '#' + c.id;
    activityItems.push({ color: 'gold', text: t('activity_sa_client_approved', { name: name2 }), time: timeAgo(c.created_at || new Date().toISOString(), locale, t) });
  });
  const sentContracts = allContracts.filter(c => c.status === 'sent').slice(0, 1);
  sentContracts.forEach(c => {
    const name3 = c.workspace?.client?.company_name || '#' + c.id;
    activityItems.push({ color: 'blue', text: t('activity_sa_contract_sent', { name: name3 }), time: timeAgo(c.created_at || new Date().toISOString(), locale, t) });
  });
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
          <DashboardStatCard label={t('total_clients')} value={totalClients} icon={Users} subtitle={`+6 ${t('subtitle_this_month')}`} />
          <DashboardStatCard label={t('active_contracts')} value={activeContracts} icon={FileText} subtitle={`+3 ${t('subtitle_this_week')}`} />
          <DashboardStatCard label={t('monthly_revenue')} value={`${(monthlyRevenue / 1000).toFixed(0)}K`} icon={DollarSign} color="gold" subtitle={t('vs_last_month')} />
          <DashboardStatCard label={t('pending_approvals')} value={pendingApprovals.length} icon={Clock} color="red" subtitle={t('subtitle_urgent')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5">
          <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-[12.5px] font-bold">{t('managers')}</span>
              <Link href="/dashboard/account-managers" className="text-[10.5px] text-[var(--color-gold)]">{t('manage')}</Link>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-end text-[10px] text-[var(--color-text-secondary)] uppercase tracking-[0.5px] px-3.5 py-2 border-b border-[var(--border)]">{t('col_manager')}</th>
                  <th className="text-end text-[10px] text-[var(--color-text-secondary)] uppercase tracking-[0.5px] px-3.5 py-2 border-b border-[var(--border)]">{t('col_clients')}</th>
                  <th className="text-end text-[10px] text-[var(--color-text-secondary)] uppercase tracking-[0.5px] px-3.5 py-2 border-b border-[var(--border)]">{t('col_pending')}</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m, i) => (
                  <ManagerTableRow
                    key={m.id} manager={m} index={i}
                    expanded={expandedManager === m.id}
                    onToggle={() => toggleManager(m.id)}
                  />
                ))}
              </tbody>
            </table>
            {expandedManager && (
              <div className="border-t border-[var(--border)] bg-white/[0.015]">
                {managerClientsLoading ? (
                  <div className="p-4 text-center text-[11px] text-[var(--color-text-secondary)]">{t('loading_clients')}</div>
                ) : managerClients.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-[var(--color-text-secondary)]">{t('no_clients')}</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {managerClients.map((c) => (
                      <Link
                        key={c.id}
                        href={c.workspace ? `/dashboard/clients/${c.id}` : '#'}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-[var(--color-crimson-soft)] border border-[var(--color-crimson-border)] flex items-center justify-center text-[9px] font-bold text-[var(--color-gold)] flex-shrink-0">
                          {c.company_name?.slice(0, 2) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11.5px] font-bold truncate">{c.company_name}</div>
                          <div className="text-[9.5px] text-[var(--color-text-secondary)] flex items-center gap-1.5">
                            {c.contact_person}
                            <ClientTypeBadge clientType={c.client_type} compact />
                          </div>
                        </div>
                        <StatusBadge status={c.workspace?.status || c.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3.5">
            {pendingApprovals.length > 0 && (
              <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                  <span className="text-[12.5px] font-bold">{t('pending_approvals')}</span>
                  <span className="text-[10.5px] text-[var(--color-text-secondary)]">{pendingApprovals.length}</span>
                </div>
                {pendingApprovals.slice(0, 4).map((a) => (
                  <Link
                    key={a.id}
                    href={a.workspace ? `/dashboard/clients/${a.workspace.client?.id}?tab=الموافقات` : '#'}
                    className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors"
                  >
                    <div className="w-[3px] h-9 rounded-sm bg-[var(--color-gold)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold truncate">{a.title}</div>
                      <div className="text-[10px] text-[var(--color-text-secondary)] truncate">
                        {a.workspace?.client?.company_name || ''} — {timeAgo(a.created_at, locale, t)}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--color-gold-soft)] text-[var(--color-gold)] flex-shrink-0">
                      {t('pending_status')}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl overflow-hidden flex-1">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <span className="text-[12.5px] font-bold">{t('recent_activity')}</span>
              </div>
              <ActivityFeed items={activityItems} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
