'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import type { Client, Contract, Payment, Meeting, Manager, Approval } from '@/components/dashboard/types';
import AMView from '@/components/dashboard/AMView';
import SAManagersView from '@/components/dashboard/SAManagersView';
import AMListView from '@/components/dashboard/AMListView';
import SAListView from '@/components/dashboard/SAListView';

export default function DashboardHome() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSA = getUser()?.role === 'super_admin';
  const view = searchParams.get('view') || '';

  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadClientsCount, setUnreadClientsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSA) {
      Promise.all([
        api.get('/account-managers').catch(() => ({ data: { managers: [] } })),
        api.get('/all-contracts?per_page=100').catch(() => ({ data: { contracts: { data: [] } } })),
        api.get('/all-payments?per_page=100').catch(() => ({ data: { payments: { data: [] } } })),
        api.get('/all-meetings?per_page=100').catch(() => ({ data: { meetings: { data: [] } } })),
        api.get('/approvals/pending').catch(() => ({ data: { approvals: [] } })),
        api.get('/notifications').catch(() => ({ data: { unread_count: 0 } })),
      ]).then(([managersRes, contractsRes, paymentsRes, meetingsRes, approvalsRes, notifRes]) => {
        setManagers(managersRes.data.managers || []);
        setAllContracts(contractsRes.data.contracts?.data || contractsRes.data.contracts || []);
        setAllPayments(paymentsRes.data.payments?.data || paymentsRes.data.payments || []);
        setAllMeetings(meetingsRes.data.meetings?.data || meetingsRes.data.meetings || []);
        setPendingApprovals(approvalsRes.data.approvals || []);
        setUnreadCount(notifRes.data.unread_count || 0);
        setUnreadClientsCount(notifRes.data.unread_clients_count || 0);
      }).finally(() => setLoading(false));
    } else {
      Promise.all([
        api.get('/clients').catch(() => ({ data: { clients: { data: [] } } })),
        api.get('/all-contracts?per_page=100').catch(() => ({ data: { contracts: { data: [] } } })),
        api.get('/all-payments?per_page=100').catch(() => ({ data: { payments: { data: [] } } })),
        api.get('/all-meetings?per_page=100').catch(() => ({ data: { meetings: { data: [] } } })),
        api.get('/notifications').catch(() => ({ data: { unread_count: 0 } })),
      ]).then(([clientsRes, contractsRes, paymentsRes, meetingsRes, notifRes]) => {
        setClients(clientsRes.data.clients?.data || clientsRes.data.clients || []);
        setAllContracts(contractsRes.data.contracts?.data || contractsRes.data.contracts || []);
        setAllPayments(paymentsRes.data.payments?.data || paymentsRes.data.payments || []);
        setAllMeetings(meetingsRes.data.meetings?.data || meetingsRes.data.meetings || []);
        setUnreadCount(notifRes.data.unread_count || 0);
        setUnreadClientsCount(notifRes.data.unread_clients_count || 0);
      }).finally(() => setLoading(false));
    }
  }, [isSA]);

  if (loading) return <DashboardSkeleton />;

  if (isSA) {
    if (view === 'meetings' || view === 'payments' || view === 'files' || view === 'contracts') {
      return <SAListView t={t} locale={locale} view={view} clients={clients} allContracts={allContracts} allPayments={allPayments} managers={managers} />;
    }
    return <SAManagersView
      t={t} locale={locale} managers={managers} allContracts={allContracts}
      allPayments={allPayments} allMeetings={allMeetings} pendingApprovals={pendingApprovals} unreadCount={unreadCount}
    />;
  }

  if (view === 'meetings' || view === 'payments' || view === 'files' || view === 'contracts') {
    return <AMListView t={t} locale={locale} view={view} clients={clients} allContracts={allContracts} allPayments={allPayments} />;
  }

  return <AMView
    t={t} locale={locale} clients={clients} allContracts={allContracts}
    allPayments={allPayments} allMeetings={allMeetings} unreadCount={unreadCount} unreadClientsCount={unreadClientsCount}
  />;
}
