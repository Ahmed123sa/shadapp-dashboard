'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { Search } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { ClientTypeBadge } from '@/components/ui/ClientTypeBadge';
import { reportError } from '@/lib/error-reporting';
import type { AuditLog, User } from '@/types';

const ACTION_LABELS_FN = (t: (key: string) => string): Record<string, string> => ({
  'contract.created': t('audit_contract_created'),
  'contract.sent': t('audit_contract_sent'),
  'contract.client_approved': t('audit_contract_client_approved'),
  'contract.client_rejected': t('audit_contract_client_rejected'),
  'contract.client_edit_requested': t('audit_contract_client_edit_requested'),
  'contract.edit_requested': t('audit_contract_edit_requested'),
  'contract.company_approved': t('audit_contract_company_approved'),
  'contract.completed': t('audit_contract_completed'),
  'contract.archived': t('audit_contract_archived'),
  'contract.updated': t('audit_contract_updated'),
  'contract.deleted': t('audit_contract_deleted'),
  'workspace.created': t('audit_workspace_created'),
  'workspace.activated': t('audit_workspace_activated'),
  'payment.submitted': t('audit_payment_submitted'),
  'payment.approved': t('audit_payment_approved'),
  'payment.rejected': t('audit_payment_rejected'),
  'approval.created': t('audit_approval_created'),
  'approval.approved': t('audit_approval_approved'),
  'approval.rejected': t('audit_approval_rejected'),
  'approval.edit_requested': t('audit_approval_edit_requested'),
  'file.uploaded': t('audit_file_uploaded'),
  'file.approved': t('audit_file_approved'),
  'file.rejected': t('audit_file_rejected'),
  'login': t('audit_login'),
  'meeting.created': t('audit_meeting_created'),
  'meeting.updated': t('audit_meeting_updated'),
  'meeting.deleted': t('audit_meeting_deleted'),
  'client.created': t('audit_client_created'),
  'client.deleted': t('audit_client_deleted'),
  'chat.responded.approved': t('audit_chat_responded_approved'),
  'chat.responded.edit_requested': t('audit_chat_responded_edit_requested'),
});

function getActionBadgeClass(action: string): string {
  if (action.startsWith('contract.')) return 'ab-contract';
  if (action.startsWith('payment.')) return 'ab-payment';
  if (action.startsWith('client.')) return 'ab-client';
  if (action.startsWith('approval.')) return 'ab-approval';
  if (action.startsWith('login')) return 'ab-login';
  if (action.startsWith('meeting.')) return 'ab-meeting';
  if (action.startsWith('file.')) return 'ab-file';
  if (action.startsWith('workspace.')) return 'ab-workspace';
  return 'ab-default';
}

function resolveActor(log: AuditLog): { name: string; isClient: boolean } {
  if (log.user?.name) return { name: log.user.name, isClient: false };
  if (log.client?.company_name) return { name: log.client.company_name, isClient: true };
  if (log.client?.contact_person) return { name: log.client.contact_person, isClient: true };
  if (log.client?.name) return { name: log.client.name, isClient: true };
  const auditable = log.auditable;
  const type = log.auditable_type || '';
  if (type.includes('Client') && (auditable?.company_name || auditable?.contact_person || auditable?.name)) {
    return { name: auditable.company_name || auditable.contact_person || auditable.name, isClient: true };
  }
  if ((type.includes('Contract') || type.includes('Payment') || type.includes('Approval') || type.includes('ChatMessage')) && auditable?.workspace?.client?.company_name) {
    return { name: auditable.workspace.client.company_name, isClient: true };
  }
  return { name: '—', isClient: false };
}

function resolveClientName(log: AuditLog): string {
  if (log.client?.company_name) return log.client.company_name;
  if (log.client?.name) return log.client.name;
  const auditable = log.auditable;
  if (!auditable) return '—';
  const type = log.auditable_type || '';
  if (type.includes('Client')) return auditable.company_name || auditable.name || '—';
  if (type.includes('Contract') || type.includes('Payment') || type.includes('Meeting') || type.includes('Approval') || type.includes('FileEntry')) {
    return auditable.workspace?.client?.company_name || '—';
  }
  if (type.includes('Workspace')) return auditable.client?.company_name || '—';
  return '—';
}

function resolveEntityName(log: AuditLog, t: (key: string) => string): string {
  const auditable = log.auditable;
  if (!auditable) return '—';
  const type = log.auditable_type || '';
  if (type.includes('Contract')) return `${t('contract_hash')}${auditable.id}`;
  if (type.includes('Payment')) return `${t('payment_hash')}${auditable.id} — ${auditable.amount ? `${Number(auditable.amount).toLocaleString()} ${t('currency_egp')}` : ''}`;
  if (type.includes('Client')) return auditable.company_name || auditable.name || '—';
  if (type.includes('Meeting')) return auditable.title || t('meeting_label');
  if (type.includes('Approval')) return `${t('request_hash')}${auditable.id}`;
  if (type.includes('FileEntry')) return auditable.file_name || t('file_label');
  if (type.includes('Workspace')) return `${t('space_hash')}${auditable.id}`;
  return `#${auditable.id || '?'}`;
}

function resolveClientType(log: AuditLog): string | null {
  if (log.client?.client_type) return log.client.client_type;
  const auditable = log.auditable;
  if (!auditable) return null;
  const type = log.auditable_type || '';
  if (type.includes('Client')) return auditable.client_type || null;
  if (type.includes('Contract') || type.includes('Payment') || type.includes('Meeting') || type.includes('Approval') || type.includes('FileEntry')) {
    return auditable.workspace?.client?.client_type || null;
  }
  if (type.includes('Workspace')) return auditable.client?.client_type || null;
  return null;
}

function formatDateTime(dateStr: string, locale: string, t: (key: string) => string): { date: string; time: string } {
  if (!dateStr) return { date: '—', time: '' };
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const logDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - logDay.getTime()) / (1000 * 60 * 60 * 24));

  let date: string;
  if (diffDays === 0) date = t('today');
  else if (diffDays === 1) date = t('yesterday');
  else date = d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  const time = d.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

function getAvatarColors(name: string): { bg: string; border: string; text: string } {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const palettes = [
    { bg: 'rgba(148,20,20,0.16)', border: 'rgba(148,20,20,0.32)', text: 'var(--color-gold-text)' },
    { bg: 'rgba(167,139,250,0.16)', border: 'rgba(167,139,250,0.32)', text: 'var(--color-status-purple)' },
    { bg: 'rgba(96,165,250,0.16)', border: 'rgba(96,165,250,0.32)', text: 'var(--color-status-blue)' },
    { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: 'var(--color-success-text)' },
    { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.3)', text: 'var(--color-status-orange)' },
    { bg: 'rgba(212,175,55,0.13)', border: 'rgba(212,175,55,0.28)', text: 'var(--color-gold-text)' },
  ];
  return palettes[hash % palettes.length];
}

export default function AuditLogPage() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const ACTION_LABELS = ACTION_LABELS_FN(t);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ search: '', action: '', user_id: '', date_from: '', date_to: '' });
  const [users, setUsers] = useState<User[]>([]);
  const isSA = getUser()?.role === 'super_admin';

  const fetchLogs = (p: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    params.set('page', String(p));
    api.get(`/audit-logs?${params.toString()}`).then((res) => {
      const paginated = res.data?.logs;
      setLogs(paginated?.data || []);
      setTotalPages(paginated?.last_page || 1);
      setTotal(paginated?.total || 0);
    }).catch((err) => reportError('AuditLogPage.fetchLogs', err)).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs(1);
    setPage(1);
    api.get('/users').then(({ data }) => setUsers(Array.isArray(data) ? data : data.users || [])).catch((err) => reportError('AuditLogPage.loadUsers', err));
  }, []);

  const applyFilters = () => { setPage(1); fetchLogs(1); };

  const generatePageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold font-display">{t('audit_title')}</h2>
          <span className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{t('audit_total_events', { count: total })}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative">
          <Search size={12} strokeWidth={1.5} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            placeholder={t('audit_search_placeholder')}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
            className="bg-white/[0.04] border border-[var(--color-card-border)] rounded-full px-8 py-1.5 text-[length:var(--fs-1)] text-[var(--color-foreground)] w-[160px] outline-none focus:border-[var(--color-gold)]"
          />
        </div>
        <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          className="bg-white/[0.04] border border-[var(--color-card-border)] rounded-lg px-3 py-1.5 text-[length:var(--fs-1)] text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)]">
          <option value="">{t('audit_all_events')}</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select value={filters.user_id} onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
          className="bg-white/[0.04] border border-[var(--color-card-border)] rounded-lg px-3 py-1.5 text-[length:var(--fs-1)] text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)]">
          <option value="">{t('audit_all_users')}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
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

      {/* Table */}
      <div className="audit-card">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">{t('audit_no_logs')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>{t('audit_col_id')}</th>
                    <th>{t('audit_col_event')}</th>
                    <th>{t('audit_col_user')}</th>
                    <th>{t('audit_col_entity')}</th>
                    <th>{t('audit_col_ip')}</th>
                    <th>{t('audit_col_datetime')}</th>
                    <th>{t('audit_col_details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const { date, time } = formatDateTime(log.created_at, locale, t);
                    const actor = resolveActor(log);
                    const colors = getAvatarColors(actor.name === '—' ? '?' : actor.name);
                    const entityName = resolveEntityName(log, t);
                    return (
                      <tr key={log.id}>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>{log.id}</td>
                        <td>
                          <span className={`action-badge ${getActionBadgeClass(log.action)}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td>
                          <div className="td-user">
                            <div className="td-av" style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}>
                              {actor.name !== '—' ? actor.name.slice(0, 2) : '?'}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{actor.name}</span>
                              {actor.isClient && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                                  {locale === 'ar' ? 'عميل' : 'Client'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>{entityName}</td>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: 11, direction: 'ltr', textAlign: 'right' }}>
                          {log.ip_address || '—'}
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {date}, {time}
                        </td>
                        <td>
                          <span style={{ color: 'var(--color-status-blue)', fontSize: 11, cursor: 'pointer' }}>{t('audit_view')} ←</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="audit-pagination">
                <span className="pag-info">{t('audit_page_info', { page, totalPages, total })}</span>
                <div className="flex gap-1 me-auto items-center">
                  <button
                    onClick={() => { const p = page - 1; setPage(p); fetchLogs(p); }}
                    disabled={page <= 1}
                    className="pag-btn"
                  >
                    {t('audit_previous')}
                  </button>
                  {generatePageNumbers().map((p, i) =>
                    p === 'ellipsis' ? (
                      <span key={`e${i}`} style={{ color: 'var(--color-text-secondary)', padding: '5px 4px', fontSize: 12 }}>…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => { setPage(p); fetchLogs(p); }}
                        className="pag-btn"
                        style={p === page ? { background: 'var(--color-crimson-soft)', borderColor: 'var(--color-crimson-border)', color: 'var(--color-foreground)' } : {}}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => { const p = page + 1; setPage(p); fetchLogs(p); }}
                    disabled={page >= totalPages}
                    className="pag-btn"
                  >
                    {t('audit_next')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .audit-card {
          background: var(--color-card);
          border: 1px solid var(--color-card-border);
          border-radius: 12px;
          overflow: hidden;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          text-align: right;
          padding: 9px 14px;
          font-size: 10px;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--color-card-border);
          font-weight: 500;
          white-space: nowrap;
        }
        td {
          padding: 10px 14px;
          font-size: 11.5px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        tbody tr:hover td { background: rgba(255,255,255,0.02); }
        tbody tr:last-child td { border-bottom: none; }
        .action-badge {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 9.5px;
          font-weight: 600;
          white-space: nowrap;
        }
        .ab-contract { background: rgba(96,165,250,0.12); color: var(--color-status-blue); }
        .ab-payment { background: rgba(212,175,55,0.13); color: var(--color-gold-text); }
        .ab-client { background: rgba(34,197,94,0.1); color: var(--color-success-text); }
        .ab-approval { background: rgba(167,139,250,0.12); color: var(--color-status-purple); }
        .ab-login { background: rgba(251,146,60,0.1); color: var(--color-status-orange); }
        .ab-meeting { background: rgba(148,20,20,0.16); color: var(--color-primary); }
        .ab-file { background: rgba(96,165,250,0.1); color: var(--color-status-blue); }
        .ab-workspace { background: rgba(167,139,250,0.1); color: var(--color-status-purple); }
        .ab-default { background: rgba(255,255,255,0.05); color: var(--color-text-secondary); }
        .td-user {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .td-av {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .audit-pagination {
          padding: 12px 16px;
          border-top: 1px solid var(--color-card-border);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pag-btn {
          padding: 5px 12px;
          border-radius: 7px;
          border: 1px solid var(--color-card-border);
          background: transparent;
          color: var(--color-text-secondary);
          font-size: 11px;
          cursor: pointer;
          font-family: Tajawal;
        }
        .pag-btn:hover:not(:disabled) {
          background: var(--color-crimson-soft);
          border-color: var(--color-crimson-border);
          color: var(--color-foreground);
        }
        .pag-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .pag-info {
          font-size: 11px;
          color: var(--color-text-secondary);
        }
      `}</style>
    </div>
  );
}
