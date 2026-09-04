'use client';

import { Search, Building2, User, Settings, Trash2, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { useEffect, useState, useCallback, useId } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ClientTypeBadge } from '@/components/ui/ClientTypeBadge';
import PasswordField from '@/components/ui/PasswordField';
import { reportError } from '@/lib/error-reporting';
import ErrorState from '@/components/ErrorState';
import type { Client } from '@/types';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[length:var(--fs-1)] tracking-wider font-medium text-[var(--color-text-secondary)] uppercase mb-2">{children}</p>;
}

function InputField({ label, required, id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div>
      <label htmlFor={inputId} className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">{label}{required && <span className="text-red-400 ms-0.5">*</span>}</label>
      <input id={inputId} className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-gold)] focus:outline-none transition-colors" {...props} />
    </div>
  );
}

export default function ClientsPage() {
  const t = useTranslations('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ company_name: '', contact_person: '', email: '', phone: '', password: '', notes: '', date_of_birth: '', send_email: true, client_type: 'business' as 'business' | 'individual', country: '', industry: '', address: '', maps_url: '' });
  const [autoPassword, setAutoPassword] = useState(true);
  const [newCreds, setNewCreds] = useState<{ email: string; password: string } | null>(null);
  const [createError, setCreateError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchClients = useCallback((p: number, q?: string) => {
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams({ page: String(p), per_page: '30' });
    if (q) params.set('q', q);
    api.get(`/clients?${params}`).then(({ data }) => {
      setClients(data.clients?.data || data.clients || []);
      setTotalPages(data.clients?.last_page || 1);
    }).catch((err) => { reportError('ClientsPage.fetchClients', err); setLoadError(true); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(1); fetchClients(1, debouncedQuery); }, [debouncedQuery]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.company_name.trim()) errors.company_name = t('val_company_required');
    if (!form.contact_person.trim()) errors.contact_person = t('val_contact_required');
    if (!form.email.trim()) errors.email = t('val_email_required');
    else if (!form.email.includes('@')) errors.email = t('val_email_invalid');
    if (!form.phone.trim()) errors.phone = t('val_phone_required');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setCreateError('');
    try {
      const { password, ...rest } = form;
      const payload = autoPassword ? rest : { ...rest, password };
      const { data } = await api.post('/clients', payload);
      if (data.client?.id && avatarFile) {
        try {
          const fd = new FormData();
          fd.append('avatar', avatarFile);
          await api.post(`/clients/${data.client.id}/profile`, fd);
        } catch (err) {
          reportError('ClientsPage.createClient.uploadAvatar', err);
        }
      }
      setClients((prev) => [data.client, ...prev]);
      setNewCreds(data.credentials);
      setShowCreate(false);
      setForm({ company_name: '', contact_person: '', email: '', phone: '', password: '', notes: '', date_of_birth: '', send_email: true, client_type: 'business', country: '', industry: '', address: '', maps_url: '' });
      setAutoPassword(true);
      setAvatarFile(null);
      setAvatarPreview('');
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || t('create_failed'));
    }
  };

  const deleteClient = async (id: number) => {
    if (!confirm(t('delete_confirm'))) return;
    const { data } = await api.delete(`/clients/${id}`).catch(() => ({ data: null }));
    if (data) setClients((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading) return <div className="p-4"><TableSkeleton rows={6} /></div>;
  if (loadError) return <ErrorState onRetry={() => fetchClients(page, debouncedQuery)} />;

  const isSA = getUser()?.role === 'super_admin';

  const update = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">{t('clients')}</h2>
        {!isSA && <button onClick={() => setShowCreate(true)} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)]">
          + {t('new_client')}
        </button>}
      </div>

      <div className="mb-4 relative">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('client_search')}
          className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl px-4 py-2.5 pe-10 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-gold)] focus:outline-none"
        />
        <Search size={16} strokeWidth={2} className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
      </div>

      {newCreds && (
        <div className="bg-green-900/30 border border-green-900/30 rounded-xl p-4 mb-4">
          <p className="text-green-400 font-medium mb-2">{t('client_created')}</p>
          <p className="text-sm text-green-400">{t('email')}: {newCreds.email}</p>
          <p className="text-sm text-green-400">{t('manager_password')}: {newCreds.password}</p>
        </div>
      )}

      {showCreate && (
        <form onSubmit={createClient} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 mb-6 space-y-5">
          {createError && <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg">{createError}</div>}

          {/* الصورة */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full bg-[var(--color-card-border)] border-2 border-dashed border-[var(--color-card-border)] flex items-center justify-center overflow-hidden shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={32} strokeWidth={1} className="text-[var(--color-text-secondary)]" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-foreground)]">{t('client_photo')}</p>
              <p className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)] mb-2">{t('client_photo_hint')}</p>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-card-border)] text-xs text-[var(--color-foreground)] cursor-pointer hover:bg-[var(--color-input-fill)] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                {t('add_photo')}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} />
              </label>
            </div>
          </div>

          {/* نوع العميل */}
          <div>
            <SectionLabel>{t('client_type')}</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {(['business', 'individual'] as const).map(ct => {
                const active = form.client_type === ct;
                const isBiz = ct === 'business';
                return (
                  <button type="button" key={ct} onClick={() => update('client_type', ct)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${active ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10' : 'border-[var(--color-card-border)] bg-transparent hover:border-[var(--color-text-secondary)]'}`}>
                    <span className="text-xl">{isBiz ? <Building2 size={20} strokeWidth={1.5} /> : <User size={20} strokeWidth={1.5} />}</span>
                    <span className={`text-xs font-semibold ${active ? 'text-[var(--color-gold-text)]' : 'text-[var(--color-text-secondary)]'}`}>{isBiz ? t('company') : t('individual')}</span>
                    <span className="text-[9px] text-[var(--color-text-secondary)]">{isBiz ? 'Business' : 'Individual'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* بيانات الشركة */}
          <div>
            <SectionLabel>{t('company_data')}</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InputField label={t('company_name')} required placeholder={t('company_name_ph')} value={form.company_name} onChange={e => update('company_name', e.target.value)} />
              <InputField label={t('contact_person')} required placeholder={t('contact_person_ph')} value={form.contact_person} onChange={e => update('contact_person', e.target.value)} />
              <InputField label={t('email')} required type="email" placeholder={t('email_ph')} value={form.email} onChange={e => update('email', e.target.value)} dir="ltr" />
              <InputField label={t('phone')} required type="tel" placeholder={t('phone_ph')} value={form.phone} onChange={e => update('phone', e.target.value)} dir="ltr" />
            </div>
          </div>

          {/* تفاصيل إضافية */}
          <div>
            <SectionLabel>{t('additional_details')}</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InputField label={t('country')} placeholder={t('country_ph')} value={form.country} onChange={e => update('country', e.target.value)} />
              <InputField label={t('industry')} placeholder={t('industry_ph')} value={form.industry} onChange={e => update('industry', e.target.value)} />
              <InputField label={t('dob')} type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} />
            </div>
          </div>

          {/* العنوان والموقع */}
          <div>
            <SectionLabel>{t('address_location')}</SectionLabel>
            <div className="space-y-3">
              <textarea className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-gold)] focus:outline-none transition-colors" rows={2} placeholder={t('address_ph')} value={form.address} onChange={e => update('address', e.target.value)} />
              <InputField label={t('maps_link')} placeholder={t('maps_link_ph')} value={form.maps_url} onChange={e => update('maps_url', e.target.value)} />
              <button type="button" onClick={() => { const q = form.address.trim() || form.maps_url.trim(); if (q) window.open(q.startsWith('http') ? q : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank'); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-card-border)] text-xs text-[var(--color-foreground)] hover:bg-[var(--color-input-fill)] transition-colors">
                <MapPin size={13} strokeWidth={1.5} /> {t('open_on_maps')}
              </button>
            </div>
          </div>

          {/* كلمة المرور */}
          <div>
            <SectionLabel>{t('manager_password')}</SectionLabel>
            <div className="flex items-center justify-between bg-[var(--color-card-border)]/30 rounded-lg px-4 py-3 border border-[var(--color-card-border)] mb-3">
              <div>
              <p className="text-sm font-medium text-[var(--color-foreground)]">{t('auto_password')}</p>
              <p className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{t('auto_password_hint')}</p>
              </div>
              <button type="button" onClick={() => setAutoPassword(!autoPassword)}
                className={`relative w-10 h-5 rounded-full transition-colors ${autoPassword ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-card-border)]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoPassword ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {!autoPassword && (
              <PasswordField value={form.password} onChange={(v) => update('password', v)} label={t('manager_password')} placeholder={t('manager_pw_ph')} showStrength showRequirements />
            )}
          </div>

          {/* ملاحظات */}
          <div>
            <SectionLabel>{t('notes')}</SectionLabel>
            <textarea aria-label={t('notes')} className="w-full bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-gold)] focus:outline-none transition-colors" rows={2} placeholder={t('notes_ph')} value={form.notes} onChange={e => update('notes', e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--color-foreground)] cursor-pointer">
            <input type="checkbox" checked={form.send_email} onChange={(e) => setForm({ ...form, send_email: e.target.checked })} className="rounded" />
            {t('send_login_email')}
          </label>

          <div className="flex gap-2 pt-1">
            <button type="submit" className="bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors">{t('create')}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="bg-[var(--color-input-fill)] px-6 py-2.5 rounded-lg text-sm hover:bg-[var(--color-card-border)] transition-colors">{t('cancel')}</button>
          </div>
        </form>
      )}

      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-card-border)] border-b border-[var(--color-card-border)]">
            <tr>
              <th className="text-center p-4 font-medium">{t('col_company')}</th>
              <th className="text-center p-4 font-medium">{t('col_type')}</th>
              <th className="text-center p-4 font-medium">{t('col_contact')}</th>
              <th className="text-center p-4 font-medium">{t('col_status')}</th>
              <th className="text-center p-4 font-medium">{t('col_workspace')}</th>
              <th className="text-center p-4 font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-[var(--color-card-border)] hover:bg-[var(--color-card-border)]">
                <td className="p-4 text-center">
                  <Link href={`/dashboard/clients/${client.id}`} className="text-[var(--color-gold-text)] hover:underline font-medium">{client.company_name}</Link>
                </td>
                <td className="p-4 text-center"><ClientTypeBadge clientType={client.client_type} /></td>
                <td className="p-4 text-center text-[var(--color-text-secondary)]">{client.contact_person}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${client.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-zinc-700/30 text-zinc-400'}`}>{client.status}</span>
                </td>
                <td className="p-4 text-center">{client.workspace ? (client.workspace.status === 'active' ? <><CheckCircle2 size={14} strokeWidth={1.5} className="inline text-green-400" /> {t('active')}</> : <><Clock size={14} strokeWidth={1.5} className="inline text-zinc-400" /> {t('inactive')}</>) : '—'}</td>
                <td className="p-4 text-end whitespace-nowrap">
                  {!isSA && <Link href={`/dashboard/clients/${client.id}/settings`} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--color-card-border)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)]" title={t('settings_title')}><Settings size={16} strokeWidth={1.5} /></Link>}
                  {!isSA && <button onClick={() => deleteClient(client.id)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-red-900/30 transition-colors text-[var(--color-text-secondary)] hover:text-red-400" title={t('delete')}><Trash2 size={16} strokeWidth={1.5} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-[var(--color-card-border)]">
            <button onClick={() => { const p = page - 1; setPage(p); fetchClients(p); }} disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded border border-[var(--color-card-border)] hover:bg-[var(--color-card-border)] disabled:opacity-50">{t('previous')}</button>
            <span className="text-sm text-[var(--color-text-secondary)]">{t('page_of', { page, total: totalPages })}</span>
            <button onClick={() => { const p = page + 1; setPage(p); fetchClients(p); }} disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded border border-[var(--color-card-border)] hover:bg-[var(--color-card-border)] disabled:opacity-50">{t('next')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
