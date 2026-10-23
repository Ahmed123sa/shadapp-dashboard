'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getUser } from '@/lib/auth';
import {
  CreditCard, Search, Download, RefreshCw, CheckCircle2,
  Clock, AlertCircle, XCircle, DollarSign, ChevronLeft, ChevronRight, ExternalLink
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import Link from 'next/link';
import { resolveFileUrl } from '@/lib/utils';
import { useAllPayments, useFinanceFilterOptions, useFinanceReviewPayment, downloadFinanceCsv, type FinanceFilters } from '@/hooks/queries/usePayments';
import { canReviewPayments } from '@/lib/permissions';

export default function FinancePage() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const user = getUser();
  // The manager filter shows for everyone who sees company-wide finance.
  const isSA = user?.role === 'super_admin' || user?.role === 'accountant';

  // Filter states
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [currency, setCurrency] = useState('');
  const [clientId, setClientId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const filters: FinanceFilters = { page, search, status, currency, clientId, managerId, dateFrom, dateTo };

  // The queryKey is the whole `filters` object, so any of these state
  // changes above already triggers a refetch on their own — same as the old
  // useCallback (which depended on all of them) + useEffect([page, loadPayments])
  // pair, where changing a filter changed loadPayments' identity and refetched.
  const paymentsQuery = useAllPayments(filters);
  const filterOptionsQuery = useFinanceFilterOptions();

  const payments = paymentsQuery.data?.payments ?? [];
  const stats = paymentsQuery.data?.stats ?? null;
  const pagination = paymentsQuery.data?.pagination ?? { current_page: 1, last_page: 1, total: 0 };
  const clients = filterOptionsQuery.data?.clients ?? [];
  const managers = filterOptionsQuery.data?.managers ?? [];
  // isFetching (not isLoading) so the table goes back to a full skeleton on
  // every filter/page change too, matching the old `setLoading(true)` at the
  // top of every loadPayments call — not just the very first one.
  const loading = paymentsQuery.isFetching;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatus('');
    setCurrency('');
    setClientId('');
    setManagerId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState('');
  // Payment awaiting a rejection reason (mandatory, 5+ chars).
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const reviewMutation = useFinanceReviewPayment();
  const canReview = canReviewPayments(user);

  const errorText = (err: unknown, fallback: string) => {
    const e = err as { response?: { data?: { message?: string } } };
    return e?.response?.data?.message || fallback;
  };

  // Exports every row matching the filters, from the backend (not just this page).
  const exportCSV = async () => {
    setExporting(true);
    setActionError('');
    try {
      await downloadFinanceCsv(filters);
    } catch (err) {
      setActionError(errorText(err, locale === 'ar' ? 'تعذر التصدير.' : 'Export failed.'));
    } finally {
      setExporting(false);
    }
  };

  const approve = (pid: number) => {
    setActionError('');
    reviewMutation.mutate({ pid, action: 'approved' }, {
      onError: (err) => setActionError(errorText(err, locale === 'ar' ? 'تعذر اعتماد الدفعة.' : 'Could not approve.')),
    });
  };

  const confirmReject = () => {
    if (rejectingId === null || rejectReason.trim().length < 5) return;
    setActionError('');
    reviewMutation.mutate({ pid: rejectingId, action: 'rejected', rejection_reason: rejectReason.trim() }, {
      onSuccess: () => { setRejectingId(null); setRejectReason(''); },
      onError: (err) => setActionError(errorText(err, locale === 'ar' ? 'تعذر رفض الدفعة.' : 'Could not reject.')),
    });
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'approved':
        return <span data-tone="ok" className="lx-status inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400"><CheckCircle2 size={12} /> {locale === 'ar' ? 'معتمدة' : 'Approved'}</span>;
      case 'pending':
        return <span data-tone="wait" className="lx-status inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400"><Clock size={12} /> {locale === 'ar' ? 'معلقة' : 'Pending'}</span>;
      case 'rejected':
        return <span data-tone="bad" className="lx-status inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400"><AlertCircle size={12} /> {locale === 'ar' ? 'مرفوضة' : 'Rejected'}</span>;
      case 'scheduled':
        return <span data-tone="wait" className="lx-status inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400"><Clock size={12} /> {locale === 'ar' ? 'مجدولة' : 'Scheduled'}</span>;
      case 'overdue':
        return <span data-tone="bad" className="lx-status inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-400"><AlertCircle size={12} /> {locale === 'ar' ? 'متأخرة' : 'Overdue'}</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400">{st}</span>;
    }
  };

  const methodLabels: Record<string, string> = {
    bank_transfer: locale === 'ar' ? 'تحويل بنكي' : 'Bank Transfer',
    swift: 'SWIFT',
    corporate_account: locale === 'ar' ? 'حساب شركات' : 'Corporate Account',
    instapay: 'InstaPay',
    vodafone_cash: 'Vodafone Cash',
    mobile_wallet: locale === 'ar' ? 'محفظة إلكترونية' : 'Mobile Wallet',
    cheque: locale === 'ar' ? 'شيك' : 'Cheque',
  };

  return (
    <div className="lx-fin space-y-6">
      {/* Header */}
      <div className="lx-pagehead lx-fin-head flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="lx-hide">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)] flex items-center gap-2">
            <CreditCard className="text-[var(--color-gold-text)]" size={24} />
            {locale === 'ar' ? 'المالية والمدفوعات' : 'Finance & Payments'}
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {locale === 'ar' ? 'متابعة وإدارة كافة العمليات المالية والمدفوعات عبر جميع العملاء ومساحات العمل' : 'Track and manage all financial transactions across clients and workspaces'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => paymentsQuery.refetch()}
            className="p-2 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-input-fill)] transition"
            title={locale === 'ar' ? 'تحديث' : 'Refresh'}
            aria-label={locale === 'ar' ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={exportCSV}
            disabled={payments.length === 0 || exporting}
            aria-busy={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--color-card)] border border-[var(--color-card-border)] hover:border-[var(--color-gold)] text-[var(--color-foreground)] transition disabled:opacity-50 cursor-pointer"
          >
            <Download size={14} className="text-[var(--color-gold-text)]" />
            {locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
          </button>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">
          {actionError}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="lx-kpis grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lx-kpi bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="lx-kpi-l text-xs text-[var(--color-text-secondary)]">{locale === 'ar' ? 'إجمالي العمليات' : 'Total Transactions'}</span>
              <div className="lx-kpi-icon w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <CreditCard size={16} />
              </div>
            </div>
            <p className="lx-kpi-v text-2xl font-bold mt-2 text-[var(--color-foreground)]">{stats.total_count || 0}</p>
            <p className="lx-kpi-sub text-[length:var(--fs-1)] text-[var(--color-text-disabled)] mt-1">{stats.approved_count || 0} {locale === 'ar' ? 'عملية معتمدة' : 'approved'}</p>
          </div>

          {/* Currency cards: one per currency that actually moved money
              (nonzero approved total), driven entirely by
              approved_by_currency from the backend (SAR/USD included in
              there same as any other currency — no more pinning SAR/USD as
              permanent cards regardless of whether they have data). */}
          {Object.entries(stats.approved_by_currency || {})
            .filter(([, total]) => Number(total || 0) > 0)
            .sort(([, a], [, b]) => Number(b || 0) - Number(a || 0))
            .map(([cur, total]) => (
              <div key={cur} className="lx-kpi bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="lx-kpi-l text-xs text-[var(--color-text-secondary)]">{locale === 'ar' ? `المدفوعات المعتمدة (${cur})` : `Approved ${cur}`}</span>
                  <div className="lx-kpi-icon w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <DollarSign size={16} />
                  </div>
                </div>
                <p data-color="gold" className="lx-kpi-v text-2xl font-bold mt-2 text-emerald-400 font-display">
                  {Number(total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-emerald-400/70 ms-1">{cur}</span>
                </p>
                <p className="lx-kpi-sub text-[length:var(--fs-1)] text-[var(--color-text-disabled)] mt-1">{locale === 'ar' ? `إجمالي الإيرادات بعملة ${cur}` : `Total ${cur} revenue`}</p>
              </div>
            ))}

          <div className="lx-kpi bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="lx-kpi-l text-xs text-[var(--color-text-secondary)]">{locale === 'ar' ? 'مدفوعات معلقة للتدقيق' : 'Pending Review'}</span>
              <div className="lx-kpi-icon w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Clock size={16} />
              </div>
            </div>
            <p className="lx-kpi-v text-2xl font-bold mt-2 text-amber-400">{stats.pending_count || 0}</p>
            <p data-color={(stats.pending_count || 0) > 0 ? 'red' : undefined} className="lx-kpi-sub text-[length:var(--fs-1)] text-[var(--color-text-disabled)] mt-1">{locale === 'ar' ? 'بحاجة للمراجعة والاعتماد' : 'Needs attention'}</p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="lx-finbar bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2.5 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              placeholder={locale === 'ar' ? 'بحث بالمبلغ، العميل، العقد...' : 'Search by amount, client, contract...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--color-input-fill)] border border-[var(--color-input-border)] rounded-lg ps-9 pe-3 py-2 text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)] transition"
            />
          </div>

          {/* Client Filter */}
          <select
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); setPage(1); }}
            className="bg-[var(--color-input-fill)] border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)] transition"
          >
            <option value="">{locale === 'ar' ? 'كل العملاء' : 'All Clients'}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name || c.contact_person}</option>
            ))}
          </select>

          {/* Manager Filter */}
          {isSA && (
            <select
              value={managerId}
              onChange={(e) => { setManagerId(e.target.value); setPage(1); }}
              className="bg-[var(--color-input-fill)] border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)] transition"
            >
              <option value="">{locale === 'ar' ? 'كل مديري الحسابات' : 'All Account Managers'}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="bg-[var(--color-input-fill)] border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)] transition"
          >
            <option value="">{locale === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
            <option value="approved">{locale === 'ar' ? 'معتمدة' : 'Approved'}</option>
            <option value="pending">{locale === 'ar' ? 'معلقة' : 'Pending'}</option>
            <option value="rejected">{locale === 'ar' ? 'مرفوضة' : 'Rejected'}</option>
            <option value="scheduled">{locale === 'ar' ? 'مجدولة' : 'Scheduled'}</option>
            <option value="overdue">{locale === 'ar' ? 'متأخرة' : 'Overdue'}</option>
          </select>

          {/* Currency Filter */}
          <select
            value={currency}
            onChange={(e) => { setCurrency(e.target.value); setPage(1); }}
            className="bg-[var(--color-input-fill)] border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)] transition"
          >
            <option value="">{locale === 'ar' ? 'كل العملات' : 'All Currencies'}</option>
            <option value="SAR">SAR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="AED">AED</option>
            <option value="EGP">EGP</option>
            <option value="KWD">KWD</option>
            <option value="QAR">QAR</option>
            <option value="BHD">BHD</option>
            <option value="OMR">OMR</option>
          </select>

          {/* Date From & To */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="bg-[var(--color-input-fill)] border border-[var(--color-input-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)]"
              title={locale === 'ar' ? 'من تاريخ' : 'Date From'}
            />
            <span className="text-[var(--color-text-disabled)] text-xs">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="bg-[var(--color-input-fill)] border border-[var(--color-input-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)]"
              title={locale === 'ar' ? 'إلى تاريخ' : 'Date To'}
            />
          </div>

          {/* Action buttons */}
          <button
            type="submit"
            className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition cursor-pointer"
          >
            {locale === 'ar' ? 'تطبيق' : 'Apply'}
          </button>

          {(search || status || currency || clientId || managerId || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-[var(--color-text-secondary)] hover:text-red-400 px-2 py-1 transition cursor-pointer"
            >
              {locale === 'ar' ? 'إعادة ضبط' : 'Reset'}
            </button>
          )}
        </form>
      </div>

      {/* Transactions Table */}
      <div className="lx-tblbox lx-ledger bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--color-text-secondary)]">
            <CreditCard size={36} className="mx-auto mb-3 text-[var(--color-text-disabled)]" />
            <p className="font-medium">{locale === 'ar' ? 'لا توجد عمليات دفع مطابقة للفلاتر الحالية' : 'No payments match the current filters'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-card-border)] bg-white/[0.02] text-[var(--color-text-secondary)]">
                  <th className="py-3 px-4 text-start font-medium">#</th>
                  <th className="py-3 px-4 text-start font-medium">{locale === 'ar' ? 'العميل' : 'Client'}</th>
                  <th className="py-3 px-4 text-start font-medium">{locale === 'ar' ? 'مدير الحساب' : 'Account Manager'}</th>
                  <th className="py-3 px-4 text-start font-medium">{locale === 'ar' ? 'العقد' : 'Contract'}</th>
                  <th className="py-3 px-4 text-start font-medium">{locale === 'ar' ? 'المبلغ' : 'Amount'}</th>
                  <th className="py-3 px-4 text-start font-medium">{locale === 'ar' ? 'طريقة الدفع' : 'Method'}</th>
                  <th className="py-3 px-4 text-start font-medium">{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="py-3 px-4 text-start font-medium">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                  <th className="py-3 px-4 text-start font-medium">{locale === 'ar' ? 'الإشعار / المرفق' : 'Proof'}</th>
                  {canReview && <th className="py-3 px-4 text-start font-medium">{locale === 'ar' ? 'المراجعة' : 'Review'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-card-border)]">
                {payments.map((p) => {
                  const clientObj = p.workspace?.client;
                  const managerObj = p.workspace?.manager;
                  const proofRaw = Array.isArray(p.proof_file_url) ? p.proof_file_url[0] : p.proof_file_url;
                  const proofUrl = proofRaw ? resolveFileUrl(proofRaw) : null;

                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-[var(--color-text-disabled)] font-mono text-[length:var(--fs-1)]">#{p.id}</td>
                      <td className="py-3 px-4">
                        {clientObj ? (
                          <Link href={`/dashboard/clients/${clientObj.id}?tab=payments`} className="lx-tname hover:text-[var(--color-gold-text)] font-medium">
                            {clientObj.company_name || clientObj.contact_person}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                        {managerObj?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] max-w-[180px] truncate">
                        {p.contract?.title || '—'}
                      </td>
                      <td className="lx-num py-3 px-4 font-semibold text-[var(--color-foreground)]">
                        {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="ms-1 text-[length:var(--fs-1)] text-[var(--color-gold-text)] font-normal">{p.currency || 'SAR'}</span>
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                        {methodLabels[p.method_type] || p.method_type || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(p.status)}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-disabled)] text-[length:var(--fs-1)] whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className="py-3 px-4">
                        {proofUrl ? (
                          <a
                            href={proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="lx-proof inline-flex items-center gap-1 text-[length:var(--fs-1)] text-[var(--color-gold-text)] hover:underline"
                          >
                            <ExternalLink size={12} />
                            {locale === 'ar' ? 'عرض الإيصال' : 'View Proof'}
                          </a>
                        ) : (
                          <span className="text-[var(--color-text-disabled)]">—</span>
                        )}
                      </td>
                      {canReview && (
                        <td className="py-3 px-4">
                          {p.status === 'pending' ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => approve(p.id)}
                                disabled={reviewMutation.isPending}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[length:var(--fs-1)] font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                              >
                                <CheckCircle2 size={12} />
                                {locale === 'ar' ? 'اعتماد' : 'Approve'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setRejectingId(p.id); setRejectReason(''); setActionError(''); }}
                                disabled={reviewMutation.isPending}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[length:var(--fs-1)] font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 transition disabled:opacity-50 cursor-pointer"
                              >
                                <XCircle size={12} />
                                {locale === 'ar' ? 'رفض' : 'Reject'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[var(--color-text-disabled)]">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.last_page > 1 && (
          <div className="border-t border-[var(--color-card-border)] p-4 flex items-center justify-between">
            <p className="text-xs text-[var(--color-text-secondary)]">
              {locale === 'ar'
                ? `صفحة ${pagination.current_page} من ${pagination.last_page} (إجمالي ${pagination.total} عملية)`
                : `Page ${pagination.current_page} of ${pagination.last_page} (${pagination.total} total)`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={pagination.current_page <= 1}
                aria-label={locale === 'ar' ? 'الصفحة السابقة' : 'Previous page'}
                className="p-2 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] disabled:opacity-40 transition"
              >
                <ChevronRight size={14} className="rtl:rotate-180" />
              </button>
              <button
                onClick={() => setPage((prev) => Math.min(prev + 1, pagination.last_page))}
                disabled={pagination.current_page >= pagination.last_page}
                aria-label={locale === 'ar' ? 'الصفحة التالية' : 'Next page'}
                className="p-2 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] disabled:opacity-40 transition"
              >
                <ChevronLeft size={14} className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rejection reason dialog: the reason is mandatory (5+ chars). */}
      {rejectingId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="reject-title">
          <div className="w-full max-w-md rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card)] p-5 space-y-3">
            <h2 id="reject-title" className="text-base font-bold text-[var(--color-foreground)]">
              {locale === 'ar' ? `رفض الدفعة #${rejectingId}` : `Reject payment #${rejectingId}`}
            </h2>
            <label htmlFor="reject-reason" className="block text-xs text-[var(--color-text-secondary)]">
              {locale === 'ar' ? 'سبب الرفض (إجباري، 5 حروف على الأقل)' : 'Rejection reason (required, at least 5 characters)'}
            </label>
            <textarea
              id="reject-reason"
              autoFocus
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-[var(--color-input-fill)] border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setRejectingId(null); setRejectReason(''); }}
                className="px-3 py-2 rounded-lg text-xs border border-[var(--color-card-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] cursor-pointer"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={rejectReason.trim().length < 5 || reviewMutation.isPending}
                aria-busy={reviewMutation.isPending}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
              >
                {locale === 'ar' ? 'تأكيد الرفض' : 'Confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
