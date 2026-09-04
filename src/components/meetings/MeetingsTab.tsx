'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getUser } from '@/lib/auth';
import { getMeetingJoinStatus, notifyWriteError } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useWorkspaceMeetings, useCreateMeeting, useCompleteMeeting, useCancelMeeting } from '@/hooks/queries/useMeetings';
import { useWorkspaceContracts } from '@/hooks/queries/usePayments';
import type { Meeting } from '@/types';

export default function MeetingsTab({ wsId }: { wsId: number }) {
  const [form, setForm] = useState({ title: '', date: '', time: '', duration: 30, notes: '', contract_id: '', approval_id: '' });
  const [showForm, setShowForm] = useState(false);
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');

  const meetingsQuery = useWorkspaceMeetings(wsId);
  const contractsQuery = useWorkspaceContracts(wsId);
  const createMutation = useCreateMeeting(wsId);
  const completeMutation = useCompleteMeeting(wsId);
  const cancelMutation = useCancelMeeting(wsId);

  const meetings = meetingsQuery.data ?? [];
  const contracts = contractsQuery.data ?? [];
  // Loading is gated on the contracts fetch alone, same as the original
  // two-parallel-requests effect (only the contracts `.finally` cleared
  // `loading`) — preserved rather than "fixed" to keep this a pure
  // behavior-preserving refactor.
  const loading = contractsQuery.isLoading;
  const error = meetingsQuery.isError && meetingsQuery.data === undefined
    ? t('meetings_load_error')
    : contractsQuery.isError && contractsQuery.data === undefined
      ? t('meetings_contracts_error')
      : '';

  const create = () => {
    if (!form.title || !form.date) return;
    const localDate = new Date(`${form.date}T${form.time || '00:00'}`);
    const payload: { title: string; scheduled_at: string; duration_minutes: number; notes: string; contract_id?: string; approval_id?: string } =
      { title: form.title, scheduled_at: localDate.toISOString(), duration_minutes: form.duration, notes: form.notes };
    if (form.contract_id) payload.contract_id = form.contract_id;
    if (form.approval_id) payload.approval_id = form.approval_id;
    createMutation.mutate(payload, {
      onSuccess: () => { setShowForm(false); setForm({ title: '', date: '', time: '', duration: 30, notes: '', contract_id: '', approval_id: '' }); },
      onError: (err) => notifyWriteError(tc, 'MeetingsTab.create', err),
    });
  };

  const completeMeeting = (id: number) => {
    if (!confirm(t('confirm_complete_meeting'))) return;
    completeMutation.mutate(id, { onError: (err) => notifyWriteError(tc, 'MeetingsTab.completeMeeting', err) });
  };

  const cancelMeeting = (id: number) => {
    if (!confirm(t('confirm_cancel_meeting'))) return;
    cancelMutation.mutate(id, { onError: (err) => notifyWriteError(tc, 'MeetingsTab.cancelMeeting', err) });
  };

  if (loading) return <TableSkeleton />;
  if (error) return <p className="text-sm text-red-400 text-center py-8">{error}</p>;

  const user = getUser();
  const isSA = user?.role === 'super_admin';
  const now = new Date();

  const upcoming = meetings.filter((m) => {
    if (m.status !== 'scheduled') return false;
    try { return new Date(m.scheduled_at) > now; } catch { return true; }
  });
  const past = meetings.filter((m) => {
    if (m.status !== 'scheduled') return true;
    try { return new Date(m.scheduled_at) <= now; } catch { return false; }
  });

  return (
    <div className="space-y-4">
      {!isSA && <button onClick={() => setShowForm(!showForm)} className="text-sm text-[var(--color-gold-text)] hover:underline">{t('new_meeting')}</button>}
      {!isSA && showForm && (
        <div className="space-y-2 border border-[var(--color-card-border)] rounded-lg p-4 bg-[var(--color-card-border)]">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('meeting_title_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
          <div className="flex gap-2">
            <input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} type="date" className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm flex-1 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
            <input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} type="time" className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm flex-1 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
          </div>
          <select value={form.contract_id} onChange={(e) => setForm({ ...form, contract_id: e.target.value })} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]">
            <option value="">{t('related_contract_ph')}</option>
            {contracts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('meeting_notes_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" rows={2} />
          <button onClick={create} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)]">{tc('save')}</button>
        </div>
      )}

      {meetings.length === 0 ? <EmptyState message={t('no_meetings')} /> : null}

      {upcoming.length > 0 && (
        <>
          <h3 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">{t('upcoming_meetings')}</h3>
          {upcoming.map((m) => (
            <MeetingCard key={m.id} meeting={m} isSA={isSA} onComplete={completeMeeting} onCancel={cancelMeeting} />
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <h3 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">{t('past_meetings')}</h3>
          {past.map((m) => (
            <MeetingCard key={m.id} meeting={m} isSA={isSA} onComplete={completeMeeting} onCancel={cancelMeeting} />
          ))}
        </>
      )}
    </div>
  );
}

function MeetingCard({ meeting: m, isSA, onComplete, onCancel }: { meeting: Meeting; isSA: boolean; onComplete: (id: number) => void; onCancel: (id: number) => void }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const isScheduled = m.status === 'scheduled';
  const joinStatus = m.scheduled_at ? getMeetingJoinStatus(m.scheduled_at, locale) : null;
  return (
    <div className="border border-[var(--color-card-border)] rounded-lg p-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-medium">{m.title}</h4>
          <p className="text-xs text-[var(--color-text-disabled)]">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleDateString('en-SA') : ''} {m.duration_minutes}{t('minutes_suffix')}{m.contract ? ` • ${m.contract.title}` : ''}{m.notes ? ` • ${m.notes}` : ''}</p>
        </div>
        <StatusBadge status={m.status} />
      </div>
      {isScheduled && m.link && joinStatus && (
        <div className="mt-3">
          {joinStatus.canJoin ? (
            <a href={m.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">🎥 {t('meeting_chip_join_now')}</a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs bg-gray-600/40 text-gray-400 px-3 py-1.5 rounded-lg">⏳ {joinStatus.label}</span>
          )}
        </div>
      )}
      {m.passcode && (
        <p className="text-xs text-[var(--color-text-disabled)] mt-1">{t('meeting_passcode', { code: m.passcode })}</p>
      )}
      {isScheduled && !isSA && (
        <div className="flex gap-2 mt-3">
          <button onClick={() => onComplete(m.id)} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">{t('meeting_complete')}</button>
          <button onClick={() => onCancel(m.id)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700">{t('meeting_cancel')}</button>
        </div>
      )}
    </div>
  );
}
