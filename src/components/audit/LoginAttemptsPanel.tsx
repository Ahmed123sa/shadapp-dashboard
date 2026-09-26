'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import api from '@/lib/api';
import { Search } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { reportError } from '@/lib/error-reporting';
import type { LoginAttempt } from '@/types';

// Kept as its own component rather than threaded through AuditLogPage's
// state: the two tabs read different endpoints with different filters, and
// weaving a second data source through the existing page would have meant
// touching every one of its fetch/filter/pagination paths for no gain.
// This owns its own loading, filters and paging, and the page just decides
// which of the two to render.

const REASON_BADGE_CLASS: Record<string, string> = {
  unknown_email: 'bg-white/[0.06] text-[var(--color-text-secondary)]',
  wrong_password: 'bg-orange-500/15 text-[var(--color-status-orange-text)]',
  account_inactive: 'bg-purple-500/15 text-[var(--color-status-purple-text)]',
  client_archived: 'bg-blue-500/15 text-[var(--color-status-blue-text)]',
};

export default function LoginAttemptsPanel() {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ search: '', reason: '', date_from: '', date_to: '' });

  const REASON_LABELS: Record<string, string> = {
    unknown_email: t('attempts_reason_unknown_email'),
    wrong_password: t('attempts_reason_wrong_password'),
    account_inactive: t('attempts_reason_account_inactive'),
    client_archived: t('attempts_reason_client_archived'),
  };

  const ENDPOINT_LABELS: Record<string, string> = {
    staff: t('attempts_endpoint_staff'),
    client: t('attempts_endpoint_client'),
  };

  const fetchAttempts = (p: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    params.set('page', String(p));
    api.get(`/login-attempts?${params.toString()}`).then((res) => {
      const paginated = res.data?.attempts;
      setAttempts(paginated?.data || []);
      setTotalPages(paginated?.last_page || 1);
      setTotal(paginated?.total || 0);
    }).catch((err) => reportError('LoginAttemptsPanel.fetchAttempts', err)).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAttempts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => { setPage(1); fetchAttempts(1); };

  const formatWhen = (value: string) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    const tag = locale === 'ar' ? 'ar-EG' : 'en-US';
    return `${d.toLocaleDateString(tag, { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="space-y-4">
      <span className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">
        {t('attempts_total', { count: total })}
      </span>

      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative">
          <Search size={12} strokeWidth={1.5} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            placeholder={t('attempts_search_placeholder')}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
            className="bg-white/[0.04] border border-[var(--color-card-border)] rounded-full px-8 py-1.5 text-[length:var(--fs-1)] text-[var(--color-foreground)] w-[180px] outline-none focus:border-[var(--color-gold)]"
          />
        </div>
        <select value={filters.reason} onChange={(e) => setFilters({ ...filters, reason: e.target.value })}
          className="bg-white/[0.04] border border-[var(--color-card-border)] rounded-lg px-3 py-1.5 text-[length:var(--fs-1)] text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)]">
          <option value="">{t('attempts_all_reasons')}</option>
          {Object.entries(REASON_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          className="bg-white/[0.04] border border-[var(--color-card-border)] rounded-lg px-3 py-1.5 text-[length:var(--fs-1)] text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)]" />
        <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          className="bg-white/[0.04] border border-[var(--color-card-border)] rounded-lg px-3 py-1.5 text-[length:var(--fs-1)] text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)]" />
        <button onClick={applyFilters}
          className="bg-[var(--color-primary)] text-white px-4 py-1.5 rounded-lg text-[length:var(--fs-1)] font-bold cursor-pointer hover:opacity-90 transition-opacity">
          {t('audit_apply')}
        </button>
      </div>

      <div className="audit-card">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : attempts.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">{t('attempts_none')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>{t('attempts_col_email')}</th>
                    <th>{t('attempts_col_reason')}</th>
                    <th>{t('attempts_col_endpoint')}</th>
                    <th>{t('audit_col_ip')}</th>
                    <th>{t('audit_col_datetime')}</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td style={{ direction: 'ltr', textAlign: locale === 'ar' ? 'right' : 'left' }}>{attempt.email}</td>
                      <td>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${REASON_BADGE_CLASS[attempt.reason] || ''}`}>
                          {REASON_LABELS[attempt.reason] || attempt.reason}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>
                        {ENDPOINT_LABELS[attempt.endpoint] || attempt.endpoint}
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 11, direction: 'ltr', textAlign: 'right' }}>
                        {attempt.ip_address || '—'}
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {formatWhen(attempt.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="audit-pagination">
                <span className="pag-info">{t('audit_page_info', { page, totalPages, total })}</span>
                <div className="flex gap-1 me-auto items-center">
                  <button onClick={() => { const p = page - 1; setPage(p); fetchAttempts(p); }} disabled={page <= 1} className="pag-btn">
                    {t('audit_previous')}
                  </button>
                  <button onClick={() => { const p = page + 1; setPage(p); fetchAttempts(p); }} disabled={page >= totalPages} className="pag-btn">
                    {t('audit_next')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
