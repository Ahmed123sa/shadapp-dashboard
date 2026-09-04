'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { notifyWriteError } from '@/lib/utils';
import type { Client } from '@/types';

const SIG_W = 500;
const SIG_H = 200;

function isImageUrl(val: string | null | undefined) {
  return !!val && (val.startsWith('/storage/') || val.startsWith('http'));
}

export default function ClientSignature({ clientId, clientData, onSigned }: { clientId: number; clientData: Client; onSigned?: () => void }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const sigData = clientData?.signature_data;
  const [mode, setMode] = useState<'text' | 'image'>(sigData && !isImageUrl(sigData) ? 'text' : 'image');
  const [signature, setSignature] = useState(!sigData || isImageUrl(sigData) ? '' : sigData);
  const [preview, setPreview] = useState<string | null>(sigData && isImageUrl(sigData) ? sigData : null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(!!clientData?.signed_at);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    if (file.type !== 'image/png') { setError(t('sig_png_only')); return; }

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = SIG_W;
      canvas.height = SIG_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, SIG_W, SIG_H);
      const sx = Math.min(SIG_W / img.width, SIG_H / img.height);
      const dx = (SIG_W - img.width * sx) / 2;
      const dy = (SIG_H - img.height * sx) / 2;
      ctx.drawImage(img, dx, dy, img.width * sx, img.height * sx);
      setPreview(canvas.toDataURL('image/png'));
    };
    img.src = URL.createObjectURL(file);
  };

  const save = async () => {
    if (mode === 'text') {
      if (!signature.trim()) return;
      setSaving(true);
      const { data } = await api.post(`/clients/${clientId}/sign`, { signature: signature.trim() }).catch((err) => { notifyWriteError(tc, 'ClientSignature.save.text', err); return { data: null }; });
      if (data) { setDone(true); onSigned?.(); }
      setSaving(false);
    } else {
      if (!preview) return;
      setSaving(true);
      const blob = await (await fetch(preview)).blob();
      const fd = new FormData();
      fd.append('signature_image', blob, 'signature.png');
      const { data } = await api.post(`/clients/${clientId}/sign`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).catch((err) => { notifyWriteError(tc, 'ClientSignature.save.image', err); return { data: null }; });
      if (data) { setDone(true); onSigned?.(); }
      setSaving(false);
    }
  };

  const deleteSignature = async () => {
    if (!confirm(t('sig_delete_confirm'))) return;
    setDeleting(true);
    try {
      await api.delete(`/clients/${clientId}/sign`);
      setDone(false);
      setSignature('');
      setPreview(null);
      onSigned?.();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const existingImage = isImageUrl(sigData) ? sigData : null;

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-card-border)] p-6">
        <h3 className="font-bold mb-2">{t('sig_title')}</h3>

        {done ? (
          <div className="text-center py-8">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-emerald-600 font-medium">{t('sig_saved')}</p>
            {existingImage ? (
              <div className="mt-4 border-t border-[var(--color-card-border)] pt-4 flex justify-center">
                <img src={existingImage} alt={t('sig_title')} className="max-w-full h-20 object-contain" />
              </div>
            ) : sigData && !isImageUrl(sigData) ? (
              <p className="text-lg font-handwriting mt-4 text-[var(--color-text-secondary)] border-t border-[var(--color-card-border)] pt-4">{sigData}</p>
            ) : null}
            <div className="flex justify-center gap-3 mt-4">
              <button onClick={() => setDone(false)}
                className="text-sm text-[var(--color-gold-text)] hover:underline">{t('sig_edit')}</button>
              <button onClick={deleteSignature} disabled={deleting}
                className="text-sm text-red-600 hover:underline disabled:opacity-50">
                {deleting ? t('sig_deleting') : t('sig_delete')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {!preview && (
              <div className="flex gap-2 mb-3">
                <button onClick={() => { setMode('text'); setPreview(null); }}
                  className={`px-4 py-1.5 text-sm rounded-lg border ${mode === 'text' ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-[var(--color-card)] text-[var(--color-text-secondary)]'}`}>{t('sig_text_mode')}</button>
                <button onClick={() => { setMode('image'); setSignature(''); }}
                  className={`px-4 py-1.5 text-sm rounded-lg border ${mode === 'image' ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-[var(--color-card)] text-[var(--color-text-secondary)]'}`}>{t('sig_image_mode')}</button>
              </div>
            )}

            {mode === 'text' && !preview && (
              <>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('sig_text_instructions')}</p>
                <textarea value={signature} onChange={(e) => setSignature(e.target.value)}
                  className="border border-[var(--color-input-border)] rounded-lg px-4 py-3 text-lg font-medium w-full h-24 text-center bg-[var(--color-input-fill)] text-[var(--color-foreground)] placeholder-[var(--color-text-disabled)]"
                  placeholder={t('sig_text_ph')} />
              </>
            )}

            {mode === 'image' && (
              <>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('sig_image_instructions', { w: SIG_W, h: SIG_H })}</p>
                <input ref={fileRef} type="file" accept=".png" onChange={handleFile} className="hidden" />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-[var(--color-card-border)] rounded-xl p-8 text-center cursor-pointer bg-[var(--color-input-fill)] hover:bg-[var(--color-card-border)] transition">
                  {preview ? (
                    <img src={preview} alt={t('sig_title')} className="mx-auto max-h-32 object-contain" />
                  ) : existingImage ? (
                    <img src={existingImage} alt={t('sig_title')} className="mx-auto max-h-32 object-contain" />
                  ) : (
                    <p className="text-[var(--color-text-disabled)] text-sm">{t('sig_click_to_choose')}</p>
                  )}
                </button>
                <p className="text-xs text-[var(--color-text-disabled)]">{t('sig_auto_resize', { w: SIG_W, h: SIG_H })}</p>
              </>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <canvas ref={canvasRef} className="hidden" />

            <button onClick={save} disabled={saving || (mode === 'text' && !signature.trim()) || (mode === 'image' && !preview)}
              className="bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
              {saving ? t('sig_saving') : t('sig_save')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
