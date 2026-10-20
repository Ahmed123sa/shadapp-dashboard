'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { resolveFileUrl } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import PermissionChips from '@/components/team/PermissionChips';
import LinkDrawer from '@/components/team/LinkDrawer';
import {
  useAddToTeam, useMyTeam, useRemovalImpact, useRemoveFromTeam, useUnlinkStaff,
  type TeamAssignment, type TeamMember,
} from '@/hooks/queries/useMyTeam';
import { ChevronUp, Link2, Plus, Search } from 'lucide-react';

// The manager's "Team" page body (PLAN_2_MANAGER_TEAMS.md ف٣): "My team" is
// shown; "Add from company staff" opens the rest of the company's staff right
// here, on the same page, and closes again with the same button.

type Drawer = { member: TeamMember; assignment?: TeamAssignment } | null;
type Removal = { member: TeamMember; count: number; clients: string[] } | null;

function Avatar({ m }: { m: TeamMember }) {
  return (
    <div className={'w-9 h-9 rounded-full bg-[var(--color-input-fill)] overflow-hidden flex items-center justify-center text-sm shrink-0'}>
      {m.avatar_url ? <img src={resolveFileUrl(m.avatar_url)} alt="" className="w-full h-full object-cover" /> : (m.name?.[0] || '?')}
    </div>
  );
}

export default function StaffTeamPanel() {
  const t = useTranslations('dashboard');
  const { data, isLoading, isError } = useMyTeam();
  const addToTeam = useAddToTeam();
  const impact = useRemovalImpact();
  const removeFromTeam = useRemoveFromTeam();
  const unlink = useUnlinkStaff();

  const [poolOpen, setPoolOpen] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [removal, setRemoval] = useState<Removal>(null);
  const [error, setError] = useState('');

  const team = data?.team ?? [];
  const others = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.others ?? []).filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [data, search]);

  const togglePick = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const closePool = () => { setPoolOpen(false); setPicked([]); setSearch(''); };

  const addSelected = async () => {
    setError('');
    try {
      await addToTeam.mutateAsync(picked);
      closePool();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('mt_save_failed'));
    }
  };

  const askRemove = async (m: TeamMember) => {
    setError('');
    try {
      const r = await impact.mutateAsync(m.id);
      setRemoval({ member: m, count: r.count, clients: r.clients });
    } catch {
      setError(t('mt_save_failed'));
    }
  };

  const confirmRemove = async () => {
    if (!removal) return;
    try {
      await removeFromTeam.mutateAsync(removal.member.id);
      setRemoval(null);
    } catch (err: any) {
      setRemoval(null);
      setError(err?.response?.data?.message || t('mt_save_failed'));
    }
  };

  const doUnlink = async (m: TeamMember, a: TeamAssignment) => {
    setError('');
    try {
      await unlink.mutateAsync({ wsId: a.workspace_id, staffId: m.id });
    } catch (err: any) {
      setError(err?.response?.data?.message || t('mt_save_failed'));
    }
  };

  const alsoIn = (m: TeamMember) => m.other_teams.map((x) => x.name).join('، ');

  const card = 'bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-5 mb-4';
  const btnPrimary = 'bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)] disabled:opacity-50';
  const btnPlain = 'bg-[var(--color-input-fill)] px-4 py-2 rounded-lg text-sm';
  const btnSm = 'text-xs border border-[var(--color-card-border)] rounded px-2 py-1 hover:underline';
  const btnSmDanger = 'text-xs text-red-400 border border-red-900/30 rounded px-2 py-1 hover:underline';

  const removalMessage = removal
    ? (removal.count > 0
        ? t('mt_rm_body', { count: removal.count, clients: removal.clients.join('، ') })
        : t('mt_rm_body_none'))
    : '';

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="text-xl font-semibold">{t('mt_title')}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-xl">{t('mt_desc')}</p>
        </div>
        <button type="button" onClick={() => (poolOpen ? closePool() : setPoolOpen(true))} className={poolOpen ? btnPlain : btnPrimary}>
          {poolOpen ? <ChevronUp size={15} strokeWidth={1.5} className="inline me-2" /> : <Plus size={15} strokeWidth={1.5} className="inline me-2" />}
          {poolOpen ? t('mt_hide_pool') : t('mt_add_from')}
        </button>
      </div>

      {error && <div role="alert" className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg mb-4">{error}</div>}
      {isError && <div role="alert" className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg mb-4">{t('mt_load_failed')}</div>}

      {poolOpen && (
        <section aria-label={t('mt_pool')} className={'bg-[var(--color-card)] rounded-xl border border-[var(--color-gold)] p-5 mb-6'}>
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="font-semibold">{t('mt_pool')}</h3>
            <span className="text-xs text-[var(--color-text-secondary)]">{data?.others.length ?? 0}</span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">{t('mt_pool_desc')}</p>
          <div className="relative mb-3 max-w-sm">
            <Search size={15} strokeWidth={1.4} className="absolute top-1/2 -translate-y-1/2 start-3 text-[var(--color-text-disabled)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('mt_search_staff')}
              aria-label={t('mt_search_staff')}
              className="w-full bg-[var(--color-input-fill)] border border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-full ps-9 pe-4 py-2 text-sm"
            />
          </div>
          {others.length === 0 && <p className="text-sm text-[var(--color-text-secondary)] py-4">{t('mt_pool_empty')}</p>}
          <ul>
            {others.map((m) => {
              const on = picked.includes(m.id);
              return (
                <li key={m.id}>
                  <label className={`flex items-center gap-3 py-3 border-b border-[var(--color-card-border)] cursor-pointer ${on ? 'bg-[rgba(148,20,20,0.08)]' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => togglePick(m.id)} aria-label={m.name} />
                    <Avatar m={m} />
                    <span className="min-w-0 flex-1">
                      <span className={`block ${'font-medium text-sm'}`}>{m.name}</span>
                      <span className="block text-xs text-[var(--color-text-secondary)]" dir="ltr">{m.email}</span>
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {m.other_teams.length > 0 ? `${t('mt_also_in')}: ${alsoIn(m)}` : t('mt_no_team')}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={closePool} className={btnPlain}>{t('cancel')}</button>
            <button type="button" onClick={addSelected} disabled={picked.length === 0 || addToTeam.isPending} className={btnPrimary}>
              {t('mt_add_selected', { count: picked.length })}
            </button>
          </div>
        </section>
      )}

      <div className="flex items-baseline justify-between mb-4">
        <h3 className={'text-lg font-semibold'}>{t('mt_my_team')}</h3>
        <span className="text-xs text-[var(--color-text-secondary)]">{t('mt_in_team', { count: team.length })}</span>
      </div>

      {isLoading && <TableSkeleton />}
      {!isLoading && !isError && team.length === 0 && (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">{t('mt_empty_team')}</div>
      )}

      {team.map((m) => {
        const assignments = m.assignments ?? [];
        return (
          <article key={m.id} className={card} aria-label={m.name}>
            <div className="flex items-center gap-4 flex-wrap mb-2">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar m={m} />
                <div className="min-w-0">
                  <div className={'font-medium'}>{m.name}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    <span dir="ltr">{m.email}</span>
                    {m.other_teams.length > 0 && ` · ${t('mt_also_in')}: ${alsoIn(m)}`}
                  </div>
                </div>
              </div>
              <span className="text-xs text-[var(--color-text-secondary)]">{t('mt_clients_count', { count: assignments.length })}</span>
              <div className="ms-auto flex gap-2 flex-wrap">
                <button type="button" onClick={() => setDrawer({ member: m })} className={btnSm}>
                  <Link2 size={13} strokeWidth={1.5} className="inline me-1.5" />{t('mt_link_client')}
                </button>
                <button type="button" onClick={() => askRemove(m)} disabled={impact.isPending} className={btnSmDanger}>{t('mt_remove')}</button>
              </div>
            </div>

            {assignments.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)] py-3">{t('mt_not_linked')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] tracking-[0.14em] uppercase text-[var(--color-text-disabled)] text-start">
                    <th className="text-start font-medium py-2">{t('mt_col_client')}</th>
                    <th className="text-start font-medium py-2">{t('mt_col_perms')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.workspace_id} className="border-t border-[var(--color-card-border)]">
                      <td className="py-3 pe-3">{a.name}</td>
                      <td className="py-3 pe-3"><PermissionChips permissions={a.permissions} /></td>
                      <td className="py-3 text-end whitespace-nowrap">
                        <button type="button" onClick={() => setDrawer({ member: m, assignment: a })} className={`${btnSm} me-2`} aria-label={`${t('mt_edit')} ${a.name}`}>{t('mt_edit')}</button>
                        <button type="button" onClick={() => doUnlink(m, a)} disabled={unlink.isPending} className={btnSmDanger} aria-label={`${t('mt_unlink')} ${a.name}`}>{t('mt_unlink')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        );
      })}

      {drawer && (
        <LinkDrawer
          member={drawer.member}
          assignment={drawer.assignment}
          linkedWorkspaceIds={(drawer.member.assignments ?? []).map((a) => a.workspace_id)}
          onClose={() => setDrawer(null)}
        />
      )}

      <ConfirmDialog
        open={!!removal}
        variant="danger"
        title={removal ? t('mt_rm_title', { name: removal.member.name }) : ''}
        message={removalMessage}
        confirmLabel={t('mt_rm_confirm')}
        cancelLabel={t('cancel')}
        onConfirm={confirmRemove}
        onCancel={() => setRemoval(null)}
      />
    </div>
  );
}
