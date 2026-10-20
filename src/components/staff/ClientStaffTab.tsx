'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { reportError } from '@/lib/error-reporting';
import { resolveFileUrl } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import PermissionChips from '@/components/team/PermissionChips';
import LinkDrawer from '@/components/team/LinkDrawer';
import { allStaffPermissions, normalizeStaffPermissions, type StaffPermissions } from '@/lib/staff-permissions';

// The "Team" tab inside a client's workspace (STAFF_TEAMS_PLAN.md ف٥ +
// PLAN_2_MANAGER_TEAMS.md ف٤).
//  - Account manager: sees HIS team only. Assign / unassign here (a new
//    assignment gets the default permissions — everything on); permissions are
//    changed from the Team page. Someone assigned before the client moved to
//    him who is not in his team is shown apart, with "Add to my team".
//  - Super admin: sees every active staff member, can assign anyone and edit
//    their permissions on this client.
// The backend (WorkspaceStaffController) decides who may do what.

interface StaffRow {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  assigned: boolean;
  permissions?: StaffPermissions | null;
  in_my_team?: boolean;
}

export default function ClientStaffTab({ wsId, clientName }: { wsId: number; clientName?: string }) {
  const t = useTranslations('dashboard');
  const role = getUser()?.role;
  const isSA = role === 'super_admin';
  const isManager = role === 'account_manager';

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<StaffRow | null>(null);

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
        // A person kept only because the client moved to this manager disappears with the link.
        setStaff((prev) => (m.in_my_team === false
          ? prev.filter((s) => s.id !== m.id)
          : prev.map((s) => (s.id === m.id ? { ...s, assigned: false, permissions: null } : s))));
      } else {
        await api.put(`/workspaces/${wsId}/staff/${m.id}`);
        setStaff((prev) => prev.map((s) => (s.id === m.id ? { ...s, assigned: true, permissions: allStaffPermissions() } : s)));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || t('client_team_save_failed'));
    } finally {
      setBusyId(null);
    }
  };

  const addToMyTeam = async (m: StaffRow) => {
    setBusyId(m.id);
    setError('');
    try {
      await api.post(`/my-team/${m.id}`);
      setStaff((prev) => prev.map((s) => (s.id === m.id ? { ...s, in_my_team: true } : s)));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('client_team_save_failed'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <TableSkeleton />;

  const assignedCount = staff.filter((s) => s.assigned).length;
  const outsiders = staff.filter((s) => s.assigned && s.in_my_team === false);
  const regular = staff.filter((s) => !(s.assigned && s.in_my_team === false));

  const btn = 'text-xs rounded px-3 py-1.5 border disabled:opacity-50 shrink-0 hover:underline';

  const Person = ({ m }: { m: StaffRow }) => (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-full bg-[var(--color-input-fill)] overflow-hidden flex items-center justify-center text-sm shrink-0">
        {m.avatar_url ? <img src={resolveFileUrl(m.avatar_url)} alt="" className="w-full h-full object-cover" /> : (m.name?.[0] || '?')}
      </div>
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{m.name}</p>
        <p className="text-xs text-[var(--color-text-secondary)] truncate" dir="ltr">{m.email}</p>
      </div>
    </div>
  );

  const removeBtn = (m: StaffRow) => (
    <button
      onClick={() => toggle(m)}
      disabled={busyId === m.id}
      aria-label={`${t('client_team_unassign')} ${m.name}`}
      className={`${btn} text-red-400 border-red-900/30`}
    >
      {t('client_team_unassign')}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-[var(--color-text-secondary)] max-w-2xl">{isManager ? t('client_team_hint_manager') : t('client_team_hint')}</p>
        {isManager && (
          <Link href="/dashboard/team" className={`${btn} border-[var(--color-card-border)]`}>{t('client_team_open_page')}</Link>
        )}
      </div>
      {error && <div role="alert" className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg">{error}</div>}

      {staff.length === 0 && !error && (
        <div className="text-center py-10 text-[var(--color-text-secondary)]">{isManager ? t('client_team_empty_manager') : t('client_team_empty')}</div>
      )}

      {staff.length > 0 && (
        <p className="text-xs text-[var(--color-text-secondary)]">{t('client_team_assigned_count', { count: assignedCount })}</p>
      )}

      <ul className="space-y-2">
        {regular.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 border border-[var(--color-card-border)] rounded-lg p-3 flex-wrap">
            <Person m={m} />
            {m.assigned && m.permissions && (
              <div className="flex-1 min-w-[180px]"><PermissionChips permissions={normalizeStaffPermissions(m.permissions)} /></div>
            )}
            <div className="flex gap-2 shrink-0">
              {m.assigned && isSA && (
                <button onClick={() => setEditing(m)} aria-label={`${t('client_team_edit_perms')} ${m.name}`} className={`${btn} border-[var(--color-card-border)]`}>
                  {t('client_team_edit_perms')}
                </button>
              )}
              {m.assigned ? removeBtn(m) : (
                <button
                  onClick={() => toggle(m)}
                  disabled={busyId === m.id}
                  aria-label={`${t('client_team_assign')} ${m.name}`}
                  className={`${btn} text-green-400 border-green-900/30`}
                >
                  {t('client_team_assign')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {outsiders.length > 0 && (
        <ul className="space-y-2" aria-label={t('client_team_not_mine')}>
          {outsiders.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 border border-[var(--color-gold)]/40 bg-[rgba(168,152,106,0.06)] rounded-lg p-3 flex-wrap" data-outsider="true">
              <Person m={m} />
              <div className="flex-1 min-w-[180px] text-xs text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-gold-text)]">{t('client_team_not_mine')}</span> — {t('client_team_not_mine_hint')}
                {m.permissions && <div className="mt-1"><PermissionChips permissions={normalizeStaffPermissions(m.permissions)} /></div>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => addToMyTeam(m)} disabled={busyId === m.id} aria-label={`${t('client_team_add_mine')} ${m.name}`} className={`${btn} border-[var(--color-card-border)]`}>
                  {t('client_team_add_mine')}
                </button>
                {removeBtn(m)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <LinkDrawer
          member={{ id: editing.id, name: editing.name, email: editing.email, avatar_url: editing.avatar_url, other_teams: [] }}
          assignment={{ workspace_id: wsId, client_id: 0, name: clientName ?? '', permissions: normalizeStaffPermissions(editing.permissions) }}
          linkedWorkspaceIds={[wsId]}
          onClose={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
