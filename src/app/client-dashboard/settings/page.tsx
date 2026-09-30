'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useTranslations } from 'next-intl';
import { isClientAuthenticated, getClient, clientLogout, isSubUser, getSubUser } from '@/lib/client-auth';
import { reportError } from '@/lib/error-reporting';
import { resolveFileUrl } from '@/lib/utils';

export default function ClientSettingsPage() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const session = getClient();
  // subuser-review-plan.md م٤ — this page used to be entirely unaware that a
  // sub-user could reach it at all: it always fetched/saved the *client's*
  // record (`GET`/`POST /clients/{id}...`), so a sub-user saw the primary
  // client's own name/photo/DOB and any save silently updated the client
  // instead of them (or 403'd, depending on the field). A sub-user now reads
  // and writes their own `/sub-users/{id}` record; the primary client's
  // fields and behavior below are unchanged.
  const isSub = isSubUser();
  const subUser = getSubUser();
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && !isClientAuthenticated()) {
      router.push('/client-login');
    }
  }, [router]);

  useEffect(() => {
    if (isSub) {
      if (!subUser?.id) return;
      api.get(`/sub-users/${subUser.id}`).then(({ data }) => {
        const s = data.sub_user;
        setDisplayName(s.name || '');
        setEmail(s.email || '');
        setPhone(s.phone || '');
        if (s.date_of_birth) setDateOfBirth(String(s.date_of_birth).substring(0, 10));
        if (s.avatar_url) setAvatarPreview(resolveFileUrl(s.avatar_url));
      }).catch((err) => reportError('ClientSettingsPage.loadSubUser', err));
      return;
    }
    if (!session?.id) return;
    api.get(`/clients/${session.id}`).then(({ data }) => {
      const c = data.client;
      setDisplayName(c.contact_person || '');
      setEmail(c.email || '');
      if (c.date_of_birth) setDateOfBirth(String(c.date_of_birth).substring(0, 10));
      if (c.avatar_url) setAvatarPreview(resolveFileUrl(c.avatar_url));
    }).catch((err) => reportError('ClientSettingsPage.loadClient', err));
  }, [session?.id, isSub, subUser?.id]);

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
    try {
      if (isSub) {
        const form = new FormData();
        if (avatar) form.append('avatar', avatar);
        form.append('name', displayName);
        form.append('phone', phone);
        if (dateOfBirth) form.append('date_of_birth', dateOfBirth);
        await api.post(`/sub-users/${subUser!.id}/profile`, form);
      } else {
        const form = new FormData();
        if (avatar) form.append('avatar', avatar);
        form.append('contact_person', displayName);
        if (dateOfBirth) form.append('date_of_birth', dateOfBirth);
        await api.post(`/clients/${session!.id}/profile`, form);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      reportError('ClientSettingsPage.save', err);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <header className="bg-[var(--color-card)] border-b border-[var(--color-card-border)] px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">ShadApp</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-text-secondary)]">{session?.company_name}</span>
          <button onClick={clientLogout} className="text-xs bg-[var(--color-input-fill)] hover:bg-zinc-200 px-3 py-1.5 rounded-lg">{t('logout')}</button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/client-dashboard')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)]">&larr; {tc('back')}</button>
          <h2 className="text-xl font-bold">{t('settings_title')}</h2>
        </div>

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-emerald-300 text-sm">{t('settings_saved')}</div>
        )}

        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full bg-[var(--color-input-fill)] overflow-hidden border-2 border-zinc-200">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-[var(--color-text-disabled)]">
                  {displayName?.[0] || '?'}
                </div>
              )}
            </div>
            <button onClick={() => avatarInputRef.current?.click()} type="button"
              className="bg-[var(--color-input-fill)] hover:bg-zinc-200 px-4 py-2 rounded-lg text-sm transition-colors">
              {t('change_photo')}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          <div className="space-y-1">
            <label htmlFor="client-settings-display-name" className="text-xs text-[var(--color-text-secondary)]">{t('display_name')}</label>
            <input id="client-settings-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="border border-[var(--color-card-border)] rounded-lg px-4 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
          </div>

          {isSub && (
            <div className="space-y-1">
              <label htmlFor="client-settings-phone" className="text-xs text-[var(--color-text-secondary)]">{t('phone')}</label>
              <input id="client-settings-phone" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="border border-[var(--color-card-border)] rounded-lg px-4 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" dir="ltr" />
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="client-settings-email" className="text-xs text-[var(--color-text-secondary)]">{t('email')}</label>
            <input id="client-settings-email" value={isSub ? email : (session?.email || '')} disabled
              className="border border-[var(--color-card-border)] rounded-lg px-4 py-2 text-sm w-full bg-[var(--color-card-border)] text-[var(--color-text-disabled)]" dir="ltr" />
            {isSub && (
              <p className="text-xs text-[var(--color-text-disabled)] pt-1">{t('subuser_settings_contact_owner')}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="client-settings-dob" className="text-xs text-[var(--color-text-secondary)]">{t('dob')}</label>
            <input id="client-settings-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
              className="border border-[var(--color-card-border)] rounded-lg px-4 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
          </div>

          <button onClick={save} disabled={saving}
            className="bg-[var(--color-primary)] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50 w-full">
            {saving ? '...' : t('save_settings')}
          </button>
        </div>
      </main>
    </div>
  );
}
