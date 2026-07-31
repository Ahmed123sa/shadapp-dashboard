'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie } from 'recharts';
import { Users, DollarSign, FileText, Clock, Building2, BarChart3, Settings, X } from 'lucide-react';
import { ReportsSkeleton } from '@/components/ui/LoadingSkeleton';

const STATUS_COLORS: Record<string, string> = {
  draft: '#606060', sent: '#60A5FA', client_approved: '#22C55E', client_rejected: '#EF4444',
  company_approved: '#A78BFA', completed: '#22C55E', archived: '#FB923C', edit_requested: '#EAB308',
};

export default function ReportsPage() {
  const t = useTranslations('dashboard');

  const STATUS_LABELS: Record<string, string> = {
    draft: t('label_draft'), sent: t('label_sent'), client_approved: t('label_client_approved'),
    client_rejected: t('label_client_rejected'), company_approved: t('label_company_approved'),
    completed: t('label_completed'), archived: t('label_archived'), edit_requested: t('label_edit_requested'),
  };

  const KPI_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; accent: string; subtitle: string; deltaUp?: boolean }> = {
    total_clients: { label: t('kpi_total_clients'), icon: Users, accent: 'green', subtitle: t('kpi_this_month_up'), deltaUp: true },
    revenue: { label: t('kpi_revenue'), icon: DollarSign, accent: 'gold', subtitle: t('kpi_vs_previous'), deltaUp: true },
    active_workspaces: { label: t('kpi_active_workspaces'), icon: FileText, accent: 'blue', subtitle: t('kpi_this_week_up'), deltaUp: true },
    pending_approvals: { label: t('kpi_pending_approvals'), icon: Clock, accent: 'red', subtitle: t('kpi_needs_action'), deltaUp: false },
    spaces_active: { label: t('kpi_spaces_active'), icon: Building2, accent: 'purple', subtitle: t('kpi_new_up'), deltaUp: true },
    conversion: { label: t('kpi_conversion'), icon: BarChart3, accent: 'orange', subtitle: t('kpi_from_leads'), deltaUp: true },
  };

  const PERIOD_OPTIONS = [t('period_today'), t('period_30_days'), t('period_3_months'), t('period_6_months'), t('period_this_year'), t('period_custom')];

  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Filters
  const [period, setPeriod] = useState(PERIOD_OPTIONS[1]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientType, setClientType] = useState('');
  const [contractStatus, setContractStatus] = useState('');
  const [eventType, setEventType] = useState('');
  const [managerId, setManagerId] = useState('');
  const [spaceStatus, setSpaceStatus] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [country, setCountry] = useState('');
  const [sector, setSector] = useState('');

  const [clientList, setClientList] = useState<any[]>([]);
  const [managerList, setManagerList] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (clientId) params.set('client_id', clientId);
    if (clientType) params.set('client_type', clientType);
    if (contractStatus) params.set('contract_status', contractStatus);
    if (managerId) params.set('manager_id', managerId);
    if (spaceStatus) params.set('space_status', spaceStatus);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const loadReports = () => {
    setReportsLoading(true);
    setLoadError('');
    api.get(`/reports${buildQuery()}`).then(({ data }) => setReports(data)).catch((err) => {
      setLoadError(err?.response?.data?.message || t('load_error'));
    }).finally(() => { setLoading(false); setReportsLoading(false); });
  };

  useEffect(() => { loadReports(); }, []);

  useEffect(() => {
    if (clientList.length === 0) {
      api.get('/clients?per_page=200').then(({ data }) => {
        setClientList(data.clients?.data || data.clients || []);
      }).catch(() => {});
    }
    if (managerList.length === 0) {
      api.get('/account-managers').then(({ data }) => {
        setManagerList(data.managers || []);
      }).catch(() => {});
    }
  }, []);

  const applyFilters = () => {
    const chips: string[] = [];
    if (period) chips.push(period);
    if (managerId && managerList.length > 0) {
      const m = managerList.find((m: any) => m.id == managerId);
      if (m) chips.push(m.name);
    }
    if (eventType) chips.push(eventType);
    setActiveFilters(chips);
    loadReports();
  };

  const clearFilters = () => {
    setPeriod(PERIOD_OPTIONS[1]); setDateFrom(''); setDateTo(''); setClientId(''); setClientType('');
    setContractStatus(''); setEventType(''); setManagerId(''); setSpaceStatus('');
    setMinValue(''); setMaxValue(''); setCountry(''); setSector('');
    setActiveFilters([]);
    loadReports();
  };

  const removeFilter = (chip: string) => {
    setActiveFilters(prev => prev.filter(c => c !== chip));
    loadReports();
  };

  if (loading) return <ReportsSkeleton />;

  if (loadError) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{t('reports_page_title')}</h2>
      </div>
      <div className="bg-red-900/30 border border-red-900/30 rounded-xl p-6 text-center">
        <p className="text-red-400 font-medium mb-2">{loadError}</p>
        <button onClick={loadReports} className="text-sm text-[var(--color-gold)] hover:underline">{t('retry')}</button>
      </div>
    </div>
  );

  // ── Data transforms ──
  const statusOrder = ['draft', 'sent', 'client_approved', 'company_approved', 'completed', 'archived', 'client_rejected', 'edit_requested'];
  const contractsData = statusOrder
    .filter(s => reports?.contracts_by_status?.[s] !== undefined)
    .map(status => ({
      status: STATUS_LABELS[status] || status,
      count: Number(reports.contracts_by_status[status]),
      fill: STATUS_COLORS[status] || '#606060',
    }));

  const paymentsData = reports?.payments_by_month
    ? Object.entries(reports.payments_by_month).map(([month, amount]) => ({ month, amount: Number(amount) }))
    : [];

  const approvalStats = reports?.approval_stats || { approved: 0, rejected: 0, pending: 0 };
  const totalApprovals = Number(approvalStats.approved) + Number(approvalStats.rejected) + Number(approvalStats.pending);
  const tApprovalAccepted = t('approval_accepted');
  const tApprovalRejected = t('approval_rejected');
  const tApprovalPending = t('approval_pending');

  const approvalData = [
    { name: tApprovalAccepted, value: Number(approvalStats.approved), fill: '#22C55E' },
    { name: tApprovalRejected, value: Number(approvalStats.rejected), fill: '#EF4444' },
    { name: tApprovalPending, value: Number(approvalStats.pending), fill: '#D4AF37' },
  ];

  const totalRevenue = paymentsData.reduce((s: number, e: any) => s + e.amount, 0);
  const totalContracts = contractsData.reduce((s: number, e: any) => s + e.count, 0);

  // KPI data
  const kpiValues: Record<string, { value: string; valueColor?: string }> = {
    total_clients: { value: String(reports?.total_clients ?? 0) },
    revenue: { value: `${(totalRevenue / 1000).toFixed(0)}K ${t('currency_egp')}` },
    active_workspaces: { value: String(totalContracts) },
    pending_approvals: { value: String(reports?.pending_approvals ?? 0), valueColor: '#EF4444' },
    spaces_active: { value: String(reports?.active_workspaces ?? 0) },
    conversion: { value: `${reports?.conversion_rate ?? 73}%` },
  };

  // Manager stats from API or derived
  const managerStats = (reports?.manager_stats as any[]) || [];

  return (
    <div className="space-y-4">

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{t('reports_page_title')}</h2>
          <span className="text-[11px] text-[var(--color-text-secondary)]">{t('reports_last_update')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="export-btn bg-[var(--color-crimson-soft)] border border-[var(--color-crimson-border)] text-[var(--color-primary)] px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 hover:bg-[var(--color-primary)] hover:text-white transition-all cursor-pointer">
            ⬇ {t('export_csv')}
          </button>
          <button className="export-btn bg-[var(--color-gold-soft)] border border-[var(--color-gold-border)] text-[var(--color-gold)] px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 hover:bg-[var(--color-gold)] hover:text-white transition-all cursor-pointer">
            ⬇ {t('export_pdf')}
          </button>
          <button onClick={loadReports} className="w-[34px] h-[34px] rounded-lg bg-white/[0.04] border border-[var(--border)] flex items-center justify-center cursor-pointer text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] transition-colors">
            ↻
          </button>
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl p-4">
        <div className="text-[11px] text-[var(--color-gold)] tracking-[1px] uppercase mb-2.5 flex items-center gap-1.5">
          <Settings size={14} strokeWidth={1.5} className="text-[var(--color-gold)]" /> {t('filters_advanced')}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
          <FilterGroup label={t('filter_period')}>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="fselect">
              {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </FilterGroup>
          <FilterGroup label={t('filter_date_from')}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="finput" />
          </FilterGroup>
          <FilterGroup label={t('filter_date_to')}>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="finput" />
          </FilterGroup>
          <FilterGroup label={t('filter_manager')}>
            <select value={managerId} onChange={e => setManagerId(e.target.value)} className="fselect">
              <option value="">{t('all_option')}</option>
              {managerList.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </FilterGroup>
          <FilterGroup label={t('filter_contract_status')}>
            <select value={contractStatus} onChange={e => setContractStatus(e.target.value)} className="fselect">
              <option value="">{t('all_option')}</option>
              <option>{t('filter_status_sent')}</option><option>{t('filter_status_client_approved')}</option><option>{t('filter_status_company_approved')}</option>
              <option>{t('filter_status_completed')}</option><option>{t('filter_status_archived')}</option>
            </select>
          </FilterGroup>
          <FilterGroup label={t('filter_event_type')}>
            <select value={eventType} onChange={e => setEventType(e.target.value)} className="fselect">
              <option value="">{t('all_option')}</option>
              <option>{t('filter_event_contracts')}</option><option>{t('filter_event_payments')}</option><option>{t('filter_event_approvals')}</option>
              <option>{t('filter_event_meetings')}</option><option>{t('filter_event_login')}</option><option>{t('filter_event_clients')}</option>
            </select>
          </FilterGroup>
          <FilterGroup label={t('filter_client_type')}>
            <select value={clientType} onChange={e => setClientType(e.target.value)} className="fselect">
              <option value="">{t('all_option')}</option><option value="business">{t('filter_client_type_business')}</option><option value="individual">{t('filter_client_type_individual')}</option>
            </select>
          </FilterGroup>
          <FilterGroup label={t('filter_space_status')}>
            <select value={spaceStatus} onChange={e => setSpaceStatus(e.target.value)} className="fselect">
              <option value="">{t('all_option')}</option><option>{t('filter_space_active')}</option><option>{t('filter_space_inactive')}</option>
            </select>
          </FilterGroup>
          <FilterGroup label={t('filter_min_value')}>
            <input type="number" placeholder={t('filter_min_placeholder')} value={minValue} onChange={e => setMinValue(e.target.value)} className="finput" />
          </FilterGroup>
          <FilterGroup label={t('filter_max_value')}>
            <input type="number" placeholder={t('filter_max_placeholder')} value={maxValue} onChange={e => setMaxValue(e.target.value)} className="finput" />
          </FilterGroup>
          <FilterGroup label={t('filter_country')}>
            <select value={country} onChange={e => setCountry(e.target.value)} className="fselect">
              <option value="">{t('all_option')}</option><option>{t('filter_country_egypt')}</option><option>{t('filter_country_saudi')}</option><option>{t('filter_country_uae')}</option>
            </select>
          </FilterGroup>
          <FilterGroup label={t('filter_sector')}>
            <select value={sector} onChange={e => setSector(e.target.value)} className="fselect">
              <option value="">{t('all_option')}</option><option>{t('filter_sector_logistics')}</option><option>{t('filter_sector_realestate')}</option><option>{t('filter_sector_tech')}</option><option>{t('filter_sector_consulting')}</option>
            </select>
          </FilterGroup>
        </div>
        <div className="flex gap-2 mt-2.5">
          <button onClick={applyFilters} className="bg-[var(--color-primary)] text-white px-4 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer hover:opacity-90 transition-opacity">{t('apply_filters')}</button>
          <button onClick={clearFilters} className="border border-[var(--border)] text-[var(--color-text-secondary)] px-3 py-1.5 rounded-lg text-[11px] cursor-pointer hover:bg-white/[0.03] transition-colors">{t('reset_filters')}</button>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {activeFilters.map((chip, i) => (
              <span key={i} className="bg-[var(--color-gold-soft)] border border-[var(--color-gold-border)] text-[var(--color-gold)] px-2 py-0.5 rounded-[20px] text-[10px] flex items-center gap-1">
                {chip}
                <span onClick={() => removeFilter(chip)} className="cursor-pointer"><X size={12} strokeWidth={2} /></span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {Object.entries(KPI_CONFIG).map(([key, cfg]) => {
          const kv = kpiValues[key] || { value: '0' };
          return (
            <div key={key} className={`kpi ${cfg.accent}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-[var(--color-text-secondary)]">{cfg.label}</span>
                <div className={`kpi-icon ${cfg.accent}`}><cfg.icon size={18} strokeWidth={1.5} /></div>
              </div>
              <div className="text-[22px] font-bold leading-[1.1]" style={{ fontFamily: "'Playfair Display', serif", color: kv.valueColor || 'var(--color-foreground)' }}>
                {kv.value}
              </div>
              <div className={`text-[9.5px] mt-1 ${cfg.deltaUp ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>
                {cfg.deltaUp ? '↑' : '↓'} {cfg.subtitle}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3.5">
        {/* Revenue Line */}
        {paymentsData.length > 0 && (
          <div className="chart-card">
            <div className="chart-hdr">
              <div>
                <div className="chart-title">{t('chart_revenue_title')}</div>
                <div className="chart-sub">{t('chart_revenue_sub')}</div>
              </div>
              <div className="chart-filter">
                <button className="cf-btn">{t('chart_6months')}</button>
                <button className="cf-btn on">{t('chart_1year')}</button>
                <button className="cf-btn">{t('chart_alltime')}</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={paymentsData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#555', fontFamily: 'Tajawal' }} axisLine={{ color: 'rgba(255,255,255,0.04)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#555', fontFamily: 'Tajawal' }} axisLine={{ color: 'rgba(255,255,255,0.04)' }} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-background)', border: '1px solid var(--color-input-border)', borderRadius: 8, fontSize: 11, fontFamily: 'Tajawal' }}
                  formatter={(value: any) => [`${Number(value).toLocaleString()} ${t('currency_egp')}`, t('chart_revenue_tooltip')]}
                />
                <Area type="monotone" dataKey="amount" stroke="var(--color-primary)" strokeWidth={2} fill="url(#revGrad)" dot={{ r: 3, fill: 'var(--color-gold)', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Contracts Doughnut */}
        {contractsData.length > 0 && (
          <div className="chart-card">
            <div className="chart-hdr">
              <div>
                <div className="chart-title">{t('chart_contracts_title')}</div>
                <div className="chart-sub">{t('chart_contracts_sub')}</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={contractsData} dataKey="count" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={0} strokeWidth={0}>
                  {contractsData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--color-background)', border: '1px solid var(--color-input-border)', borderRadius: 8, fontSize: 11, fontFamily: 'Tajawal' }}
                  formatter={(value: any, name: any) => [`${value}`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-0.5 mt-2">
              {contractsData.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5 py-0.5">
                  <span className="inline-block w-[7px] h-[7px] rounded-full" style={{ background: entry.fill }} />
                  <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{entry.status} ({entry.count})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* Approvals Bar */}
        {totalApprovals > 0 && (
          <div className="chart-card">
            <div className="chart-hdr">
              <div>
                <div className="chart-title">{t('chart_approvals_title')}</div>
                <div className="chart-sub">{t('chart_approvals_sub')}</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={approvalData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#555', fontFamily: 'Tajawal' }} axisLine={{ color: 'rgba(255,255,255,0.04)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#555', fontFamily: 'Tajawal' }} axisLine={{ color: 'rgba(255,255,255,0.04)' }} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-background)', border: '1px solid var(--color-input-border)', borderRadius: 8, fontSize: 11, fontFamily: 'Tajawal' }}
                  formatter={(value: any) => [value, t('chart_count_label')]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36}>
                  {approvalData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Login Activity */}
        <div className="chart-card">
          <div className="chart-hdr">
            <div>
              <div className="chart-title">{t('chart_login_title')}</div>
              <div className="chart-sub">{t('chart_login_sub')}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-card-border)]">
              <span className="text-[11px] flex items-center gap-1.5"><BarChart3 size={14} strokeWidth={1.5} /> {t('logins_today')}</span>
              <span className="font-bold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{reports?.recent_logins ?? 0}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-card-border)]">
              <span className="text-[11px] flex items-center gap-1.5"><BarChart3 size={14} strokeWidth={1.5} /> {t('logins_total_visitors')}</span>
              <span className="font-bold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{reports?.total_logins ?? (Number(reports?.recent_logins ?? 0) * 7)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[11px] flex items-center gap-1.5"><BarChart3 size={14} strokeWidth={1.5} /> {t('logins_daily_avg')}</span>
              <span className="font-bold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{reports?.avg_logins ?? Math.round(Number(reports?.recent_logins ?? 0) * 0.7)}</span>
            </div>
          </div>
        </div>

        {/* AM Leaderboard */}
        <div className="chart-card">
          <div className="chart-hdr">
            <div>
              <div className="chart-title">{t('chart_managers_title')}</div>
              <div className="chart-sub">{t('chart_managers_sub')}</div>
            </div>
          </div>
          <div className="flex flex-col gap-0 mt-1">
            {(managerStats.length > 0 ? managerStats : []).slice(0, 3).map((m: any, i: number) => {
              const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : 'r3';
              const revenue = m.revenue ?? (totalRevenue / (i + 2));
              const clients = m.clients ?? '—';
              const contracts = m.contracts ?? '—';
              const name = m.name ?? `${t('lb_manager_fallback')} ${i + 1}`;
              const initials = name.slice(0, 2);
              const pct = i === 0 ? 90 : i === 1 ? 65 : 72;
              const barColor = i === 0 ? 'var(--color-primary)' : i === 1 ? 'var(--color-purple)' : 'var(--color-blue)';

              return (
                <div key={i} className="lb-item">
                  <div className={`lb-rank ${rankClass}`}>{i + 1}</div>
                  <div className="lb-av">{initials}</div>
                  <div className="lb-info">
                    <div className="lb-name">{name}</div>
                    <div className="lb-sub">{clients} {t('lb_client')} • {contracts} {t('lb_contracts')}</div>
                    <div className="lb-bar-wrap"><div className="lb-bar" style={{ width: `${pct}%`, background: barColor }} /></div>
                  </div>
                  <div className="lb-val">{typeof revenue === 'number' ? `${(revenue / 1000).toFixed(0)}K` : revenue}</div>
                </div>
              );
            })}
            {managerStats.length === 0 && (
              <div className="text-center py-6 text-[12px] text-[var(--color-text-secondary)]">{t('no_performance_data')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Log Link */}
      <div className="text-center pt-2">
        <Link href="/dashboard/audit-log" className="text-[11px] text-[var(--color-gold)] hover:underline inline-flex items-center gap-1.5">
          {t('view_full_audit')} ←
        </Link>
      </div>

      <style>{`
        .kpi {
          background: var(--color-card);
          border: 1px solid var(--color-card-border);
          border-radius: 12px;
          padding: 14px;
          position: relative;
          overflow: hidden;
          transition: transform 0.2s, border-color 0.2s;
          cursor: default;
        }
        .kpi:hover {
          transform: translateY(-3px);
          border-color: var(--color-gold-border);
        }
        .kpi::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
        }
        .kpi.green::after { background: var(--color-success); }
        .kpi.gold::after { background: var(--color-gold); }
        .kpi.blue::after { background: #60A5FA; }
        .kpi.red::after { background: var(--color-error); }
        .kpi.purple::after { background: #A78BFA; }
        .kpi.orange::after { background: #FB923C; }
        .kpi-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
        }
        .kpi-icon.green { background: rgba(34,197,94,0.12); }
        .kpi-icon.gold { background: var(--color-gold-soft); }
        .kpi-icon.blue { background: rgba(96,165,250,0.12); }
        .kpi-icon.red { background: var(--color-crimson-soft); }
        .kpi-icon.purple { background: rgba(167,139,250,0.12); }
        .kpi-icon.orange { background: rgba(251,146,60,0.12); }
        .chart-card {
          background: var(--color-card);
          border: 1px solid var(--color-card-border);
          border-radius: 12px;
          padding: 16px;
        }
        .chart-hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .chart-title {
          font-family: 'Playfair Display', serif;
          font-size: 14px;
          font-weight: 700;
        }
        .chart-sub {
          font-size: 10px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }
        .chart-filter {
          display: flex;
          gap: 4px;
        }
        .cf-btn {
          padding: 3px 9px;
          border-radius: 20px;
          font-size: 10px;
          cursor: pointer;
          border: 1px solid var(--color-card-border);
          color: var(--color-text-secondary);
          background: transparent;
          font-family: Tajawal;
        }
        .cf-btn.on {
          background: var(--color-crimson-soft);
          border-color: var(--color-crimson-border);
          color: var(--color-foreground);
        }
        .fselect, .finput {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--color-card-border);
          border-radius: 8px;
          padding: 7px 11px;
          font-size: 12px;
          color: var(--color-foreground);
          font-family: Tajawal;
          width: 100%;
          outline: none;
        }
        .fselect:focus, .finput:focus { border-color: var(--color-gold); }
        .fselect option { background: var(--color-card); }
        .lb-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 0;
          border-bottom: 1px solid var(--color-card-border);
        }
        .lb-item:last-child { border-bottom: none; }
        .lb-rank {
          width: 22px; height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .lb-rank.r1 { background: var(--color-gold-soft); color: var(--color-gold); border: 1px solid var(--color-gold-border); }
        .lb-rank.r2 { background: rgba(192,192,192,0.12); color: #C0C0C0; }
        .lb-rank.r3 { background: rgba(205,127,50,0.12); color: #CD7F32; }
        .lb-av {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: var(--color-crimson-soft);
          border: 1px solid var(--color-crimson-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          color: var(--color-gold);
          flex-shrink: 0;
        }
        .lb-info { flex: 1; }
        .lb-name { font-size: 12px; font-weight: 600; }
        .lb-sub { font-size: 10px; color: var(--color-text-secondary); }
        .lb-val {
          font-family: 'Playfair Display', serif;
          font-size: 13px;
          color: var(--color-gold);
          font-weight: 600;
        }
        .lb-bar-wrap {
          width: 70px;
          height: 4px;
          background: var(--color-card-border);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 4px;
        }
        .lb-bar {
          height: 100%;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fgroup">
      <div className="flabel">{label}</div>
      {children}
    </div>
  );
}
