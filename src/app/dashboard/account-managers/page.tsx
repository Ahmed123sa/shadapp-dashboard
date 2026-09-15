'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { reportError } from '@/lib/error-reporting';
import { useTranslations } from 'next-intl';
import PasswordField from '@/components/ui/PasswordField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { User } from '@/types';

export default function AccountManagersPage() {
  const t = useTranslations('dashboard');
  const [managers, setManagers] = useState<User[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [autoPassword, setAutoPassword] = useState(true);
  const [newCreds, setNewCreds] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);
  const user = getUser();

  const load = () => {
    // Deactivated managers are hidden from the default list on the backend
    // too — include_inactive=1 is what lets this page show/manage them.
    // See DATA_SAFETY_PLAN.md §2.2.5.
    api.get(`/account-managers${showInactive ? '?include_inactive=1' : ''}`).then(({ data }) => setManagers(data.managers || [])).catch((err) => reportError('AccountManagersPage.load', err));
  };

  useEffect(() => {
    if (user?.role === 'super_admin') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showInactive]);

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
  };

  const createManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload: { name: string; email: string; phone: string; date_of_birth: string | null; password?: string | null } =
        { name, email, phone, date_of_birth: dateOfBirth || null };
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
      const payload: { name: string; email: string; phone: string; date_of_birth: string | null; password?: string } =
        { name, email, phone, date_of_birth: dateOfBirth || null };
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">{t('managers_title')}</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            {t('manager_show_inactive')}
          </label>
          <button onClick={openCreate} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)]">+ {t('manager_new')}</button>
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
        <form onSubmit={editId ? updateManager : createManager} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 mb-6 space-y-4">
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
          {editId && (
            <PasswordField value={password} onChange={setPassword} label={t('manager_new_pw')} placeholder={t('manager_new_pw_ph')} opt />
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50">{saving ? t('manager_saving') : (editId ? t('manager_update') : t('manager_create'))}</button>
            <button type="button" onClick={() => { setShowCreate(false); setEditId(null); resetForm(); }} className="bg-[var(--color-input-fill)] px-6 py-2 rounded-lg text-sm">{t('cancel')}</button>
          </div>
        </form>
      )}

      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-card-border)] border-b border-[var(--color-card-border)]">
            <tr>
              <th className="text-center p-4 font-medium">{t('manager_col_name')}</th>
              <th className="text-center p-4 font-medium">{t('manager_col_email')}</th>
              <th className="text-center p-4 font-medium">{t('manager_col_phone')}</th>
              <th className="text-center p-4 font-medium">{t('manager_col_clients')}</th>
              <th className="text-center p-4 font-medium">{t('manager_col_status')}</th>
              <th className="text-center p-4 font-medium">{t('manager_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {managers.map((m) => {
              const isActive = m.is_active !== false;
              return (
                <tr key={m.id} className="border-b border-[var(--color-card-border)]">
                  <td className="p-4 text-center">{m.name}</td>
                  <td className="p-4 text-center">{m.email}</td>
                  <td className="p-4 text-center">{m.phone || '—'}</td>
                  <td className="p-4 text-center">{m.managed_clients_count || 0}</td>
                  <td className="p-4 text-center">
                    <StatusBadge status={isActive ? 'active' : 'inactive'} />
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => startEdit(m)} className="text-xs text-[var(--color-gold-text)] hover:underline border border-blue-200 rounded px-2 py-1">{t('manager_edit')}</button>
                      {isActive ? (
                        <button
                          onClick={() => deactivateManager(m)}
                          disabled={statusBusyId === m.id}
                          className="text-xs text-red-400 hover:underline border border-red-900/30 rounded px-2 py-1 disabled:opacity-50"
                        >
                          {t('manager_deactivate')}
                        </button>
                      ) : (
                        <button
                          onClick={() => activateManager(m)}
                          disabled={statusBusyId === m.id}
                          className="text-xs text-green-400 hover:underline border border-green-900/30 rounded px-2 py-1 disabled:opacity-50"
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
