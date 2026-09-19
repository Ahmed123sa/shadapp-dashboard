'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import PasswordField from '@/components/ui/PasswordField';
import { usePermissionKeys } from '@/hooks/queries/useSubUsers';
import type { SubUser } from '@/types';

export default function ClientSubUsers({ clientId }: { clientId: number }) {
  const t = useTranslations('dashboard');
  // SUBUSER_PLAN.md §6.1 — permission keys come from the backend's single
  // source (SubUser::PERMISSION_KEYS) instead of a hardcoded copy here.
  const { data: permissionKeys = [] } = usePermissionKeys();
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', date_of_birth: '' });
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', date_of_birth: '' });

  useEffect(() => {
    api.get(`/clients/${clientId}/sub-users`)
      .then(({ data }) => setSubUsers(data.sub_users || []))
      .catch(() => setLoadError(t('subuser_load_failed')))
      .finally(() => setLoading(false));
  }, [clientId]);

  const create = async () => {
    if (!form.name || !form.email || !form.password) return;
    setError('');
    try {
      const payload: { name: string; email: string; password: string; date_of_birth?: string } = { name: form.name, email: form.email, password: form.password };
      if (form.date_of_birth) payload.date_of_birth = form.date_of_birth;
      const { data } = await api.post(`/clients/${clientId}/sub-users`, payload);
      setSubUsers((prev) => [...prev, data.sub_user]);
      setForm({ name: '', email: '', password: '', date_of_birth: '' });
      setShowForm(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('subuser_create_failed'));
    }
  };

  const saveEdit = async (userId: number) => {
    setError('');
    try {
      const payload: { name: string; email: string; phone: string; date_of_birth?: string } = { name: editForm.name, email: editForm.email, phone: editForm.phone };
      if (editForm.date_of_birth) payload.date_of_birth = editForm.date_of_birth;
      const { data } = await api.put(`/sub-users/${userId}/profile`, payload);
      setSubUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...data.sub_user } : u));
      setEditingId(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('subuser_update_failed'));
    }
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/sub-users/${id}`);
      setSubUsers((prev) => prev.filter((u) => u.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch { setError(t('subuser_delete_failed')); }
  };

  const togglePermission = async (userId: number, key: string, current: boolean) => {
    const user = subUsers.find((u) => u.id === userId);
    if (!user) return;
    const permissions = { ...(user.permissions || {}), [key]: !current };
    try {
      const { data } = await api.patch(`/sub-users/${userId}/permissions`, { permissions });
      setSubUsers((prev) =>
        prev.map((u) => u.id === userId ? { ...u, permissions: data.sub_user?.permissions || permissions } : u)
      );
    } catch {
      setError(t('subuser_save_perms_failed'));
    }
  };

  if (loading) return <TableSkeleton />;
  if (loadError) return <p className="text-sm text-red-500 text-center py-8">{loadError}</p>;

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(!showForm)} className="text-sm text-[var(--color-gold-text)] hover:underline font-medium">
        {t('subuser_new')}
      </button>

      {showForm && (
        <div className="space-y-2 border border-[var(--color-card-border)] rounded-lg p-4 bg-[var(--color-card-border)]">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('subuser_name_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)] placeholder-[var(--color-text-disabled)]" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            type="email" placeholder={t('subuser_email_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)] placeholder-[var(--color-text-disabled)]" dir="ltr" />
          <PasswordField value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder={t('subuser_password_ph')} />
          <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)] placeholder-[var(--color-text-disabled)]" />
          <button onClick={create} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)]">{t('subuser_save')}</button>
        </div>
      )}

      {subUsers.length === 0 ? <EmptyState message={t('subuser_no_users')} /> : null}
      <div className="space-y-2">
        {subUsers.map((u) => {
          const perms = u.permissions || {};
          const activeCount = Object.values(perms).filter((v) => v === true).length;
          const isExpanded = expandedId === u.id;
          return (
            <div key={u.id} className="border border-[var(--color-card-border)] rounded-lg overflow-hidden">
              {editingId === u.id ? (
                <div className="p-3 space-y-2">
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder={t('subuser_name_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
                  <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    type="email" placeholder={t('subuser_email_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" dir="ltr" />
                  <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder={t('subuser_phone_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" dir="ltr" />
                  <input type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                    className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(u.id)} className="bg-[var(--color-primary)] text-white px-4 py-1.5 rounded-lg text-xs hover:bg-[var(--color-primary-dark)]">{t('subuser_save')}</button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-1.5 rounded-lg text-xs border border-[var(--color-card-border)] hover:bg-[var(--color-card-border)]">{t('subuser_cancel')}</button>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-sm flex items-center justify-between">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-[var(--color-text-disabled)]" dir="ltr">{u.email}</p>
                    <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">{t('subuser_permissions_count', { count: activeCount })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      setEditingId(u.id);
                      setEditForm({ name: u.name || '', email: u.email || '', phone: u.phone || '', date_of_birth: u.date_of_birth ? String(u.date_of_birth).substring(0, 10) : '' });
                    }}
                      className="text-xs text-[var(--color-gold-text)] hover:underline">{t('subuser_edit')}</button>
                    <button onClick={() => setExpandedId(isExpanded ? null : u.id)}
                      className="text-xs text-[var(--color-text-secondary)] hover:underline">
                      {isExpanded ? t('subuser_hide') : t('subuser_permissions')}
                    </button>
                    <button onClick={() => remove(u.id)} className="text-xs text-red-500 hover:underline">{t('subuser_delete')}</button>
                  </div>
                </div>
              )}
              {isExpanded && (
                <div className="border-t border-[var(--color-card-border)] p-3 space-y-1">
                  {permissionKeys.map((key) => (
                    <label key={key} className="flex items-center justify-between py-1 cursor-pointer">
                      <span className="text-xs text-[var(--color-foreground)]">{t('perm_' + key)}</span>
                      <button
                        onClick={() => togglePermission(u.id, key, !!perms[key])}
                        aria-pressed={!!perms[key]}
                        aria-label={t('perm_' + key)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          perms[key] ? 'bg-[var(--color-primary)]' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          perms[key] ? 'translate-x-0.5' : 'translate-x-4'
                        }`} />
                      </button>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
