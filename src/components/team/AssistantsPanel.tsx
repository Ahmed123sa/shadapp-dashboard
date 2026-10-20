'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { reportError } from '@/lib/error-reporting';
import { ASSISTANT_PERMISSION_KEYS, type AssistantPermissionKey } from '@/lib/permissions';
import PasswordField from '@/components/ui/PasswordField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useUiStyle } from '@/lib/ui-style';
import { Plus } from 'lucide-react';

// "Assistants" panel — an account manager's own (old-style) assistants (MANAGER_ASSISTANT_PLAN.md
// §5). Account managers only: the backend answers 403 to everyone else (super
// admin included) and proxy.ts keeps the page from being served.

type Permissions = Record<AssistantPermissionKey, boolean>;

interface Assistant {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  deactivated_by_parent: boolean;
  permissions: Permissions;
}

interface ActivityLog {
  id: number;
  action: string;
  created_at: string;
  client?: { company_name?: string; contact_person?: string } | null;
}

const emptyPermissions = (): Permissions =>
  Object.fromEntries(ASSISTANT_PERMISSION_KEYS.map((k) => [k, k === 'can_view_clients'])) as Permissions;

export default function AssistantsPanel() {
  const t = useTranslations('dashboard');
  const luxe = useUiStyle() === 'luxe';
  const locale = useLocale();
  const user = getUser();
  const isManager = user?.role === 'account_manager';

  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [permissions, setPermissions] = useState<Permissions>(emptyPermissions());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [pwId, setPwId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [activityFor, setActivityFor] = useState<Assistant | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/team')
      .then(({ data }) => { setAssistants(data.assistants || []); setLoadError(''); })
      .catch((err) => { reportError('TeamPage.load', err); setLoadError(t('team_load_failed')); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isManager) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  if (!isManager) {
    return <div className="text-center py-20 text-[var(--color-text-secondary)]">{t('team_unauthorized')}</div>;
  }

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setPassword(''); setSendEmail(true);
    setPermissions(emptyPermissions()); setFormError('');
  };

  const openCreate = () => { resetForm(); setEditId(null); setShowForm(true); setPwId(null); };

  const startEdit = (a: Assistant) => {
    setEditId(a.id); setShowForm(true); setPwId(null);
    setName(a.name); setEmail(a.email); setPhone(a.phone || ''); setPassword('');
    setPermissions({ ...emptyPermissions(), ...a.permissions });
    setFormError('');
  };

  const closeForm = () => { setShowForm(false); setEditId(null); resetForm(); };

  const errorFrom = (err: any) => {
    const errors = err?.response?.data?.errors;
    const first = errors ? (Object.values(errors)[0] as string[] | undefined)?.[0] : undefined;
    return first || err?.response?.data?.message || t('team_save_failed');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/team/${editId}`, { name, email, phone: phone || null, permissions });
      } else {
        await api.post('/team', { name, email, phone: phone || null, password, permissions, send_email: sendEmail });
        setNotice(t('team_created'));
      }
      closeForm();
      load();
    } catch (err: any) {
      setFormError(errorFrom(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: Assistant) => {
    if (!confirm(a.is_active ? t('team_deactivate_confirm') : t('team_activate_confirm'))) return;
    setBusyId(a.id);
    try {
      await api.post(`/team/${a.id}/${a.is_active ? 'deactivate' : 'activate'}`);
      load();
    } catch (err: any) {
      setNotice(err?.response?.data?.message || t('team_save_failed'));
    } finally {
      setBusyId(null);
    }
  };

  const removeAssistant = async (a: Assistant) => {
    // Two separate, deliberately blunt warnings — removal cannot be undone.
    if (!confirm(t('team_remove_confirm_1'))) return;
    if (!confirm(t('team_remove_confirm_2'))) return;
    setBusyId(a.id);
    try {
      await api.delete(`/team/${a.id}`);
      setNotice(t('team_removed'));
      load();
    } catch (err: any) {
      setNotice(err?.response?.data?.message || t('team_save_failed'));
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
      await api.patch(`/team/${pwId}/password`, { password: newPassword });
      setNotice(t('team_password_changed'));
      setPwId(null);
      setNewPassword('');
    } catch (err: any) {
      setFormError(errorFrom(err));
    } finally {
      setSaving(false);
    }
  };

  const openActivity = async (a: Assistant) => {
    setActivityFor(a);
    setActivity([]);
    setActivityLoading(true);
    try {
      const { data } = await api.get(`/team/${a.id}/activity`);
      setActivity(data.logs?.data || []);
    } catch (err) {
      reportError('TeamPage.activity', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const inputCls = 'w-full bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm';

  return (
    <div className="lx-people">
      <div className="lx-pagehead flex items-center justify-between mb-6">
        <h2 className="lx-hide text-xl font-semibold">{t('team_title')}</h2>
        <button onClick={openCreate} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)]">{luxe ? <><Plus size={15} strokeWidth={1.5} className="inline me-2" />{t('team_new')}</> : `+ ${t('team_new')}`}</button>
      </div>

      {notice && (
        <div role="status" className="bg-green-900/30 text-green-400 text-sm p-3 rounded-lg mb-4 flex justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs hover:underline">×</button>
        </div>
      )}
      {loadError && <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg mb-4">{loadError}</div>}

      {showForm && (
        <form onSubmit={submit} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 mb-6 space-y-4">
          {formError && <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg">{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="as-name" className="text-xs text-[var(--color-text-secondary)]">{t('manager_name')}</label>
              <input id="as-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label htmlFor="as-email" className="text-xs text-[var(--color-text-secondary)]">{t('manager_email')}</label>
              <input id="as-email" className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
            </div>
            <div className="space-y-1">
              <label htmlFor="as-phone" className="text-xs text-[var(--color-text-secondary)]">{t('manager_phone')}</label>
              <input id="as-phone" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
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

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-1">{t('team_permissions')}</legend>
            {ASSISTANT_PERMISSION_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!permissions[key]}
                  disabled={key === 'can_view_clients'}
                  onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                />
                {t(`team_perm_${key}`)}
                {key === 'can_view_clients' && <span className="text-xs text-[var(--color-text-secondary)]">({t('team_perm_always_on')})</span>}
              </label>
            ))}
            <p className="text-xs text-[var(--color-text-secondary)] pt-1">{t('team_finance_note')}</p>
          </fieldset>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50">
              {saving ? t('manager_saving') : editId ? t('team_update') : t('team_create')}
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

      {!loading && assistants.length === 0 && !loadError && (
        <div className="text-center py-16 text-[var(--color-text-secondary)]">{t('team_empty')}</div>
      )}

      {luxe && assistants.length > 0 && (
        <div className="lx-tblbox lx-ledger">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>{t('manager_col_name')}</th>
                <th>{t('team_permissions')}</th>
                <th>{t('manager_col_status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assistants.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="lx-who">
                      <div className="lx-av-sm">{a.name?.[0] || '?'}</div>
                      <div>
                        <div className="lx-tname">{a.name}</div>
                        <div className="lx-sub" dir="ltr">{a.email}{a.phone ? ` • ${a.phone}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="lx-perms">
                      {ASSISTANT_PERMISSION_KEYS.filter((k) => a.permissions?.[k]).map((k) => (
                        <span key={k}>{t(`team_perm_${k}`)}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={a.is_active ? 'active' : 'inactive'} />
                    {!a.is_active && a.deactivated_by_parent && (
                      <div className="lx-sub">{t('team_off_with_manager')}</div>
                    )}
                  </td>
                  <td>
                    <div className="lx-rowacts">
                      <button onClick={() => startEdit(a)} className="lx-btn-sm">{t('manager_edit')}</button>
                      <button onClick={() => { setPwId(a.id); setShowForm(false); setFormError(''); }} className="lx-btn-sm lx-btn-quiet">{t('team_change_password')}</button>
                      <button onClick={() => openActivity(a)} className="lx-btn-sm lx-btn-quiet">{t('team_activity')}</button>
                      <button onClick={() => toggleActive(a)} disabled={busyId === a.id} className={`lx-btn-sm lx-btn-quiet disabled:opacity-50 ${a.is_active ? 'lx-btn-danger' : ''}`}>
                        {a.is_active ? t('manager_deactivate') : t('manager_activate')}
                      </button>
                      <button onClick={() => removeAssistant(a)} disabled={busyId === a.id} className="lx-btn-sm lx-btn-quiet lx-btn-danger disabled:opacity-50">{t('team_remove')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={`lx-cardlist space-y-3 ${luxe ? 'hidden' : ''}`}>
        {assistants.map((a) => (
          <div key={a.id} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.name}</span>
                  <StatusBadge status={a.is_active ? 'active' : 'inactive'} />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]" dir="ltr">{a.email}{a.phone ? ` • ${a.phone}` : ''}</p>
                {!a.is_active && a.deactivated_by_parent && (
                  <p className="text-xs text-amber-500 mt-1">{t('team_off_with_manager')}</p>
                )}
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {ASSISTANT_PERMISSION_KEYS.filter((k) => a.permissions?.[k]).map((k) => (
                    <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-input-fill)] text-[var(--color-text-secondary)]">{t(`team_perm_${k}`)}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => startEdit(a)} className="text-xs text-[var(--color-gold-text)] hover:underline border border-[var(--color-card-border)] rounded px-2 py-1">{t('manager_edit')}</button>
                <button onClick={() => { setPwId(a.id); setShowForm(false); setFormError(''); }} className="text-xs hover:underline border border-[var(--color-card-border)] rounded px-2 py-1">{t('team_change_password')}</button>
                <button onClick={() => openActivity(a)} className="text-xs hover:underline border border-[var(--color-card-border)] rounded px-2 py-1">{t('team_activity')}</button>
                <button
                  onClick={() => toggleActive(a)}
                  disabled={busyId === a.id}
                  className={`text-xs hover:underline border rounded px-2 py-1 disabled:opacity-50 ${a.is_active ? 'text-red-400 border-red-900/30' : 'text-green-400 border-green-900/30'}`}
                >
                  {a.is_active ? t('manager_deactivate') : t('manager_activate')}
                </button>
                <button
                  onClick={() => removeAssistant(a)}
                  disabled={busyId === a.id}
                  className="text-xs hover:underline border rounded px-2 py-1 disabled:opacity-50 text-red-500 border-red-900/50"
                >
                  {t('team_remove')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activityFor && (
        <div role="dialog" aria-label={`${t('team_activity')} — ${activityFor.name}`} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setActivityFor(null)}>
          <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] w-full max-w-lg max-h-[80vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{t('team_activity')} — {activityFor.name}</h3>
              <button onClick={() => setActivityFor(null)} className="text-xs hover:underline">{t('team_activity_close')}</button>
            </div>
            {!activityLoading && activity.length === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)] py-6 text-center">{t('team_activity_empty')}</p>
            )}
            <ul className="space-y-2">
              {activity.map((l) => (
                <li key={l.id} className="text-sm flex justify-between gap-3 border-b border-[var(--color-card-border)] pb-2">
                  <span>
                    <span className="font-medium">{l.action}</span>
                    {l.client && <span className="text-[var(--color-text-secondary)]"> • {l.client.company_name || l.client.contact_person}</span>}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{new Date(l.created_at).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
