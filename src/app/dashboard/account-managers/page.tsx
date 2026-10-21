'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { reportError } from '@/lib/error-reporting';
import { useTranslations } from 'next-intl';
import PasswordField from '@/components/ui/PasswordField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useUiStyle } from '@/lib/ui-style';
import { Plus } from 'lucide-react';
import type { User } from '@/types';

export default function AccountManagersPage() {
  const t = useTranslations('dashboard');
  const luxe = useUiStyle() === 'luxe';
  const [managers, setManagers] = useState<User[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [canApprove, setCanApprove] = useState(false);
  const [password, setPassword] = useState('');
  const [autoPassword, setAutoPassword] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [newCreds, setNewCreds] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);
  const user = getUser();
  // getUser() parses localStorage fresh on every call, so it returns a new
  // object each render — using `user` itself as an effect dependency below
  // never settles (Object.is always sees it as "changed"), which fired
  // load() on every render: setManagers → re-render → new user object →
  // effect fires again, forever. Depending on the primitive role string
  // instead breaks the loop, since it's referentially stable unless the
  // actual role changes.
  const userRole = user?.role;

  const load = () => {
    // Deactivated managers are hidden from the default list on the backend
    // too — include_inactive=1 is what lets this page show/manage them.
    // See DATA_SAFETY_PLAN.md §2.2.5.
    api.get(`/account-managers${showInactive ? '?include_inactive=1' : ''}`).then(({ data }) => setManagers(data.managers || [])).catch((err) => reportError('AccountManagersPage.load', err));
  };

  useEffect(() => {
    if (userRole === 'super_admin') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, showInactive]);

  if (user?.role !== 'super_admin') {
    return <div className="text-center py-20 text-[var(--color-text-secondary)]">{t('managers_unauthorized')}</div>;
  }

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setDateOfBirth('');
    setPassword('');
    setAutoPassword(true);
    setCanApprove(false);
    setSendEmail(true);
  };

  const createManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload: { name: string; email: string; phone: string; date_of_birth: string | null; password?: string | null; send_email: boolean } =
        { name, email, phone, date_of_birth: dateOfBirth || null, send_email: sendEmail };
      if (autoPassword) {
        payload.password = null;
      } else {
        payload.password = password;
      }
      const { data } = await api.post('/account-managers', payload);
      setManagers((prev) => [...prev, data.manager]);
      setNewCreds(data.credentials);
      setShowCreate(false);
      resetForm();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.errors?.password?.[0] || t('manager_create_failed'));
    } finally {
      setSaving(false);
    }
  };

  const updateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setError('');
    setSaving(true);
    try {
      const payload: { name: string; email: string; phone: string; date_of_birth: string | null; password?: string; can_approve_contracts: boolean } =
        { name, email, phone, date_of_birth: dateOfBirth || null, can_approve_contracts: canApprove };
      if (password) payload.password = password;
      await api.put(`/account-managers/${editId}`, payload);
      load();
      setEditId(null);
      resetForm();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('manager_update_failed'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (m: User) => {
    setEditId(m.id);
    setName(m.name);
    setEmail(m.email);
    setPhone(m.phone || '');
    setDateOfBirth(m.date_of_birth ? String(m.date_of_birth).substring(0, 10) : '');
    setCanApprove(!!m.can_approve_contracts);
    setPassword('');
    setAutoPassword(true);
  };

  const openCreate = () => {
    setShowCreate(true);
    setEditId(null);
    resetForm();
  };

  const deactivateManager = async (m: User) => {
    if (!confirm(t('manager_deactivate_confirm'))) return;
    setStatusError('');
    setStatusBusyId(m.id);
    try {
      await api.post(`/account-managers/${m.id}/deactivate`);
      load();
    } catch (err: any) {
      setStatusError(err?.response?.data?.message || t('manager_deactivate_failed'));
    } finally {
      setStatusBusyId(null);
    }
  };

  // Inline switch in the managers table (Luxe look). The backend's update
  // accepts a partial body (`sometimes` on every field), so only the flag is
  // sent. Optimistic: flips at once, rolls back and shows the error if the
  // request fails.
  const toggleApprove = async (m: User) => {
    const next = !m.can_approve_contracts;
    setStatusError('');
    setStatusBusyId(m.id);
    setManagers((prev) => prev.map((x) => (x.id === m.id ? { ...x, can_approve_contracts: next } : x)));
    try {
      await api.put(`/account-managers/${m.id}`, { can_approve_contracts: next });
    } catch (err: any) {
      setManagers((prev) => prev.map((x) => (x.id === m.id ? { ...x, can_approve_contracts: !next } : x)));
      setStatusError(err?.response?.data?.message || t('manager_update_failed'));
    } finally {
      setStatusBusyId(null);
    }
  };

  const activateManager = async (m: User) => {
    if (!confirm(t('manager_activate_confirm'))) return;
    setStatusError('');
    setStatusBusyId(m.id);
    try {
      await api.post(`/account-managers/${m.id}/activate`);
      load();
    } catch (err: any) {
      setStatusError(err?.response?.data?.message || t('manager_activate_failed'));
    } finally {
      setStatusBusyId(null);
    }
  };

  return (
    <div className="lx-people">
      <div className="lx-pagehead flex items-center justify-between mb-6">
        <h2 className="lx-hide text-xl font-semibold">{t('managers_title')}</h2>
        <div className="flex items-center gap-4">
          <label className="lx-switchlabel flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            {t('manager_show_inactive')}
          </label>
          <button onClick={openCreate} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)]">{luxe ? <><Plus size={15} strokeWidth={1.5} className="inline me-2" />{t('manager_new')}</> : `+ ${t('manager_new')}`}</button>
        </div>
      </div>

      {statusError && (
        <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg mb-4">{statusError}</div>
      )}

      {newCreds && (
        <div className="bg-green-900/30 border border-green-800/30 rounded-xl p-4 mb-4">
          <p className="text-green-400 font-medium mb-2">{t('manager_created')}</p>
          <p className="text-sm text-green-400">{t('manager_email')}: {newCreds.email}</p>
          <p className="text-sm text-green-400">{t('manager_password')}: {newCreds.password}</p>
          <button onClick={() => setNewCreds(null)} className="text-xs text-green-400 mt-1 hover:underline">{t('manager_ok')}</button>
        </div>
      )}

      {(showCreate || editId) && (
        <form onSubmit={editId ? updateManager : createManager} className="lx-form bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 mb-6 space-y-4">
          {error && <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="am-name" className="text-xs text-[var(--color-text-secondary)]">{t('manager_name')}</label>
              <input id="am-name" className="w-full bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm" placeholder={t('manager_name_ph')} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label htmlFor="am-email" className="text-xs text-[var(--color-text-secondary)]">{t('manager_email')}</label>
              <input id="am-email" className="w-full bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm" type="email" placeholder={t('manager_email_ph')} value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
            </div>
            <div className="space-y-1">
              <label htmlFor="am-phone" className="text-xs text-[var(--color-text-secondary)]">{t('manager_phone')}</label>
              <input id="am-phone" className="w-full bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm" placeholder={t('manager_phone_ph')} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <label htmlFor="am-dob" className="text-xs text-[var(--color-text-secondary)]">{t('manager_dob')}</label>
              <input id="am-dob" type="date" className="w-full bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
          </div>
          {editId && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={canApprove} onChange={(e) => setCanApprove(e.target.checked)} />
              {t('manager_can_approve_contracts')}
            </label>
          )}
          {!editId && (
            <div className="space-y-2">
              <label className="text-xs text-[var(--color-text-secondary)] block">{t('manager_password')}</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" name="pwMode" checked={autoPassword} onChange={() => setAutoPassword(true)} />
                  {t('manager_auto')}
                </label>
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" name="pwMode" checked={!autoPassword} onChange={() => setAutoPassword(false)} />
                  {t('manager_manual')}
                </label>
              </div>
              {!autoPassword && (
                <PasswordField value={password} onChange={setPassword} placeholder={t('manager_pw_ph')} required />
              )}
            </div>
          )}
          {!editId && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              {t('team_send_login_email')}
            </label>
          )}
          {editId && (
            <PasswordField value={password} onChange={setPassword} label={t('manager_new_pw')} placeholder={t('manager_new_pw_ph')} opt />
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50">{saving ? t('manager_saving') : (editId ? t('manager_update') : t('manager_create'))}</button>
            <button type="button" onClick={() => { setShowCreate(false); setEditId(null); resetForm(); }} className="bg-[var(--color-input-fill)] px-6 py-2 rounded-lg text-sm">{t('cancel')}</button>
          </div>
        </form>
      )}

      <div className="lx-tblbox lx-ledger bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-card-border)] border-b border-[var(--color-card-border)]">
            <tr>
              <th className="text-center p-4 font-medium">{t('manager_col_name')}</th>
              {!luxe && <th className="text-center p-4 font-medium">{t('manager_col_email')}</th>}
              <th className="text-center p-4 font-medium">{t('manager_col_phone')}</th>
              <th className="text-center p-4 font-medium">{t('manager_col_clients')}</th>
              {luxe && <th className="text-center p-4 font-medium">{t('manager_can_approve_contracts')}</th>}
              <th className="text-center p-4 font-medium">{t('manager_col_status')}</th>
              <th className="text-center p-4 font-medium">{luxe ? '' : t('manager_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {managers.map((m) => {
              const isActive = m.is_active !== false;
              return (
                <tr key={m.id} className="border-b border-[var(--color-card-border)]">
                  <td className="p-4 text-center">
                    {luxe ? (
                      <div className="lx-who">
                        <div className="lx-av-sm">{m.name?.[0] || '?'}</div>
                        <div>
                          <div className="lx-tname">{m.name}</div>
                          <div className="lx-sub">{m.email}</div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {m.name}
                        {m.can_approve_contracts && (
                          <span className="ms-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">{t('manager_can_approve_badge')}</span>
                        )}
                      </>
                    )}
                  </td>
                  {!luxe && <td className="p-4 text-center">{m.email}</td>}
                  <td className="p-4 text-center lx-dim">{m.phone || '—'}</td>
                  <td className="p-4 text-center">{m.managed_clients_count || 0}</td>
                  {luxe && (
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!!m.can_approve_contracts}
                        aria-label={`${t('manager_can_approve_contracts')} — ${m.name}`}
                        onClick={() => toggleApprove(m)}
                        disabled={statusBusyId === m.id}
                        className={`lx-sw ${m.can_approve_contracts ? 'on' : ''}`}
                      />
                    </td>
                  )}
                  <td className="p-4 text-center">
                    <StatusBadge status={isActive ? 'active' : 'inactive'} />
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => startEdit(m)} className="lx-btn-sm text-xs text-[var(--color-gold-text)] hover:underline border border-blue-200 rounded px-2 py-1">{t('manager_edit')}</button>
                      {isActive ? (
                        <button
                          onClick={() => deactivateManager(m)}
                          disabled={statusBusyId === m.id}
                          className="lx-btn-sm lx-btn-quiet lx-btn-danger text-xs text-red-400 hover:underline border border-red-900/30 rounded px-2 py-1 disabled:opacity-50"
                        >
                          {t('manager_deactivate')}
                        </button>
                      ) : (
                        <button
                          onClick={() => activateManager(m)}
                          disabled={statusBusyId === m.id}
                          className="lx-btn-sm lx-btn-quiet text-xs text-green-400 hover:underline border border-green-900/30 rounded px-2 py-1 disabled:opacity-50"
                        >
                          {t('manager_activate')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
