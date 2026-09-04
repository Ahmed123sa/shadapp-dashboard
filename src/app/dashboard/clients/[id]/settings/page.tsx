'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ClientTypeBadge } from '@/components/ui/ClientTypeBadge';
import PasswordField from '@/components/ui/PasswordField';
import { Building2, User, MapPin } from 'lucide-react';
import { reportError } from '@/lib/error-reporting';
import { resolveFileUrl } from '@/lib/utils';
import type { Client } from '@/types';

export default function ClientSettingsPage() {
  const { id } = useParams();
  const router = useRouter();
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [form, setForm] = useState({
    company_name: '', contact_person: '', phone: '', email: '',
    country: '', industry: '', notes: '', date_of_birth: '', password: '',
    client_type: 'business' as 'business' | 'individual', address: '', maps_url: '',
  });
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/clients/${id}`).then(({ data }) => {
      const c = data.client;
      setClient(c);
      setForm({
        company_name: c.company_name || '',
        contact_person: c.contact_person || '',
        phone: c.phone || '',
        email: c.email || '',
        country: c.country || '',
        industry: c.industry || '',
        notes: c.notes || '',
        date_of_birth: c.date_of_birth ? String(c.date_of_birth).substring(0, 10) : '',
        password: '',
        client_type: c.client_type || 'business',
        address: c.address || '',
        maps_url: c.maps_url || '',
      });
      if (c.avatar_url) setAvatarPreview(resolveFileUrl(c.avatar_url));
    }).catch((err) => reportError('ClientSettingsPage.loadClient', err)).finally(() => setLoading(false));
  }, [id]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const save = async () => {
    setSaving(true);
    setSuccess(false);
    setError('');
    try {
      if (avatar) {
        const fd = new FormData();
        fd.append('avatar', avatar);
        fd.append('contact_person', form.contact_person);
        await api.post(`/clients/${id}/profile`, fd);
      }

      const payload: {
        company_name: string; contact_person: string; email: string; phone: string;
        country: string | null; industry: string | null; notes: string | null;
        date_of_birth: string | null; client_type: 'business' | 'individual';
        address: string | null; maps_url: string | null; password?: string;
      } = {
        company_name: form.company_name,
        contact_person: form.contact_person,
        email: form.email,
        phone: form.phone,
        country: form.country || null,
        industry: form.industry || null,
        notes: form.notes || null,
        date_of_birth: form.date_of_birth || null,
        client_type: form.client_type,
        address: form.address || null,
        maps_url: form.maps_url || null,
      };
      if (form.password) payload.password = form.password;
      await api.put(`/clients/${id}`, payload);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('settings_save_error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-20"><LoadingSkeleton message={t('loading_clients_settings')} /></div>;
  if (!client) return <div className="py-20 text-center text-[var(--color-text-secondary)]">{t('not_found')}</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)]">&larr; {tc('back')}</button>
        <h1 className="text-xl font-bold">{t('edit_title', { name: client.company_name })}</h1>
        <ClientTypeBadge clientType={client.client_type} />
      </div>

      {success && (
        <div className="bg-emerald-900/30 border border-emerald-800/30 rounded-xl p-4 text-emerald-400 text-sm">{t('settings_saved')}</div>
      )}
      {error && (
        <div className="bg-red-900/30 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-[var(--color-input-fill)] overflow-hidden border-2 border-[var(--color-card-border)]">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-[var(--color-text-disabled)]">
                {client.company_name?.[0] || '?'}
              </div>
            )}
          </div>
          <button onClick={() => avatarInputRef.current?.click()} type="button"
            className="bg-[var(--color-input-fill)] hover:bg-[var(--color-card-border)] px-4 py-2 rounded-lg text-sm transition-colors">
            {t('change_photo')}
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* نوع العميل */}
        <div>
          <p className="text-[length:var(--fs-1)] tracking-wider font-medium text-[var(--color-text-secondary)] uppercase mb-2">{t('client_type')}</p>
          <div className="grid grid-cols-2 gap-3">
            {(['business', 'individual'] as const).map(ct => {
              const active = form.client_type === ct;
              const isBiz = ct === 'business';
              return (
                <button type="button" key={ct} onClick={() => setForm(f => ({ ...f, client_type: ct }))}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${active ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10' : 'border-[var(--color-card-border)] bg-transparent hover:border-[var(--color-text-secondary)]'}`}>
                  <span className="text-xl">{isBiz ? <Building2 size={20} strokeWidth={1.5} /> : <User size={20} strokeWidth={1.5} />}</span>
                  <span className={`text-xs font-semibold ${active ? 'text-[var(--color-gold-text)]' : 'text-[var(--color-text-secondary)]'}`}>{isBiz ? t('company') : t('individual')}</span>
                  <span className="text-[9px] text-[var(--color-text-secondary)]">{isBiz ? 'Business' : 'Individual'}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="client-settings-company-name" className="text-xs text-[var(--color-text-secondary)]">{t('company_name')}</label>
            <input id="client-settings-company-name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className="bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" />
          </div>
          <div className="space-y-1">
            <label htmlFor="client-settings-contact-person" className="text-xs text-[var(--color-text-secondary)]">{t('contact_person')}</label>
            <input id="client-settings-contact-person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
              className="bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" />
          </div>
          <div className="space-y-1">
            <label htmlFor="client-settings-email" className="text-xs text-[var(--color-text-secondary)]">{t('email')}</label>
            <input id="client-settings-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr"
              className="bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" />
          </div>
          <div className="space-y-1">
            <label htmlFor="client-settings-phone" className="text-xs text-[var(--color-text-secondary)]">{t('phone')}</label>
            <input id="client-settings-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" dir="ltr" />
          </div>
          <div className="space-y-1">
            <label htmlFor="client-settings-country" className="text-xs text-[var(--color-text-secondary)]">{t('country')}</label>
            <input id="client-settings-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" />
          </div>
          <div className="space-y-1">
            <label htmlFor="client-settings-industry" className="text-xs text-[var(--color-text-secondary)]">{t('industry')}</label>
            <input id="client-settings-industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
              className="bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" />
          </div>
          <div className="space-y-1">
            <label htmlFor="client-settings-dob" className="text-xs text-[var(--color-text-secondary)]">{t('dob')}</label>
            <input id="client-settings-dob" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              className="bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="client-settings-notes" className="text-xs text-[var(--color-text-secondary)]">{t('notes')}</label>
            <textarea id="client-settings-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full resize-none" rows={3} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="client-settings-address" className="text-xs text-[var(--color-text-secondary)]">{t('address_location')}</label>
            <textarea id="client-settings-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder={t('address_ph')}
              className="bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full resize-none" rows={2} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="client-settings-maps-url" className="text-xs text-[var(--color-text-secondary)]">{t('maps_link')}</label>
            <div className="flex gap-2">
              <input id="client-settings-maps-url" value={form.maps_url} onChange={(e) => setForm({ ...form, maps_url: e.target.value })}
                placeholder={t('maps_link_ph')} dir="ltr"
                className="bg-[var(--color-input-fill)] border-[var(--color-input-border)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" />
              <button type="button"
                onClick={() => { const q = form.address.trim() || form.maps_url.trim(); if (q) window.open(q.startsWith('http') ? q : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank'); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-card-border)] text-xs text-[var(--color-foreground)] hover:bg-[var(--color-input-fill)] transition-colors whitespace-nowrap">
                <MapPin size={13} strokeWidth={1.5} /> {t('open_on_maps')}
              </button>
            </div>
            <p className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{t('maps_link_hint')}</p>
          </div>
        </div>

        <div className="border-t border-[var(--color-card-border)] pt-4">
          <PasswordField value={form.password} onChange={(v) => setForm({ ...form, password: v })} label={t('change_password')} placeholder={t('password_leave_empty')} opt />
        </div>

        <button onClick={save} disabled={saving}
          className="bg-[var(--color-primary)] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50 w-full">
          {saving ? '...' : t('save_changes')}
        </button>
      </div>
    </div>
  );
}
