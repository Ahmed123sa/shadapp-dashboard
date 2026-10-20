'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { reportError } from '@/lib/error-reporting';
import { resolveFileUrl } from '@/lib/utils';
import PasswordField from '@/components/ui/PasswordField';
import { StatusBadge } from '@/components/ui/StatusBadge';

// "Teams" — the company's own staff members (STAFF_TEAMS_PLAN.md). Super admin
// only: the backend answers 403 to everyone else and proxy.ts keeps the page
// from being served. Staff are never deleted, only archived, so the audit log
// and chats keep their real names.

interface StaffMember {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  date_of_birth?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  archived_at?: string | null;
  assigned_clients_count: number;
  teams?: { manager_id: number; name: string }[];
}

interface AssignedClient {
  workspace_id: number;
  client_id: number;
  uuid?: string | null;
  name?: string | null;
  manager?: { id: number; name: string } | null;
}

export default function StaffPage() {
  const t = useTranslations('dashboard');
  const isSA = getUser()?.role === 'super_admin';

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [pwId, setPwId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [clientsFor, setClientsFor] = useState<StaffMember | null>(null);
  const [clients, setClients] = useState<AssignedClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/company-staff', { params: includeArchived ? { include_archived: 1 } : {} })
      .then(({ data }) => { setStaff(data.staff || []); setLoadError(''); })
      .catch((err) => { reportError('StaffPage.load', err); setLoadError(t('staff_load_failed')); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isSA) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSA, includeArchived]);

  if (!isSA) {
    return <div className="text-center py-20 text-[var(--color-text-secondary)]">{t('staff_unauthorized')}</div>;
  }

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setDob(''); setPassword(''); setSendEmail(true); setFormError('');
  };

  const openCreate = () => { resetForm(); setEditId(null); setShowForm(true); setPwId(null); };

  const startEdit = (m: StaffMember) => {
    setEditId(m.id); setShowForm(true); setPwId(null);
    setName(m.name); setEmail(m.email); setPhone(m.phone || ''); setDob(m.date_of_birth ? String(m.date_of_birth).substring(0, 10) : '');
    setPassword(''); setFormError('');
  };

  const closeForm = () => { setShowForm(false); setEditId(null); resetForm(); };

  const errorFrom = (err: any) => {
    const errors = err?.response?.data?.errors;
    const first = errors ? (Object.values(errors)[0] as string[] | undefined)?.[0] : undefined;
    return first || err?.response?.data?.message || t('staff_save_failed');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/company-staff/${editId}`, { name, email, phone: phone || null, date_of_birth: dob || null });
        setNotice(t('staff_updated'));
      } else {
        await api.post('/company-staff', { name, email, phone: phone || null, date_of_birth: dob || null, password, send_email: sendEmail });
        setNotice(t('staff_created'));
      }
      closeForm();
      load();
    } catch (err: any) {
      setFormError(errorFrom(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (m: StaffMember) => {
    const archived = !!m.archived_at;
    if (!confirm(archived ? t('staff_unarchive_confirm') : t('staff_archive_confirm'))) return;
    setBusyId(m.id);
    try {
      await api.post(`/company-staff/${m.id}/${archived ? 'unarchive' : 'archive'}`);
      setNotice(archived ? t('staff_unarchived') : t('staff_archived'));
      load();
    } catch (err: any) {
      setNotice(err?.response?.data?.message || t('staff_save_failed'));
    } finally {
      setBusyId(null);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwId) return;
    setSaving(true);
    setFormError('');
    try {
      await api.patch(`/company-staff/${pwId}/password`, { password: newPassword });
      setNotice(t('staff_password_changed'));
      setPwId(null);
      setNewPassword('');
    } catch (err: any) {
      setFormError(errorFrom(err));
    } finally {
      setSaving(false);
    }
  };

  const openClients = async (m: StaffMember) => {
    setClientsFor(m);
    setClients([]);
    setClientsLoading(true);
    try {
      const { data } = await api.get(`/company-staff/${m.id}/clients`);
      setClients(data.clients || []);
    } catch (err) {
      reportError('StaffPage.clients', err);
    } finally {
      setClientsLoading(false);
    }
  };

  const inputCls = 'w-full bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm';

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h2 className="text-xl font-semibold">{t('staff_title')}</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            {t('staff_show_archived')}
          </label>
          <button onClick={openCreate} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)]">+ {t('staff_new')}</button>
        </div>
      </div>

      {notice && (
        <div role="status" className="bg-green-900/30 text-green-400 text-sm p-3 rounded-lg mb-4 flex justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label={t('team_activity_close')} className="text-xs hover:underline">×</button>
        </div>
      )}
      {loadError && <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg mb-4">{loadError}</div>}

      {showForm && (
        <form onSubmit={submit} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 mb-6 space-y-4">
          {formError && <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg">{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="st-name" className="text-xs text-[var(--color-text-secondary)]">{t('manager_name')}</label>
              <input id="st-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label htmlFor="st-email" className="text-xs text-[var(--color-text-secondary)]">{t('manager_email')}</label>
              <input id="st-email" className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
            </div>
            <div className="space-y-1">
              <label htmlFor="st-phone" className="text-xs text-[var(--color-text-secondary)]">{t('manager_phone')}</label>
              <input id="st-phone" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <label htmlFor="st-dob" className="text-xs text-[var(--color-text-secondary)]">{t('staff_dob')}</label>
              <input id="st-dob" className={inputCls} type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>
          {!editId && (
            <PasswordField value={password} onChange={setPassword} label={t('manager_password')} placeholder={t('manager_pw_ph')} required />
          )}
          {!editId && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              {t('team_send_login_email')}
            </label>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50">
              {saving ? t('manager_saving') : editId ? t('team_update') : t('staff_create')}
            </button>
            <button type="button" onClick={closeForm} className="bg-[var(--color-input-fill)] px-6 py-2 rounded-lg text-sm">{t('cancel')}</button>
          </div>
        </form>
      )}

      {pwId && (
        <form onSubmit={changePassword} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 mb-6 space-y-3">
          {formError && <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg">{formError}</div>}
          <PasswordField value={newPassword} onChange={setNewPassword} label={t('manager_new_pw')} placeholder={t('manager_new_pw_ph')} required />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50">{t('team_change_password')}</button>
            <button type="button" onClick={() => { setPwId(null); setNewPassword(''); setFormError(''); }} className="bg-[var(--color-input-fill)] px-6 py-2 rounded-lg text-sm">{t('cancel')}</button>
          </div>
        </form>
      )}

      {!loading && staff.length === 0 && !loadError && (
        <div className="text-center py-16 text-[var(--color-text-secondary)]">{t('staff_empty')}</div>
      )}

      <div className="space-y-3">
        {staff.map((m) => {
          const archived = !!m.archived_at;
          return (
            <div key={m.id} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-input-fill)] overflow-hidden flex items-center justify-center text-sm shrink-0">
                    {m.avatar_url ? <img src={resolveFileUrl(m.avatar_url)} alt="" className="w-full h-full object-cover" /> : (m.name?.[0] || '?')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.name}</span>
                      <StatusBadge status={archived ? 'archived' : 'active'} />
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]" dir="ltr">{m.email}{m.phone ? ` • ${m.phone}` : ''}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('staff_clients_count', { count: m.assigned_clients_count })}</p>
                    {!!m.teams?.length && <p className="text-xs text-[var(--color-text-secondary)]" data-testid="staff-teams">{t('staff_in_teams', { names: m.teams.map((x) => x.name).join(', ') })}</p>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openClients(m)} className="text-xs hover:underline border border-[var(--color-card-border)] rounded px-2 py-1">{t('staff_clients')}</button>
                  <button onClick={() => startEdit(m)} className="text-xs text-[var(--color-gold-text)] hover:underline border border-[var(--color-card-border)] rounded px-2 py-1">{t('manager_edit')}</button>
                  <button onClick={() => { setPwId(m.id); setShowForm(false); setFormError(''); }} className="text-xs hover:underline border border-[var(--color-card-border)] rounded px-2 py-1">{t('team_change_password')}</button>
                  <button
                    onClick={() => toggleArchive(m)}
                    disabled={busyId === m.id}
                    className={`text-xs hover:underline border rounded px-2 py-1 disabled:opacity-50 ${archived ? 'text-green-400 border-green-900/30' : 'text-red-400 border-red-900/30'}`}
                  >
                    {archived ? t('staff_unarchive') : t('staff_archive')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {clientsFor && (
        <div role="dialog" aria-label={`${t('staff_clients')} — ${clientsFor.name}`} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setClientsFor(null)}>
          <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] w-full max-w-lg max-h-[80vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{t('staff_clients')} — {clientsFor.name}</h3>
              <button onClick={() => setClientsFor(null)} className="text-xs hover:underline">{t('team_activity_close')}</button>
            </div>
            {!clientsLoading && clients.length === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)] py-6 text-center">{t('staff_no_clients')}</p>
            )}
            <ul className="space-y-2">
              {clients.map((c) => (
                <li key={c.workspace_id} className="text-sm flex justify-between gap-3 border-b border-[var(--color-card-border)] pb-2">
                  <Link href={`/dashboard/clients/${c.uuid ?? c.client_id}`} className="text-[var(--color-gold-text)] hover:underline font-medium">{c.name || `#${c.client_id}`}</Link>
                  {c.manager && <span className="text-xs text-[var(--color-text-secondary)]">{c.manager.name}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
