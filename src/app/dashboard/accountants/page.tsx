'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Plus } from 'lucide-react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { reportError } from '@/lib/error-reporting';
import PasswordField from '@/components/ui/PasswordField';
import { StatusBadge } from '@/components/ui/StatusBadge';

// Accountants (ACCOUNTANT_ROLE_PLAN.md): created and managed by the super admin
// only. The backend answers 403 to everyone else and proxy.ts keeps the page
// from being served. Accountants are never deleted, only deactivated, so the
// audit log keeps their real names.

interface Accountant {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
}

type Mode = { kind: 'none' } | { kind: 'create' } | { kind: 'edit'; id: number } | { kind: 'password'; id: number };

export default function AccountantsPage() {
  const locale = useLocale();
  const ar = locale === 'ar';
  const tx = (a: string, e: string) => (ar ? a : e);
  const isSA = getUser()?.role === 'super_admin';

  const [items, setItems] = useState<Accountant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<Mode>({ kind: 'none' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/accountants');
      setItems(data.accountants || []);
      setLoadError('');
    } catch (err) {
      reportError('AccountantsPage.load', err);
      setLoadError(tx('تعذر تحميل المحاسبين.', 'Could not load accountants.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ar]);

  useEffect(() => {
    if (isSA) void load();
    else setLoading(false);
  }, [isSA, load]);

  const reset = () => {
    setMode({ kind: 'none' });
    setName(''); setEmail(''); setPhone(''); setPassword(''); setSendEmail(true); setFormError('');
  };

  const msg = (err: unknown, fallback: string) => {
    const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
    const first = e?.response?.data?.errors ? Object.values(e.response.data.errors)[0]?.[0] : undefined;
    return first || e?.response?.data?.message || fallback;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (mode.kind === 'create') {
        await api.post('/accountants', { name, email, phone: phone || null, password, send_email: sendEmail });
      } else if (mode.kind === 'edit') {
        await api.put(`/accountants/${mode.id}`, { name, email, phone: phone || null });
      } else if (mode.kind === 'password') {
        await api.patch(`/accountants/${mode.id}/password`, { password });
      }
      reset();
      await load();
    } catch (err) {
      setFormError(msg(err, tx('تعذر الحفظ.', 'Could not save.')));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (a: Accountant) => {
    const deactivating = a.is_active;
    if (deactivating && !confirm(tx(`إيقاف المحاسب ${a.name}؟ هيتفصل فورًا.`, `Deactivate ${a.name}? They are signed out immediately.`))) return;
    setBusyId(a.id);
    setLoadError('');
    try {
      await api.post(`/accountants/${a.id}/${deactivating ? 'deactivate' : 'activate'}`);
      await load();
    } catch (err) {
      setLoadError(msg(err, tx('تعذر تنفيذ العملية.', 'Action failed.')));
    } finally {
      setBusyId(null);
    }
  };

  if (!isSA) return null;

  const inputCls = 'w-full bg-[var(--color-input-fill)] border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-gold)]';
  const btnGhost = 'px-3 py-1.5 rounded-lg text-xs border border-[var(--color-card-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] transition disabled:opacity-50 cursor-pointer';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{tx('المحاسبون', 'Accountants')}</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {tx('بيشوفوا المالية في الشركة كلها ويوافقوا أو يرفضوا المدفوعات فقط.', 'They see company-wide finance and can only approve or reject payments.')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { reset(); setMode({ kind: 'create' }); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[var(--color-primary)] text-white hover:opacity-90 transition cursor-pointer"
        >
          <Plus size={14} /> {tx('إضافة محاسب', 'Add accountant')}
        </button>
      </div>

      {loadError && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">{loadError}</div>}

      {mode.kind !== 'none' && (
        <form onSubmit={submit} className="bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl p-5 space-y-3 max-w-xl">
          {formError && <div role="alert" className="rounded-lg bg-red-500/10 text-red-400 text-xs p-3">{formError}</div>}
          {mode.kind !== 'password' && (
            <>
              <div>
                <label htmlFor="acc-name" className="block text-xs text-[var(--color-text-secondary)] mb-1">{tx('الاسم', 'Name')}</label>
                <input id="acc-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="acc-email" className="block text-xs text-[var(--color-text-secondary)] mb-1">{tx('الإيميل', 'Email')}</label>
                <input id="acc-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="acc-phone" className="block text-xs text-[var(--color-text-secondary)] mb-1">{tx('الموبايل (اختياري)', 'Phone (optional)')}</label>
                <input id="acc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
              </div>
            </>
          )}
          {mode.kind !== 'edit' && (
            <PasswordField
              value={password}
              onChange={setPassword}
              label={mode.kind === 'password' ? tx('كلمة السر الجديدة', 'New password') : tx('كلمة السر', 'Password')}
              placeholder={tx('8 حروف على الأقل بحروف وأرقام', 'At least 8 characters with letters and numbers')}
              required
            />
          )}
          {mode.kind === 'create' && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              {tx('ابعت بيانات الدخول بالإيميل', 'Email the login details')}
            </label>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} aria-busy={saving} className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50 cursor-pointer">
              {tx('حفظ', 'Save')}
            </button>
            <button type="button" onClick={reset} className="bg-[var(--color-input-fill)] px-6 py-2 rounded-lg text-sm cursor-pointer">{tx('إلغاء', 'Cancel')}</button>
          </div>
        </form>
      )}

      <div className="bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-[var(--color-text-secondary)]">{tx('جاري التحميل...', 'Loading...')}</div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <p className="text-sm font-medium text-[var(--color-foreground)]">{tx('لسه مفيش محاسبين.', 'No accountants yet.')}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{tx('أضف محاسب عشان يراجع المدفوعات.', 'Add one to start reviewing payments.')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-card-border)]">
            {items.map((a) => (
              <li key={a.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[var(--color-foreground)] [overflow-wrap:anywhere]">{a.name}</span>
                    <StatusBadge status={a.is_active ? 'active' : 'inactive'} />
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">{a.email}{a.phone ? ` • ${a.phone}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnGhost} onClick={() => { reset(); setName(a.name); setEmail(a.email); setPhone(a.phone || ''); setMode({ kind: 'edit', id: a.id }); }}>
                    {tx('تعديل', 'Edit')}
                  </button>
                  <button type="button" className={btnGhost} onClick={() => { reset(); setMode({ kind: 'password', id: a.id }); }}>
                    {tx('تغيير كلمة السر', 'Change password')}
                  </button>
                  <button type="button" className={btnGhost} disabled={busyId === a.id} aria-busy={busyId === a.id} onClick={() => toggle(a)}>
                    {a.is_active ? tx('إيقاف', 'Deactivate') : tx('تفعيل', 'Activate')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
