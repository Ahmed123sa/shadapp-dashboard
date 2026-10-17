'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { reportError } from '@/lib/error-reporting';
import { resolveFileUrl } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';

// The "Team" tab inside a client's workspace (STAFF_TEAMS_PLAN.md ف٥): the
// client's account manager — or the super admin — picks which company staff
// members work on this client. Staff are company-wide, so every active staff
// member is listed, each with an assign / unassign button. The backend
// (WorkspaceStaffController) decides who may do this; this is the UI for it.

interface StaffRow {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  assigned: boolean;
}

export default function ClientStaffTab({ wsId }: { wsId: number }) {
  const t = useTranslations('dashboard');
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get(`/workspaces/${wsId}/staff`)
      .then(({ data }) => { setStaff(data.staff || []); setError(''); })
      .catch((err) => { reportError('ClientStaffTab.load', err); setError(t('client_team_load_failed')); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  const toggle = async (m: StaffRow) => {
    setBusyId(m.id);
    setError('');
    try {
      if (m.assigned) {
        await api.delete(`/workspaces/${wsId}/staff/${m.id}`);
      } else {
        await api.put(`/workspaces/${wsId}/staff/${m.id}`);
      }
      setStaff((prev) => prev.map((s) => (s.id === m.id ? { ...s, assigned: !m.assigned } : s)));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('client_team_save_failed'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <TableSkeleton />;

  const assignedCount = staff.filter((s) => s.assigned).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">{t('client_team_hint')}</p>
      {error && <div role="alert" className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg">{error}</div>}

      {staff.length === 0 && !error && (
        <div className="text-center py-10 text-[var(--color-text-secondary)]">{t('client_team_empty')}</div>
      )}

      {staff.length > 0 && (
        <p className="text-xs text-[var(--color-text-secondary)]">{t('client_team_assigned_count', { count: assignedCount })}</p>
      )}

      <ul className="space-y-2">
        {staff.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 border border-[var(--color-card-border)] rounded-lg p-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[var(--color-input-fill)] overflow-hidden flex items-center justify-center text-sm shrink-0">
                {m.avatar_url ? <img src={resolveFileUrl(m.avatar_url)} alt="" className="w-full h-full object-cover" /> : (m.name?.[0] || '?')}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{m.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)] truncate" dir="ltr">{m.email}</p>
              </div>
            </div>
            <button
              onClick={() => toggle(m)}
              disabled={busyId === m.id}
              aria-label={`${m.assigned ? t('client_team_unassign') : t('client_team_assign')} ${m.name}`}
              className={`text-xs rounded px-3 py-1.5 border disabled:opacity-50 shrink-0 ${
                m.assigned
                  ? 'text-red-400 border-red-900/30 hover:underline'
                  : 'text-green-400 border-green-900/30 hover:underline'
              }`}
            >
              {m.assigned ? t('client_team_unassign') : t('client_team_assign')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
