'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usePermissionKeys } from '@/hooks/queries/useSubUsers';
import { Avatar, Btn, Icon } from '@/components/client-portal/ui';
import type { SubUser } from '@/types';

/** The 11 permission keys, grouped for the form (client-portal plan ع٥). */
const PERM_GROUPS: { id: string; keys: string[] }[] = [
  { id: 'g_chat', keys: ['can_chat'] },
  { id: 'g_contracts', keys: ['can_view_contracts', 'can_approve_contracts'] },
  { id: 'g_payments', keys: ['can_view_payments', 'can_upload_payment_proof'] },
  { id: 'g_approvals', keys: ['can_view_approvals', 'can_respond_approvals'] },
  { id: 'g_files', keys: ['can_view_files', 'can_upload_files'] },
  { id: 'g_meetings', keys: ['can_view_meetings', 'can_join_meetings'] },
];

type FormState = {
  name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  password: string;
  send_email: boolean;
  permissions: Record<string, boolean>;
};

const EMPTY: FormState = { name: '', email: '', phone: '', date_of_birth: '', password: '', send_email: true, permissions: {} };

export default function ClientSubUsers({ clientId }: { clientId: number }) {
  const t = useTranslations('dashboard');
  const tp = useTranslations('client_portal');
  // SUBUSER_PLAN.md §6.1 — permission keys come from the backend's single
  // source (SubUser::PERMISSION_KEYS) instead of a hardcoded copy here.
  const { data: permissionKeys = [] } = usePermissionKeys();
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // null = closed, 'new' = add form, number = editing that user
  const [formFor, setFormFor] = useState<'new' | number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  // subuser-review-plan.md م٤ — sub-users can no longer change their own
  // password (backend), so the owning client needs a way to set one here.
  const [passwordTargetId, setPasswordTargetId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<number | null>(null);

  useEffect(() => {
    api.get(`/clients/${clientId}/sub-users`)
      .then(({ data }) => setSubUsers(data.sub_users || []))
      .catch(() => setLoadError(t('subuser_load_failed')))
      .finally(() => setLoading(false));
  }, [clientId]);

  const allowed = (k: string) => permissionKeys.length === 0 || permissionKeys.includes(k);
  const groups = PERM_GROUPS.map((g) => ({ ...g, keys: g.keys.filter(allowed) })).filter((g) => g.keys.length > 0);
  const allKeys = groups.flatMap((g) => g.keys);

  const openNew = () => {
    setError('');
    setPasswordTargetId(null);
    setForm(EMPTY);
    setFormFor('new');
  };
  const openEdit = (u: SubUser) => {
    setError('');
    setPasswordTargetId(null);
    setForm({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      date_of_birth: u.date_of_birth ? String(u.date_of_birth).substring(0, 10) : '',
      password: '',
      send_email: false,
      permissions: { ...(u.permissions || {}) },
    });
    setFormFor(u.id);
  };
  const closeForm = () => { setFormFor(null); setError(''); };
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const togglePerm = (key: string) => setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));

  const permissionMap = () => Object.fromEntries(allKeys.map((k) => [k, !!form.permissions[k]]));

  const create = async () => {
    if (!form.name || !form.email || !form.password) return;
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: form.name, email: form.email, password: form.password, send_email: form.send_email };
      if (form.phone) payload.phone = form.phone;
      if (form.date_of_birth) payload.date_of_birth = form.date_of_birth;
      const { data } = await api.post(`/clients/${clientId}/sub-users`, payload);
      let created: SubUser = data.sub_user;
      // The backend creates users with no permissions; apply the chosen ones.
      if (allKeys.some((k) => form.permissions[k])) {
        try {
          const res = await api.patch(`/sub-users/${created.id}/permissions`, { permissions: permissionMap() });
          created = { ...created, permissions: res.data.sub_user?.permissions || permissionMap() };
        } catch {
          setSubUsers((prev) => [...prev, created]);
          setFormFor(null);
          setError(t('subuser_save_perms_failed'));
          return;
        }
      }
      setSubUsers((prev) => [...prev, created]);
      setFormFor(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('subuser_create_failed'));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (userId: number) => {
    setError('');
    setSaving(true);
    try {
      const payload: { name: string; email: string; phone: string; date_of_birth?: string } = { name: form.name, email: form.email, phone: form.phone };
      if (form.date_of_birth) payload.date_of_birth = form.date_of_birth;
      const { data } = await api.put(`/sub-users/${userId}/profile`, payload);
      let next: Partial<SubUser> = data.sub_user;
      const current = subUsers.find((u) => u.id === userId)?.permissions || {};
      const changed = allKeys.some((k) => !!current[k] !== !!form.permissions[k]);
      if (changed) {
        const res = await api.patch(`/sub-users/${userId}/permissions`, { permissions: permissionMap() });
        next = { ...next, permissions: res.data.sub_user?.permissions || permissionMap() };
      }
      setSubUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...next } : u)));
      setFormFor(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('subuser_update_failed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    setDeleteId(null);
    try {
      await api.delete(`/sub-users/${id}`);
      setSubUsers((prev) => prev.filter((u) => u.id !== id));
      if (formFor === id) setFormFor(null);
    } catch { setError(t('subuser_delete_failed')); }
  };

  const setPassword = async (userId: number) => {
    if (!newPassword) return;
    setError('');
    try {
      await api.patch(`/sub-users/${userId}/password`, { password: newPassword });
      setPasswordTargetId(null);
      setNewPassword('');
      setPasswordSuccess(userId);
      setTimeout(() => setPasswordSuccess((prev) => (prev === userId ? null : prev)), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('subuser_password_change_failed'));
    }
  };

  if (loading) return <TableSkeleton />;
  if (loadError) return <p className="locked" style={{ padding: '40px 0', justifyContent: 'center', width: '100%' }}>{loadError}</p>;

  const isNew = formFor === 'new';
  const editingUser = typeof formFor === 'number' ? subUsers.find((u) => u.id === formFor) : undefined;
  const passwordUser = subUsers.find((u) => u.id === passwordTargetId);
  const deleteUser = subUsers.find((u) => u.id === deleteId);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        {formFor === null && (
          <Btn variant="primary" onClick={openNew}>
            <Icon name="plus" />
            {tp('tm_add')}
          </Btn>
        )}
      </div>

      {(isNew || editingUser) && (
        <div className="drawer">
          <h3 className="serifx">{isNew ? tp('tm_add_title') : tp('tm_edit_title')}</h3>
          {error && <p className="sub" style={{ color: 'var(--crimson-ink)', marginBottom: 12 }}>{error}</p>}
          <div className="fgrid2">
            <div className="f3">
              <label htmlFor="tm-name">{tp('tm_name')}</label>
              <input id="tm-name" className="in" value={form.name} placeholder={t('subuser_name_ph')} onChange={(e) => setField('name', e.target.value)} />
            </div>
            <div className="f3">
              <label htmlFor="tm-email">{tp('tm_email')}</label>
              <input id="tm-email" className="in" type="email" dir="ltr" value={form.email} placeholder={t('subuser_email_ph')} onChange={(e) => setField('email', e.target.value)} />
            </div>
            <div className="f3">
              <label htmlFor="tm-phone">{tp('tm_phone')}</label>
              <input id="tm-phone" className="in num-ltr" dir="ltr" value={form.phone} placeholder={t('subuser_phone_ph')} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <div className="f3">
              <label htmlFor="tm-dob">{tp('tm_dob')}</label>
              <input id="tm-dob" className="in num-ltr" type="date" value={form.date_of_birth} onChange={(e) => setField('date_of_birth', e.target.value)} />
            </div>
            {isNew && (
              <div className="f3">
                <label htmlFor="tm-pass">{tp('tm_password')}</label>
                <input id="tm-pass" className="in" type="password" dir="ltr" autoComplete="new-password" value={form.password} placeholder={t('subuser_password_ph')} onChange={(e) => setField('password', e.target.value)} />
              </div>
            )}
          </div>

          <div className="pgroups">
            {groups.map((g) => (
              <div key={g.id} className="pg">
                <div className="h">{tp(g.id)}</div>
                {g.keys.map((k) => (
                  <div key={k} className="opt">
                    <span>{t('perm_' + k)}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!form.permissions[k]}
                      aria-label={t('perm_' + k)}
                      className={`sw2 ${form.permissions[k] ? 'on' : ''}`.trim()}
                      onClick={() => togglePerm(k)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {isNew && (
            <div className="opt" style={{ marginTop: 16, justifyContent: 'flex-start', gap: 12 }}>
              <button
                type="button"
                role="switch"
                aria-checked={form.send_email}
                aria-label={tp('tm_send_login')}
                className={`sw2 ${form.send_email ? 'on' : ''}`.trim()}
                onClick={() => setField('send_email', !form.send_email)}
              />
              <span>{tp('tm_send_login')}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Btn variant="primary" disabled={saving} onClick={() => (isNew ? create() : editingUser && saveEdit(editingUser.id))}>{t('subuser_save')}</Btn>
            <Btn onClick={closeForm}>{t('subuser_cancel')}</Btn>
          </div>
        </div>
      )}

      {passwordUser && (
        <div className="drawer">
          <h3 className="serifx">{t('subuser_set_password_title')} — {passwordUser.name}</h3>
          {error && <p className="sub" style={{ color: 'var(--crimson-ink)', marginBottom: 12 }}>{error}</p>}
          <div className="fgrid2">
            <div className="f3">
              <label htmlFor="tm-newpass">{tp('tm_password')}</label>
              <input id="tm-newpass" className="in" type="password" dir="ltr" autoComplete="new-password" value={newPassword} placeholder={t('subuser_new_password_ph')} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="primary" onClick={() => setPassword(passwordUser.id)}>{t('subuser_save')}</Btn>
            <Btn onClick={() => { setPasswordTargetId(null); setNewPassword(''); setError(''); }}>{t('subuser_cancel')}</Btn>
          </div>
        </div>
      )}

      {passwordSuccess !== null && (
        <p className="sub" style={{ color: 'var(--ok, #7fb685)', marginTop: 12 }}>{t('subuser_password_changed')}</p>
      )}
      {formFor === null && passwordTargetId === null && error && (
        <p className="sub" style={{ color: 'var(--crimson-ink)', marginTop: 12 }}>{error}</p>
      )}

      <div className="section-h" />
      {subUsers.length === 0 ? (
        <p className="locked" style={{ padding: '36px 0', justifyContent: 'center', width: '100%' }}>{t('subuser_no_users')}</p>
      ) : (
        <div className="tblbox">
          <table className="tbl2">
            <thead>
              <tr><th>{tp('tm_col_name')}</th><th>{tp('tm_col_access')}</th><th></th></tr>
            </thead>
            <tbody>
              {subUsers.map((u) => {
                const perms = u.permissions || {};
                const active = (allKeys.length ? allKeys : Object.keys(perms)).filter((k) => perms[k] === true);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="who2">
                        <Avatar name={u.name} />
                        <div>
                          <div className="n">{u.name}</div>
                          <div className="e num-ltr">{u.email}</div>
                          {u.phone && <div className="e num-ltr">{u.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {active.length === 0 ? (
                        <span className="sub">{tp('tm_no_access')}</span>
                      ) : (
                        <div className="perm">{active.map((k) => <span key={k}>{t('perm_' + k)}</span>)}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Btn size="sm" onClick={() => openEdit(u)}>{t('subuser_edit')}</Btn>
                        <Btn size="sm" variant="quiet" onClick={() => { setFormFor(null); setError(''); setPasswordTargetId(u.id); setNewPassword(''); }}>{t('subuser_set_password')}</Btn>
                        <Btn size="sm" variant="danger" onClick={() => setDeleteId(u.id)}>{t('subuser_delete')}</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title={tp('tm_del_title')}
        message={tp('tm_del_msg', { name: deleteUser?.name ?? '' })}
        confirmLabel={t('subuser_delete')}
        cancelLabel={t('subuser_cancel')}
        variant="danger"
        onConfirm={() => deleteId !== null && remove(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
