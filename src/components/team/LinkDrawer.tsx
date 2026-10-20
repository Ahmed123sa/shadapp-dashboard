'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { reportError } from '@/lib/error-reporting';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  STAFF_PERMISSION_GROUPS, allStaffPermissions, normalizeStaffPermissions, setStaffPermission,
  type StaffPermissionKey, type StaffPermissions,
} from '@/lib/staff-permissions';
import { useSaveStaffPermissions, type TeamAssignment, type TeamMember } from '@/hooks/queries/useMyTeam';
import { X } from 'lucide-react';

// The side drawer that links a staff member to one of the manager's clients
// and sets what they may do there (PLAN_2 ف٣). The same drawer edits an
// existing link: then the client is fixed and shown, not chosen.

interface ClientOption { id: number; name: string; workspaceId: number }

const ROW_LABEL: Record<StaffPermissionKey, string> = {
  can_view_chat: 'mt_see_chat', can_send_chat: 'mt_send_chat',
  can_view_approvals: 'mt_see_approvals', can_request_approvals: 'mt_request_approvals',
  can_view_meetings: 'mt_see_meetings', can_join_meetings: 'mt_join_meetings',
};
const GROUP_LABEL = { chat: 'mt_perm_chat', approvals: 'mt_perm_approvals', meetings: 'mt_perm_meetings' } as const;

export default function LinkDrawer({ member, assignment, linkedWorkspaceIds, onClose }: {
  member: TeamMember;
  assignment?: TeamAssignment;
  linkedWorkspaceIds: number[];
  onClose: () => void;
}) {
  const t = useTranslations('dashboard');
  const titleId = useId();
  const { dialogRef, dialogProps } = useModalA11y<HTMLElement>(true, onClose);
  const save = useSaveStaffPermissions();

  const editing = !!assignment;
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [wsId, setWsId] = useState<number | ''>(assignment?.workspace_id ?? '');
  const [perms, setPerms] = useState<StaffPermissions>(normalizeStaffPermissions(assignment?.permissions ?? allStaffPermissions()));
  const [error, setError] = useState('');

  useEffect(() => {
    if (editing) return;
    api.get('/clients', { params: { per_page: 100 } })
      .then(({ data }) => {
        const rows: any[] = data.clients?.data || data.clients || [];
        setClients(rows
          .filter((c) => c.workspace?.id && !linkedWorkspaceIds.includes(c.workspace.id))
          .map((c) => ({ id: c.id, name: c.company_name || c.contact_person || `#${c.id}`, workspaceId: c.workspace.id })));
      })
      .catch((err) => { reportError('LinkDrawer.clients', err); setError(t('mt_load_failed')); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const submit = async () => {
    if (wsId === '') return;
    setError('');
    try {
      await save.mutateAsync({ wsId: Number(wsId), staffId: member.id, permissions: perms });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('mt_save_failed'));
    }
  };

  const inputCls = 'w-full bg-[var(--color-input-fill)] border border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-3 py-2 text-sm';

  return (
    <div className={'fixed inset-0 z-50 bg-black/60 flex justify-end'} onClick={onClose}>
      <aside
        ref={dialogRef}
        {...dialogProps}
        aria-labelledby={titleId}
        className={'bg-[var(--color-card)] border-s border-[var(--color-card-border)] w-full max-w-md h-full overflow-y-auto p-6'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[10.5px] tracking-[0.3em] uppercase text-[var(--color-text-disabled)]">{member.name}</div>
            <h3 id={titleId} className="text-xl font-semibold mt-1">{t('mt_link_title')}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label={t('team_activity_close')} className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)]">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {error && <div role="alert" className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg mb-4">{error}</div>}

        <div className="mb-6 space-y-1">
          <label htmlFor="mt-client" className="text-xs text-[var(--color-text-secondary)]">{t('mt_pick_client')}</label>
          {editing ? (
            <div className={inputCls}>{assignment!.name}</div>
          ) : (
            <select id="mt-client" className={inputCls} value={wsId} onChange={(e) => setWsId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{t('mt_pick_client_ph')}</option>
              {clients.map((c) => <option key={c.workspaceId} value={c.workspaceId}>{c.name}</option>)}
            </select>
          )}
          {!editing && clients.length === 0 && !error && (
            <p className="text-xs text-[var(--color-text-secondary)] pt-1">{t('mt_no_clients_to_link')}</p>
          )}
        </div>

        <div className="text-[10.5px] tracking-[0.2em] uppercase text-[var(--color-text-disabled)] mb-2">{t('mt_perm_on_client')}</div>
        {STAFF_PERMISSION_GROUPS.map((g) => (
          <fieldset key={g.id} className={'border border-[var(--color-card-border)] rounded-xl px-4 py-2 mb-3'}>
            <legend className="text-[10.5px] tracking-[0.2em] uppercase text-[var(--color-text-disabled)] px-1">{t(GROUP_LABEL[g.id])}</legend>
            <label className="flex items-center justify-between gap-4 py-2 text-sm cursor-pointer">
              <span>{t(ROW_LABEL[g.view])}</span>
              <input type="checkbox" role="switch" checked={perms[g.view]} onChange={(e) => setPerms(setStaffPermission(perms, g.view, e.target.checked))} />
            </label>
            <label className={`flex items-center justify-between gap-4 py-2 ps-4 text-sm ${perms[g.view] ? 'cursor-pointer' : 'opacity-45'}`}>
              <span>{t(ROW_LABEL[g.act])}</span>
              <input type="checkbox" role="switch" checked={perms[g.act]} disabled={!perms[g.view]} onChange={(e) => setPerms(setStaffPermission(perms, g.act, e.target.checked))} />
            </label>
          </fieldset>
        ))}
        <p className="text-xs text-[var(--color-text-secondary)] mt-3 mb-6">{t('mt_dep_note')}</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={wsId === '' || save.isPending}
            className={'bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50'}
          >
            {t('mt_save')}
          </button>
          <button type="button" onClick={onClose} className={'bg-[var(--color-input-fill)] px-6 py-2 rounded-lg text-sm'}>{t('cancel')}</button>
        </div>
      </aside>
    </div>
  );
}
