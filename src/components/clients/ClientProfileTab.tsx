'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { MapPin, Pencil, ExternalLink, FileText, CreditCard, Stamp, CalendarDays, ChevronLeft, Map } from 'lucide-react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClientTypeBadge } from '@/components/ui/ClientTypeBadge';
import LocationPickerModal from './LocationPickerModal';
import { reportError } from '@/lib/error-reporting';
import { resolveFileUrl } from '@/lib/utils';

type ActivityEvent = {
  id: string;
  kind: string;
  timestamp: string;
  ref_type: 'contract' | 'payment' | 'approval' | 'meeting';
  ref_id: number;
  title: string;
  amount?: number;
  currency?: string;
};

const KIND_TAB: Record<string, string> = {
  contract: 'contracts',
  payment: 'payments',
  approval: 'approvals',
  meeting: 'meetings',
};

const KIND_ICON: Record<string, React.ReactNode> = {
  contract: <FileText size={14} strokeWidth={1.5} />,
  payment: <CreditCard size={14} strokeWidth={1.5} />,
  approval: <Stamp size={14} strokeWidth={1.5} />,
  meeting: <CalendarDays size={14} strokeWidth={1.5} />,
};

export default function ClientProfileTab({ clientId, onNavigate }: { clientId: number; onNavigate?: (tab: string) => void }) {
  const t = useTranslations('dashboard');
  const [profile, setProfile] = useState<any>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [msg, setMsg] = useState('');

  const isAM = getUser()?.role === 'account_manager';

  const load = useCallback(() => {
    api.get(`/clients/${clientId}/profile`).then(({ data }) => setProfile(data)).catch((err) => reportError('ClientProfileTab.loadProfile', err)).finally(() => setLoading(false));
  }, [clientId]);

  const loadActivity = useCallback(() => {
    setActivityLoading(true);
    api.get(`/clients/${clientId}/activity`).then(({ data }) => setActivity(data.activity || [])).catch((err) => reportError('ClientProfileTab.loadActivity', err)).finally(() => setActivityLoading(false));
  }, [clientId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadActivity(); }, [loadActivity]);

  const confirmLocation = async (lat: number, lng: number, address: string) => {
    try {
      await api.post(`/clients/${clientId}/location`, { latitude: lat, longitude: lng, address: address || undefined });
      setMsg(t('profile_check_in_success'));
      setShowLocationPicker(false);
      load();
    } catch {
      setMsg(t('profile_check_in_failed'));
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (!profile) return <EmptyState message={t('not_found')} />;

  const c = profile.client;
  const s = profile.stats;
  const loc = profile.location;
  const hasLocation = loc?.latitude && loc?.longitude;
  const updatedAt = loc?.updated_at ? new Date(loc.updated_at).toLocaleString() : '';
  const address = c.address || loc?.address || '';
  const mapsUrl = loc?.maps_url || '';
  const avatar = resolveFileUrl(c.avatar_url);

  const go = (e: ActivityEvent) => {
    const tab = KIND_TAB[e.ref_type];
    if (tab && onNavigate) onNavigate(tab);
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm">{msg}</div>
      )}

      {/* بطاقة العميل */}
      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-input-fill)] overflow-hidden border-2 border-[var(--color-card-border)] flex-shrink-0">
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl text-[var(--color-text-disabled)]">
                {c.company_name?.[0] || '?'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg truncate">{c.company_name}</h3>
              <ClientTypeBadge clientType={c.client_type} />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{c.contact_person || '—'}{c.contact_person && c.email ? ' • ' : ''}{c.email || ''}</p>
          </div>
          {isAM && (
            <Link href={`/dashboard/clients/${clientId}/settings`} className="ms-auto inline-flex items-center gap-1.5 text-xs text-[var(--color-gold)] hover:underline flex-shrink-0">
              <Pencil size={13} strokeWidth={1.5} /> {t('profile_edit')}
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[var(--color-card-border)] rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">{t('profile_total_contracts')}</p>
          <p className="text-2xl font-bold mt-1">{s.total_contracts}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{s.draft_contracts} {t('profile_draft_contracts')} • {s.sent_contracts} {t('profile_in_progress')}</p>
        </div>
        <div className="bg-[var(--color-card-border)] rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">{t('profile_completed_contracts')}</p>
          <p className="text-2xl font-bold mt-1">{s.completed_contracts}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{s.meetings_count} {t('profile_meetings')} • {s.approvals_count} {t('profile_approvals')}</p>
        </div>
        <div className="bg-[var(--color-card-border)] rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">{t('profile_total_value')}</p>
          <p className="text-2xl font-bold mt-1">{Number(s.total_contract_value || 0).toLocaleString()}</p>
        </div>
        <div className="bg-[var(--color-card-border)] rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">{t('profile_total_paid')}</p>
          <p className="text-2xl font-bold mt-1">{Number(s.total_paid || 0).toLocaleString()}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('profile_pending_payments')}: {Number(s.pending_payments || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{t('profile_contact_info')}</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-[var(--color-text-secondary)]">{t('profile_company')}</p><p className="flex items-center gap-2 mt-0.5">{c.company_name} <ClientTypeBadge clientType={c.client_type} /></p></div>
          <div><p className="text-xs text-[var(--color-text-secondary)]">{t('profile_contact_person')}</p><p className="mt-0.5">{c.contact_person || '—'}</p></div>
          <div><p className="text-xs text-[var(--color-text-secondary)]">{t('profile_email')}</p><p className="mt-0.5" dir="ltr">{c.email || '—'}</p></div>
          <div><p className="text-xs text-[var(--color-text-secondary)]">{t('profile_phone')}</p><p className="mt-0.5" dir="ltr">{c.phone || '—'}</p></div>
          <div><p className="text-xs text-[var(--color-text-secondary)]">{t('profile_country')}</p><p className="mt-0.5">{c.country || '—'}</p></div>
          <div><p className="text-xs text-[var(--color-text-secondary)]">{t('profile_industry')}</p><p className="mt-0.5">{c.industry || '—'}</p></div>
        </div>
      </div>

      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><MapPin size={16} strokeWidth={1.5} className="text-[var(--color-primary)]" /> {t('profile_location')}</h3>
          {isAM && (
            <button onClick={() => setShowLocationPicker(true)}
              className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-[var(--color-primary-dark)]">
              <Map size={13} strokeWidth={1.5} /> {t('profile_check_in')}
            </button>
          )}
        </div>
        {address ? (
          <div className="space-y-2 text-sm">
            <p className="flex items-start gap-2"><Map size={14} strokeWidth={1.5} className="text-[var(--color-text-secondary)] mt-0.5 flex-shrink-0" /> {address}</p>
            {hasLocation && (
              <>
                <p className="text-xs text-[var(--color-text-secondary)]" dir="ltr">{t('profile_latitude')}: {Number(loc.latitude).toFixed(6)} • {t('profile_longitude')}: {Number(loc.longitude).toFixed(6)}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{t('profile_last_updated')}: {updatedAt}</p>
              </>
            )}
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[var(--color-gold)] hover:underline">
                <ExternalLink size={13} strokeWidth={1.5} /> {t('profile_open_maps')}
              </a>
            )}
          </div>
        ) : hasLocation ? (
          <div className="space-y-2 text-sm">
            <p className="text-xs text-[var(--color-text-secondary)]" dir="ltr">{t('profile_latitude')}: {Number(loc.latitude).toFixed(6)} • {t('profile_longitude')}: {Number(loc.longitude).toFixed(6)}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('profile_last_updated')}: {updatedAt}</p>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[var(--color-gold)] hover:underline">
                <ExternalLink size={13} strokeWidth={1.5} /> {t('profile_open_maps')}
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">{t('profile_no_address')}</p>
        )}
      </div>

      {showLocationPicker && (
        <LocationPickerModal
          initialLat={loc?.latitude}
          initialLng={loc?.longitude}
          initialAddress={loc?.address || c.address}
          onConfirm={confirmLocation}
          onClose={() => setShowLocationPicker(false)}
        />
      )}

      {/* سجل النشاط */}
      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-5 space-y-3">
        <h3 className="font-semibold">{t('profile_activity')}</h3>
        {activityLoading ? (
          <p className="text-sm text-[var(--color-text-secondary)]">...</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{t('profile_activity_empty')}</p>
        ) : (
          <div className="divide-y divide-[var(--color-card-border)]">
            {activity.map((e) => (
              <button key={e.id} type="button"
                onClick={() => go(e)}
                className={`w-full flex items-center gap-3 py-3 text-start transition-colors ${onNavigate ? 'hover:bg-[var(--color-input-fill)] px-2 -mx-2 rounded-lg' : ''}`}>
                <span className="w-7 h-7 rounded-full bg-[var(--color-input-fill)] text-[var(--color-text-secondary)] flex items-center justify-center flex-shrink-0">
                  {KIND_ICON[e.ref_type]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{t(`activity_${e.kind}`)}</span>
                  <span className="block text-xs text-[var(--color-text-secondary)] truncate">
                    {e.title}{e.amount != null ? ` • ${Number(e.amount).toLocaleString()} ${e.currency || ''}` : ''} • {new Date(e.timestamp).toLocaleString()}
                  </span>
                </span>
                {onNavigate && <ChevronLeft size={16} strokeWidth={1.5} className="text-[var(--color-text-muted)] flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
