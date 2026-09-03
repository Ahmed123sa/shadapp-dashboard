'use client';

import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { getUser, logout } from '@/lib/auth';
import { asSettingFlag, resolveFileUrl } from '@/lib/utils';
import { reportError } from '@/lib/error-reporting';
import { useTranslations } from 'next-intl';
import type { ContractClauseTemplate } from '@/types';

// Shape used while editing a clause inline — a subset of ContractClauseTemplate
// (is_active/sort_order aren't edited here, so they're left off).
type EditingClause = { id: number; content: string; type: 'fixed' | 'optional'; category?: string };

// The backend has no `signature_type` field on users — signatures are
// distinguished by shape, not a stored flag. Detecting it here directly
// avoids the bug where an uploaded/drawn image signature would render as
// raw path text instead of the actual image.
function isImageSignature(val: string | null | undefined) {
  return !!val && (val.startsWith('/storage/') || val.startsWith('http'));
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const [user, setUser] = useState(getUser());
  const isAM = user?.role === 'account_manager';
  const [officialEmail, setOfficialEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [signatureType, setSignatureType] = useState<'draw' | 'type' | 'upload' | null>(null);
  const [typedSignature, setTypedSignature] = useState('');
  const [uploadedSignatureFile, setUploadedSignatureFile] = useState<File | null>(null);
  const [uploadedSignaturePreview, setUploadedSignaturePreview] = useState('');
  const [savedSignature, setSavedSignature] = useState<{ data: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSig, setSavingSig] = useState(false);
  const [deletingSig, setDeletingSig] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sigSuccess, setSigSuccess] = useState(false);
  const [taxPercentage, setTaxPercentage] = useState('15');
  const [savingTax, setSavingTax] = useState(false);
  const [taxSuccess, setTaxSuccess] = useState(false);
  const [showContractDates, setShowContractDates] = useState(true);
  const [savingDates, setSavingDates] = useState(false);
  const [datesSuccess, setDatesSuccess] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const sigUploadInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [clauses, setClauses] = useState<ContractClauseTemplate[]>([]);
  const [clausesLoading, setClausesLoading] = useState(true);
  const [clauseType, setClauseType] = useState<'fixed' | 'optional'>('optional');
  const [clauseContent, setClauseContent] = useState('');
  const [clauseCategory, setClauseCategory] = useState('');
  const [editingClause, setEditingClause] = useState<EditingClause | null>(null);
  const [clausesMsg, setClausesMsg] = useState('');
  const [clausesMsgIsError, setClausesMsgIsError] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      const u = data.user;
      setUser(u);
      setOfficialEmail(u.official_email || '');
      setDisplayName(u.name || '');
      setPhone(u.phone || '');
      if (u.date_of_birth) setDateOfBirth(String(u.date_of_birth).substring(0, 10));
      if (u.avatar_url) setAvatarPreview(resolveFileUrl(u.avatar_url));
      if (u.signature_data) {
        setSavedSignature({ data: u.signature_data, type: isImageSignature(u.signature_data) ? 'image' : 'text' });
      }
      localStorage.setItem('user', JSON.stringify(u));
    }).catch((err) => reportError('SettingsPage.loadUser', err));
    if (!isAM) {
      api.get('/settings').then(({ data }) => {
        const v = data.settings?.corporate_tax_percentage?.value;
        if (v !== undefined) setTaxPercentage(String(v));
        const cd = data.settings?.show_contract_dates?.value;
        if (cd !== undefined) setShowContractDates(asSettingFlag(cd));
      }).catch((err) => reportError('SettingsPage.loadSettings', err));
      api.get('/contract-clause-templates?all=1').then(({ data }) => setClauses(data.templates || []))
        .catch((err) => reportError('SettingsPage.loadClauses', err)).finally(() => setClausesLoading(false));
    }
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const form = new FormData();
      if (avatar) form.append('avatar', avatar);
      form.append('name', displayName);
      if (phone) form.append('phone', phone);
      if (!isAM) form.append('official_email', officialEmail);
      if (dateOfBirth) form.append('date_of_birth', dateOfBirth);
      const { data } = await api.post('/auth/me', form);
      setUser(data.user);
      if (data.user?.avatar_url) setAvatarPreview(resolveFileUrl(data.user.avatar_url));
      localStorage.setItem('user', JSON.stringify(data.user));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const startDraw = () => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.beginPath();
    }
  };

  const stopDraw = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.beginPath();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getCanvasData = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  const saveSignature = async () => {
    setSavingSig(true);
    setSigSuccess(false);
    try {
      const form = new FormData();
      if (signatureType === 'draw') {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) return;
        form.append('signature_image', blob, 'signature.png');
      } else if (signatureType === 'type') {
        form.append('signature', typedSignature);
      } else if (signatureType === 'upload' && uploadedSignatureFile) {
        form.append('signature_image', uploadedSignatureFile);
      }
      const { data } = await api.post('/auth/sign', form);
      if (data.user?.signature_data) {
        setSavedSignature({ data: data.user.signature_data, type: isImageSignature(data.user.signature_data) ? 'image' : 'text' });
        localStorage.setItem('user', JSON.stringify(data.user));
        setSigSuccess(true);
        setTimeout(() => setSigSuccess(false), 3000);
      }
      setSignatureType(null);
      setTypedSignature('');
      setUploadedSignatureFile(null);
      setUploadedSignaturePreview('');
    } catch {
      // ignore
    } finally {
      setSavingSig(false);
    }
  };

  const deleteSignature = async () => {
    if (!confirm(t('confirm_delete_signature'))) return;
    setDeletingSig(true);
    try {
      await api.delete('/auth/sign');
      setSavedSignature(null);
    } catch {
      // ignore
    } finally {
      setDeletingSig(false);
    }
  };

  const saveTax = async () => {
    const val = parseFloat(taxPercentage);
    if (isNaN(val) || val < 0 || val > 100) return;
    setSavingTax(true);
    setTaxSuccess(false);
    try {
      await api.put('/settings', { key: 'corporate_tax_percentage', value: val });
      setTaxSuccess(true);
      setTimeout(() => setTaxSuccess(false), 3000);
    } catch {
      // ignore
    } finally {
      setSavingTax(false);
    }
  };

  const toggleContractDates = async (enabled: boolean) => {
    setShowContractDates(enabled);
    setSavingDates(true);
    setDatesSuccess(false);
    try {
      await api.put('/settings', { key: 'show_contract_dates', value: enabled ? '1' : '0' });
      setDatesSuccess(true);
      setTimeout(() => setDatesSuccess(false), 3000);
    } catch {
      setShowContractDates(!enabled);
    } finally {
      setSavingDates(false);
    }
  };

  const flashClausesMsg = (key: string, isError = false) => {
    setClausesMsgIsError(isError);
    setClausesMsg(t(key));
    setTimeout(() => setClausesMsg(''), 3000);
  };

  const addClause = async () => {
    if (!clauseContent.trim()) return;
    const { data } = await api.post('/contract-clause-templates', {
      type: clauseType,
      content: clauseContent.trim(),
      category: clauseCategory.trim() || undefined,
    }).catch(() => ({ data: null }));
    if (data) {
      setClauses((prev) => [...prev, data.template]);
      setClauseContent('');
      setClauseCategory('');
      flashClausesMsg('clause_added');
    }
  };

  const updateClause = async (id: number, payload: Partial<Pick<ContractClauseTemplate, 'content' | 'type' | 'is_active'>> & { category?: string | null }) => {
    const { data } = await api.put(`/contract-clause-templates/${id}`, payload).catch(() => ({ data: null }));
    if (data) {
      setClauses((prev) => prev.map((cl) => cl.id === id ? data.template : cl));
      setEditingClause(null);
      flashClausesMsg('clause_updated');
    }
  };

  const deleteClause = async (id: number) => {
    if (!confirm(t('delete_clause_confirm'))) return;
    try {
      await api.delete(`/contract-clause-templates/${id}`);
      setClauses((prev) => prev.filter((cl) => cl.id !== id));
      flashClausesMsg('clause_deleted');
    } catch (err) {
      reportError('SettingsPage.deleteClause', err);
      flashClausesMsg('clause_delete_failed', true);
    }
  };

  const saveEditClause = () => {
    if (!editingClause || !editingClause.content.trim()) return;
    updateClause(editingClause.id, {
      content: editingClause.content,
      type: editingClause.type,
      category: editingClause.category || null,
    });
  };

  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setClauses((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
  };

  // Keyboard-operable alternative to the mouse-only drag-and-drop reorder above.
  const moveClause = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    setClauses((prev) => {
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  const saveOrder = async () => {
    const { data } = await api.post('/contract-clause-templates/reorder', { ordered_ids: clauses.map((cl) => cl.id) }).catch(() => ({ data: null }));
    if (data) setClauses(data.templates);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 text-sm">{t('saved')}</div>
      )}
      {sigSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 text-sm">{t('saved')}</div>
      )}

      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('avatar')}</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-[var(--color-input-fill)] overflow-hidden border-2 border-zinc-200">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl text-[var(--color-text-disabled)]">
                {user?.name?.[0] || '?'}
              </div>
            )}
          </div>
          <button onClick={() => avatarInputRef.current?.click()} type="button"
            className="bg-[var(--color-input-fill)] hover:bg-[var(--color-card-border)] px-4 py-2 rounded-lg text-sm transition-colors">
            {t('change_avatar')}
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
      </div>

      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('name')}</h2>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
          className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" placeholder={t('name')} />
      </div>

      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('phone')}</h2>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
          className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" placeholder="+966..." dir="ltr" />
      </div>

      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('date_of_birth')}</h2>
        <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
          className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" />
      </div>

      {!isAM && <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('official_email')}</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">{t('official_email_hint')}</p>
        <input value={officialEmail} onChange={(e) => setOfficialEmail(e.target.value)}
          className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" type="email" placeholder={t('official_email')} dir="ltr" />
      </div>}

      {!isAM && <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('signature')}</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">{t('signature_hint')}</p>

        {savedSignature ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t('saved_signature')}</p>
            {savedSignature.type === 'text' ? (
              <p className="text-lg font-[cursive] border border-[var(--color-card-border)] rounded-lg p-4 bg-[var(--color-card-border)] text-center">{savedSignature.data}</p>
            ) : (
              <img src={resolveFileUrl(savedSignature.data)} alt={t('saved_signature')} className="max-h-20 border border-[var(--color-card-border)] rounded-lg p-2 bg-[var(--color-card-border)]" />
            )}
            <button onClick={deleteSignature} disabled={deletingSig}
              className="text-red-600 hover:text-red-700 text-xs underline disabled:opacity-50">
              {deletingSig ? '...' : t('delete')}
            </button>
          </div>
        ) : (
          <p className="text-sm text-amber-600">{t('saved_signature')}</p>
        )}

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setSignatureType('draw'); setTypedSignature(''); setUploadedSignatureFile(null); setUploadedSignaturePreview(''); }}
            className={`px-4 py-2 rounded-lg text-sm border border-[var(--color-card-border)] transition-colors ${signatureType === 'draw' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'hover:bg-[var(--color-card-border)]'}`}>
            {t('draw_signature')}
          </button>
          <button onClick={() => { setSignatureType('type'); setUploadedSignatureFile(null); setUploadedSignaturePreview(''); }}
            className={`px-4 py-2 rounded-lg text-sm border border-[var(--color-card-border)] transition-colors ${signatureType === 'type' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'hover:bg-[var(--color-card-border)]'}`}>
            {t('type_signature')}
          </button>
          <button onClick={() => { setSignatureType('upload'); setTypedSignature(''); }}
            className={`px-4 py-2 rounded-lg text-sm border border-[var(--color-card-border)] transition-colors ${signatureType === 'upload' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'hover:bg-[var(--color-card-border)]'}`}>
            {t('upload_signature')}
          </button>
        </div>

        {signatureType === 'draw' && (
          <div className="space-y-2">
            <canvas ref={canvasRef} width={400} height={150}
              onMouseDown={startDraw} onMouseMove={drawSignature} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              className="border border-[var(--color-card-border)] rounded-lg w-full cursor-crosshair bg-[var(--color-card)]" />
            <button onClick={clearCanvas} className="text-xs text-[var(--color-text-secondary)] hover:text-red-500">{t('clear')}</button>
          </div>
        )}

        {signatureType === 'type' && (
          <input value={typedSignature} onChange={(e) => setTypedSignature(e.target.value)}
            className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-4 py-3 text-lg font-[cursive] w-full text-center"
            placeholder={t('type_signature_ph')} />
        )}

        {signatureType === 'upload' && (
          <div className="space-y-2">
            <button onClick={() => sigUploadInputRef.current?.click()} type="button"
              className="bg-[var(--color-input-fill)] hover:bg-[var(--color-card-border)] px-4 py-2 rounded-lg text-sm inline-block transition-colors">
              {t('upload_signature')}
            </button>
            <input ref={sigUploadInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) { setUploadedSignatureFile(file); setUploadedSignaturePreview(URL.createObjectURL(file)); }
            }} />
            {uploadedSignaturePreview && (
              <img src={uploadedSignaturePreview} alt={t('signature_preview_alt')} className="max-h-20 border border-[var(--color-card-border)] rounded-lg p-2" />
            )}
          </div>
        )}

        {signatureType && (
          <button onClick={saveSignature} disabled={savingSig}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
            {savingSig ? '...' : t('save')}
          </button>
        )}
      </div>}

      {!isAM && <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('system_settings')}</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">{t('tax_description')}</p>
        {taxSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-700 text-sm">{t('tax_saved')}</div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label htmlFor="settings-tax-percentage" className="text-sm text-[var(--color-text-secondary)] mb-1 block">{t('tax_percentage')}</label>
            <input id="settings-tax-percentage" type="number" min="0" max="100" step="0.5" value={taxPercentage}
              onChange={(e) => setTaxPercentage(e.target.value)}
              className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-4 py-2 text-sm w-full" />
          </div>
          <span className="text-[var(--color-text-secondary)] mt-5">%</span>
          <button onClick={saveTax} disabled={savingTax}
            className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)] disabled:opacity-50 mt-5">
            {savingTax ? '...' : t('save')}
          </button>
        </div>
      </div>}

      {!isAM && <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('contract_dates_setting') || 'تواريخ بداية ونهاية العقود'}</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              {t('contract_dates_desc') || 'إظهار أو إخفاء حقول تاريخ بداية ونهاية العقد أثناء إنشاء العقود (في الويب والموبايل)'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showContractDates}
              onChange={(e) => toggleContractDates(e.target.checked)}
              disabled={savingDates}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-[var(--color-primary)] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
          </label>
        </div>
        {datesSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-700 text-sm">
            ✓ {t('setting_saved') || 'تم حفظ الإعداد بنجاح'}
          </div>
        )}
      </div>}

      {!isAM && <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t('contract_clauses')}</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('clauses_description')}</p>
        </div>
        {clausesMsg && (
          <div className={clausesMsgIsError
            ? 'bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm'
            : 'bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-700 text-sm'}>
            {clausesMsg}
          </div>
        )}

        <div className="border border-[var(--color-card-border)] rounded-lg p-4 bg-[var(--color-card-border)] space-y-3">
          <div className="flex gap-2 flex-wrap">
            <select value={clauseType} onChange={(e) => setClauseType(e.target.value as 'fixed' | 'optional')}
              className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-3 py-2 text-sm">
              <option value="fixed">{t('clause_fixed')}</option>
              <option value="optional">{t('clause_optional')}</option>
            </select>
            <input value={clauseCategory} onChange={(e) => setClauseCategory(e.target.value)}
              className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-3 py-2 text-sm w-40" placeholder={t('clause_category_ph')} />
          </div>
          <textarea value={clauseContent} onChange={(e) => setClauseContent(e.target.value)}
            className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-3 py-2 text-sm w-full min-h-[70px]"
            placeholder={t('clause_content_ph')} />
          <button onClick={addClause} className="bg-[var(--color-primary)] text-white px-5 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)]">
            {t('add_clause')}
          </button>
        </div>

        {clauses.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--color-text-secondary)]">{t('reorder_hint')}</p>
            <button onClick={saveOrder} className="text-xs text-[var(--color-gold)] hover:underline">{t('save_order')}</button>
          </div>
        )}

        {clausesLoading ? (
          <p className="text-sm text-[var(--color-text-secondary)] py-4">{t('loading_clauses')}</p>
        ) : clauses.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] py-4">{t('clauses_empty')}</p>
        ) : (
          <div className="space-y-2">
            {clauses.map((cl, idx) => (
              <div key={cl.id} draggable onDragStart={() => onDragStart(idx)} onDragOver={onDragOver} onDrop={() => onDrop(idx)}
                className={`border border-[var(--color-card-border)] rounded-lg p-3 bg-[var(--color-card-border)] transition ${dragIdx === idx ? 'opacity-50' : 'opacity-100'} ${editingClause?.id === cl.id ? 'ring-1 ring-[var(--color-primary)]' : ''}`}>
                {editingClause?.id === cl.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      <select value={editingClause.type} onChange={(e) => setEditingClause({ ...editingClause, type: e.target.value as 'fixed' | 'optional' })}
                        className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-3 py-1.5 text-xs">
                        <option value="fixed">{t('clause_fixed')}</option>
                        <option value="optional">{t('clause_optional')}</option>
                      </select>
                      <input value={editingClause.category || ''} onChange={(e) => setEditingClause({ ...editingClause, category: e.target.value })}
                        className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-3 py-1.5 text-xs w-32" placeholder={t('clause_category_ph')} />
                    </div>
                    <textarea value={editingClause.content} onChange={(e) => setEditingClause({ ...editingClause, content: e.target.value })}
                      className="border border-[var(--color-input-border)] bg-[var(--color-input-fill)] text-[var(--color-foreground)] rounded-lg px-3 py-2 text-sm w-full" />
                    <div className="flex gap-2">
                      <button onClick={saveEditClause} className="bg-[var(--color-primary)] text-white px-4 py-1.5 rounded-lg text-xs hover:bg-[var(--color-primary-dark)]">{t('save')}</button>
                      <button onClick={() => setEditingClause(null)} className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] px-2">{t('cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className="cursor-grab text-[var(--color-text-disabled)] select-none" title={t('reorder_hint')}>⠿</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${cl.type === 'fixed' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'}`}>
                          {cl.type === 'fixed' ? t('clause_fixed') : t('clause_optional')}
                        </span>
                        {cl.category && <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--color-input-fill)] text-[var(--color-text-secondary)]">{cl.category}</span>}
                        {cl.is_active ? <span className="text-[10px] text-emerald-500">{t('active')}</span> : <span className="text-[10px] text-[var(--color-text-disabled)]">{t('inactive')}</span>}
                      </div>
                      <p className="text-sm mt-1">{cl.content}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => moveClause(idx, -1)} disabled={idx === 0} aria-label={t('move_clause_up')}
                        className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] px-1 py-1 disabled:opacity-30 disabled:cursor-not-allowed">▲</button>
                      <button onClick={() => moveClause(idx, 1)} disabled={idx === clauses.length - 1} aria-label={t('move_clause_down')}
                        className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] px-1 py-1 disabled:opacity-30 disabled:cursor-not-allowed">▼</button>
                      <button onClick={() => updateClause(cl.id, { is_active: !cl.is_active })} className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] px-1.5 py-1">
                        {cl.is_active ? t('deactivate') : t('activate')}
                      </button>
                      <button onClick={() => setEditingClause({ id: cl.id, content: cl.content, type: cl.type, category: cl.category })} className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] px-1.5 py-1">{t('edit')}</button>
                      <button onClick={() => deleteClause(cl.id)} className="text-xs text-[var(--color-text-secondary)] hover:text-red-500 px-1.5 py-1">{t('delete')}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>}

      <button onClick={saveProfile} disabled={saving}
        className="bg-[var(--color-primary)] text-white px-8 py-3 rounded-xl text-sm font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50 w-full">
        {saving ? '...' : t('save')}
      </button>
    </div>
  );
}
