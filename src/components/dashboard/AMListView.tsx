'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, CreditCard, Calendar, Folder } from 'lucide-react';
import api from '@/lib/api';
import { PaginatedView } from '@/components/dashboard/PaginatedView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Client, Contract, Payment, Meeting, FileFile, PaginatedResponse, TFunc } from '@/components/dashboard/types';
import { formatDate, formatTime, formatFileSize } from '@/components/dashboard/format';

// The paginated table view (?view=contracts|meetings|payments|files) shown
// to an account manager. All four page through their own dedicated API
// endpoint now. 'contracts' used to render straight from an allContracts
// prop the parent had already capped at 100 rows with no real pagination
// (W9 in server-side-stats-plan.md: any contract past the 30th was
// invisible in this list, not just undercounted, since the table never
// linked to a next page). It now pages through /all-contracts the same way
// meetings/payments/files already did, so the allContracts prop is gone.
export default function AMListView({ t, locale, view, clients, allPayments }: {
  t: TFunc; locale: string; view: string; clients: Client[]; allPayments: Payment[];
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  // apiItems/config below are deliberately loose: this view renders four
  // unrelated row shapes (Contract/Meeting/Payment/FileFile) through one
  // generic table, and each config branch below is already precisely typed
  // at its getLink/renderRow definition site.
  const [apiItems, setApiItems] = useState<any[]>([]);
  const [apiMeta, setApiMeta] = useState<{ lastPage: number; total: number } | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const fetchPaginated = useCallback(async (viewType: string, pageNum: number) => {
    setApiLoading(true);
    try {
      let endpoint = '';
      if (viewType === 'contracts') endpoint = `/all-contracts?page=${pageNum}&per_page=10`;
      else if (viewType === 'meetings') endpoint = `/all-meetings?page=${pageNum}&per_page=10`;
      else if (viewType === 'payments') endpoint = `/all-payments?page=${pageNum}&per_page=10`;
      else if (viewType === 'files') endpoint = `/all-files?page=${pageNum}&per_page=10`;
      if (!endpoint) { setApiLoading(false); return; }

      const res = await api.get(endpoint);
      const key = viewType === 'contracts' ? 'contracts' : viewType === 'meetings' ? 'meetings' : viewType === 'payments' ? 'payments' : 'files';
      const paginated: PaginatedResponse<any> = res.data[key] || { data: [], last_page: 1, total: 0 };
      setApiItems(paginated.data || []);
      setApiMeta({ lastPage: paginated.last_page, total: paginated.total });
    } catch {
      setApiItems([]);
      setApiMeta(null);
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    if (view === 'contracts' || view === 'meetings' || view === 'payments' || view === 'files') {
      fetchPaginated(view, 1);
    }
  }, [view, fetchPaginated]);

  useEffect(() => {
    if (view === 'contracts' || view === 'meetings' || view === 'payments' || view === 'files') {
      fetchPaginated(view, page);
    }
  }, [page, view, fetchPaginated]);

  const isPaginated = view === 'contracts' || view === 'meetings' || view === 'payments' || view === 'files';

  const getDynamicConfig = (viewType: string, items: any[]): { title: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; headers: string[]; getLink: (item: any) => string; renderRow: (item: any, locale: string) => React.ReactNode } | null => {
    if (viewType === 'contracts') return {
      title: t('contracts_nav'),
      icon: FileText,
      headers: [t('col_client'), t('col_title'), t('col_type'), t('col_value'), t('col_date'), t('col_status')],
      getLink: (c: Contract) => `/dashboard/clients/${c.workspace?.client?.id}?tab=العقود`,
      renderRow: (c: Contract, loc: string) => (
        <>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--color-crimson-soft)] border border-[var(--color-crimson-border)] flex items-center justify-center text-[9px] font-bold text-[var(--color-gold-text)] flex-shrink-0">
                {c.workspace?.client?.company_name?.slice(0, 2) || '?'}
              </div>
              <span className="text-[length:var(--fs-2)] font-bold truncate max-w-[120px]">{c.workspace?.client?.company_name || '—'}</span>
            </div>
          </td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-text-secondary)] truncate max-w-[140px]">{c.title}</td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04]">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
              c.contract_type === 'main' || c.contract_type === null
                ? 'bg-[var(--color-gold-soft)] text-[var(--color-gold-text)] border border-[var(--color-gold-border)]'
                : 'bg-blue-900/30 text-blue-400'
            }`}>
              {c.contract_type === 'main' || c.contract_type === null ? t('main_contract') : t('additional_contract')}
            </span>
          </td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-gold-text)] font-display">
            {Number(c.value).toLocaleString()} {c.currency}
          </td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{c.created_at ? formatDate(c.created_at, loc) : '—'}</td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04]"><StatusBadge status={c.status} /></td>
        </>
      ),
    };
    if (viewType === 'meetings') return {
      title: t('meetings_nav'), icon: Calendar,
      headers: [t('col_client'), t('col_title'), t('col_datetime'), t('col_duration'), t('col_status')],
      getLink: (m: Meeting) => `/dashboard/clients/${m.workspace?.client?.id}?tab=الاجتماعات`,
      renderRow: (m: Meeting, loc: string) => (
        <>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--color-crimson-soft)] border border-[var(--color-crimson-border)] flex items-center justify-center text-[9px] font-bold text-[var(--color-gold-text)] flex-shrink-0">
                {m.workspace?.client?.company_name?.slice(0, 2) || '?'}
              </div>
              <span className="text-[length:var(--fs-2)] font-bold truncate max-w-[120px]">{m.workspace?.client?.company_name || '—'}</span>
            </div>
          </td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-text-secondary)] truncate max-w-[140px]">{m.title}</td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04]">
            <div className="text-[length:var(--fs-1)]">{formatDate(m.scheduled_at, loc)}</div>
            <div className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{formatTime(m.scheduled_at, loc)}</div>
          </td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{m.duration_minutes} {t('minutes_suffix')}</td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04]">
            <span className={`px-2 py-0.5 rounded-full text-[length:var(--fs-1)] font-semibold ${
              m.status === 'completed' ? 'bg-green-900/30 text-green-400' :
              m.status === 'cancelled' ? 'bg-red-900/30 text-red-400' :
              'bg-blue-900/30 text-blue-400'
            }`}>
              {m.status === 'completed' ? '✓ ' + t('done_status') :
               m.status === 'cancelled' ? '✕ ' + t('cancelled_status') :
               '● ' + t('upcoming_status')}
            </span>
          </td>
        </>
      ),
    };
    if (viewType === 'payments') return {
      title: t('payments_nav'), icon: CreditCard,
      headers: [t('col_client'), t('col_contract'), t('col_amount'), t('col_method'), t('col_datetime'), t('col_status')],
      getLink: (p: Payment) => `/dashboard/clients/${p.workspace?.client?.id}?tab=المدفوعات`,
      renderRow: (p: Payment, loc: string) => (
        <>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--color-gold-soft)] border border-[var(--color-gold-border)] flex items-center justify-center text-[9px] font-bold text-[var(--color-gold-text)] flex-shrink-0">
                {p.workspace?.client?.company_name?.slice(0, 2) || '?'}
              </div>
              <span className="text-[length:var(--fs-2)] font-bold truncate max-w-[120px]">{p.workspace?.client?.company_name || '—'}</span>
            </div>
          </td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-text-secondary)] truncate max-w-[140px]">{p.contract?.title || '—'}</td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-gold-text)] font-display">
            {Number(p.amount).toLocaleString()} {p.currency || 'SAR'}
          </td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{p.method_type}</td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04]">
            <div className="text-[length:var(--fs-1)]">{formatDate(p.created_at, loc)}</div>
            <div className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{formatTime(p.created_at, loc)}</div>
          </td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04]"><StatusBadge status={p.status} /></td>
        </>
      ),
    };
    if (viewType === 'files') return {
      title: t('files_nav'), icon: Folder,
      headers: [t('col_client'), t('col_file'), t('col_type'), t('col_size'), t('col_date')],
      getLink: (f: FileFile) => `/dashboard/clients/${f.workspace?.client?.id}?tab=الملفات`,
      renderRow: (f: FileFile, loc: string) => (
        <>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--color-crimson-soft)] border border-[var(--color-crimson-border)] flex items-center justify-center text-[9px] font-bold text-[var(--color-gold-text)] flex-shrink-0">
                {f.workspace?.client?.company_name?.slice(0, 2) || '?'}
              </div>
              <span className="text-[length:var(--fs-2)] font-bold truncate max-w-[120px]">{f.workspace?.client?.company_name || '—'}</span>
            </div>
          </td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04]">
            <div className="text-[length:var(--fs-1)] font-bold truncate max-w-[160px]">{f.name}</div>
            <div className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{f.uploaded_by?.name || ''}</div>
          </td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{f.type || '—'}</td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{formatFileSize(f.size, loc, t)}</td>
          <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{formatDate(f.created_at, loc)}</td>
        </>
      ),
    };
    return null;
  };

  const config = getDynamicConfig(view, apiItems);
  if (!config) return null;

  const items = isPaginated ? apiItems : [];
  const lastPage = isPaginated ? (apiMeta?.lastPage || 1) : 1;
  const total = isPaginated ? (apiMeta?.total || 0) : 0;

  return (
    <PaginatedView
      config={config}
      items={items}
      total={total}
      lastPage={lastPage}
      page={page}
      onPrevPage={() => setPage(p => p - 1)}
      onNextPage={() => setPage(p => p + 1)}
      locale={locale}
      apiLoading={apiLoading}
    />
  );
}
