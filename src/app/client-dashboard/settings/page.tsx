'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useTranslations } from 'next-intl';
import { isClientAuthenticated, getClient, isSubUser, getSubUser } from '@/lib/client-auth';
import { useLocale } from '@/lib/locale';
import ClientShell from '@/components/client-portal/ClientShell';
import { Avatar, Btn, Segmented } from '@/components/client-portal/ui';
import { useClientPortalPage } from '@/hooks/useClientPortalPage';
import { reportError } from '@/lib/error-reporting';
import { resolveFileUrl } from '@/lib/utils';

export default function ClientSettingsPage() {
  const t = useTranslations('dashboard');
  const tp = useTranslations('client_portal');
  const { locale, switchLocale } = useLocale();
  const { wsCount } = useClientPortalPage();
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
    <ClientShell company={session?.company_name ?? ''} userName={displayName || session?.contact_person || session?.company_name || ''} active="set" wsCount={wsCount}>
      <div className="page">
        <div className="ph2">
          <div>
            <div className="eyebrow">{tp('grp_account')}</div>
            <h1 className="serifx">{t('settings_title')}<i>.</i></h1>
            <p>{tp('set_desc')}</p>
          </div>
        </div>

        {success && <p className="sub" role="status" style={{ color: 'var(--ok, #7fb685)', marginBottom: 14 }}>{t('settings_saved')}</p>}

        <div className="fsec2">
          <div>
            <h3>{tp('set_profile_h')}</h3>
            <p>{tp('set_profile_p')}</p>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
              <Avatar name={displayName || '?'} src={avatarPreview || null} size={72} />
              <Btn size="sm" onClick={() => avatarInputRef.current?.click()}>{t('change_photo')}</Btn>
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </div>

            <div className="fgrid2">
              <div className="f3">
                <label htmlFor="client-settings-display-name">{t('display_name')}</label>
                <input id="client-settings-display-name" className="in" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>

              {isSub && (
                <div className="f3">
                  <label htmlFor="client-settings-phone">{t('phone')}</label>
                  <input id="client-settings-phone" className="in num-ltr" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              )}

              <div className="f3">
                <label htmlFor="client-settings-email">{t('email')}</label>
                <input id="client-settings-email" className="in" dir="ltr" value={isSub ? email : (session?.email || '')} disabled style={{ opacity: 0.6 }} />
                {isSub && <p className="sub" style={{ marginTop: 6 }}>{t('subuser_settings_contact_owner')}</p>}
              </div>

              <div className="f3">
                <label htmlFor="client-settings-dob">{t('dob')}</label>
                <input id="client-settings-dob" className="in num-ltr" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
            </div>

            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? '...' : t('save_settings')}</Btn>
          </div>
        </div>

        <div className="fsec2" style={{ marginTop: 18 }}>
          <div>
            <h3>{tp('set_lang_h')}</h3>
            <p>{tp('set_lang_p')}</p>
          </div>
          <div>
            <Segmented
              value={locale === 'ar' ? 'ar' : 'en'}
              onChange={(next) => { if (next !== locale) switchLocale(next); }}
              options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]}
            />
          </div>
        </div>
      </div>
    </ClientShell>
  );
}
