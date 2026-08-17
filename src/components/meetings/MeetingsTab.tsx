'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';

export default function MeetingsTab({ wsId }: { wsId: number }) {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', date: '', time: '', duration: 30, notes: '', contract_id: '', approval_id: '' });
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');

  useEffect(() => {
    api.get(`/workspaces/${wsId}/meetings`).then(({ data }) => setMeetings(data.meetings?.data || data.meetings || [])).catch((err) => { console.error('MeetingsTab: GET /workspaces/${wsId}/meetings failed', err); setError(t('meetings_load_error')); });
    api.get(`/workspaces/${wsId}/contracts`).then(({ data }) => setContracts(data.contracts?.data || data.contracts || [])).catch((err) => { console.error('MeetingsTab: GET /workspaces/${wsId}/contracts failed', err); setError(t('meetings_contracts_error')); }).finally(() => setLoading(false));
  }, [wsId]);

  const create = async () => {
    if (!form.title || !form.date) return;
    const payload: any = { title: form.title, scheduled_at: `${form.date} ${form.time}`, duration_minutes: form.duration, notes: form.notes };
    if (form.contract_id) payload.contract_id = form.contract_id;
    if (form.approval_id) payload.approval_id = form.approval_id;
    const { data } = await api.post(`/workspaces/${wsId}/meetings`, payload).catch(() => ({ data: null }));
    if (data) { setMeetings((prev) => [...prev, data.meeting]); setShowForm(false); setForm({ title: '', date: '', time: '', duration: 30, notes: '', contract_id: '', approval_id: '' }); }
  };

  const completeMeeting = async (id: number) => {
    if (!confirm(t('confirm_complete_meeting'))) return;
    const { data } = await api.patch(`/meetings/${id}/complete`).catch(() => ({ data: null }));
    if (data) setMeetings((prev) => prev.map((m) => m.id === id ? data.meeting : m));
  };

  const cancelMeeting = async (id: number) => {
    if (!confirm(t('confirm_cancel_meeting'))) return;
    const { data } = await api.patch(`/meetings/${id}/cancel`).catch(() => ({ data: null }));
    if (data) setMeetings((prev) => prev.map((m) => m.id === id ? data.meeting : m));
  };

  if (loading) return <LoadingSkeleton />;
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
      {!isSA && <button onClick={() => setShowForm(!showForm)} className="text-sm text-[var(--color-gold)] hover:underline">{t('new_meeting')}</button>}
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
          <h4 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">{t('upcoming_meetings')}</h4>
          {upcoming.map((m) => (
            <MeetingCard key={m.id} meeting={m} isSA={isSA} onComplete={completeMeeting} onCancel={cancelMeeting} />
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <h4 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">{t('past_meetings')}</h4>
          {past.map((m) => (
            <MeetingCard key={m.id} meeting={m} isSA={isSA} onComplete={completeMeeting} onCancel={cancelMeeting} />
          ))}
        </>
      )}
    </div>
  );
}

function MeetingCard({ meeting: m, isSA, onComplete, onCancel }: { meeting: any; isSA: boolean; onComplete: (id: number) => void; onCancel: (id: number) => void }) {
  const t = useTranslations('dashboard');
  const isScheduled = m.status === 'scheduled';
  return (
    <div className="border border-[var(--color-card-border)] rounded-lg p-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-medium">{m.title}</h4>
          <p className="text-xs text-[var(--color-text-disabled)]">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleDateString('en-SA') : ''} {m.duration_minutes}{t('minutes_suffix')}{m.contract ? ` • ${m.contract.title}` : ''}{m.notes ? ` • ${m.notes}` : ''}</p>
        </div>
        <StatusBadge status={m.status} />
      </div>
      {isScheduled && !isSA && (
        <div className="flex gap-2 mt-3">
          <button onClick={() => onComplete(m.id)} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">{t('meeting_complete')}</button>
          <button onClick={() => onCancel(m.id)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700">{t('meeting_cancel')}</button>
        </div>
      )}
    </div>
  );
}
