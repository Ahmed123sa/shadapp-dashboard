'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { notifyWriteError } from '@/lib/utils';
import { SIG_W, SIG_H, dataUrlToBlob, paintStrokes, strokesToPng, type Stroke } from '@/lib/signature-draw';
import { Btn, Segmented } from '@/components/client-portal/ui';
import type { Client } from '@/types';

type Mode = 'draw' | 'type' | 'upload';

function isImageUrl(val: string | null | undefined) {
  return !!val && (val.startsWith('/storage/') || val.startsWith('http'));
}

/**
 * The client's e-signature: draw, type, or upload a PNG. All three end up on
 * the same endpoint as before (`POST /clients/{id}/sign` with either
 * `signature` text or a `signature_image` PNG), plus delete with confirm.
 */
export default function ClientSignature({ clientId, clientData, onSigned }: { clientId: number; clientData: Client; onSigned?: () => void }) {
  const t = useTranslations('client_portal');
  const td = useTranslations('dashboard');
  const tc = useTranslations('common');
  const sigData = clientData?.signature_data;
  // Signed URL for showing an uploaded image — /storage/... doesn't exist in
  // production (23 Sept 2026). Falls back to the raw value for older APIs.
  const sigImageSrc = clientData?.signature_url || sigData;
  const existingImage = isImageUrl(sigData) ? (sigImageSrc ?? null) : null;
  const existingText = sigData && !isImageUrl(sigData) ? sigData : '';

  const [mode, setMode] = useState<Mode>('draw');
  const [text, setText] = useState(existingText);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(!!clientData?.signed_at);
  const [error, setError] = useState('');

  const padRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const exportRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);

  // Repaint the visible pad whenever the strokes change.
  useEffect(() => {
    const canvas = drawRef.current;
    const pad = padRef.current;
    if (!canvas || !pad || mode !== 'draw') return;
    const rect = pad.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(Math.round(rect.width * dpr), 1);
    canvas.height = Math.max(Math.round(rect.height * dpr), 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintStrokes(ctx, strokes, { color: '#F0F0F0', width: 2.2 * dpr, scale: dpr });
  }, [strokes, mode]);

  const pointOf = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [(Number(e.clientX) || 0) - rect.left, (Number(e.clientY) || 0) - rect.top];
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
    const p = pointOf(e);
    setStrokes((s) => [...s, [p]]);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = pointOf(e);
    setStrokes((s) => {
      if (s.length === 0) return s;
      const last = s[s.length - 1];
      return [...s.slice(0, -1), [...last, p]];
    });
  };
  const onUp = () => { drawing.current = false; };

  const switchMode = (m: Mode) => { setMode(m); setError(''); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (file.type !== 'image/png') { setError(t('sig_png_only')); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = exportRef.current;
      if (!canvas) return;
      canvas.width = SIG_W;
      canvas.height = SIG_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, SIG_W, SIG_H);
      const sx = Math.min(SIG_W / img.width, SIG_H / img.height);
      ctx.drawImage(img, (SIG_W - img.width * sx) / 2, (SIG_H - img.height * sx) / 2, img.width * sx, img.height * sx);
      setUploadPreview(canvas.toDataURL('image/png'));
    };
    img.src = URL.createObjectURL(file);
  };

  const canSave =
    mode === 'draw' ? strokes.some((s) => s.length > 0)
    : mode === 'type' ? !!text.trim()
    : !!uploadPreview;

  const postImage = async (dataUrl: string, ctxName: string) => {
    const fd = new FormData();
    fd.append('signature_image', dataUrlToBlob(dataUrl), 'signature.png');
    return api.post(`/clients/${clientId}/sign`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .catch((err) => { notifyWriteError(tc, ctxName, err); return { data: null }; });
  };

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    let result: { data: unknown } = { data: null };
    if (mode === 'type') {
      result = await api.post(`/clients/${clientId}/sign`, { signature: text.trim() })
        .catch((err) => { notifyWriteError(tc, 'ClientSignature.save.text', err); return { data: null }; });
    } else if (mode === 'draw') {
      const png = exportRef.current ? strokesToPng(strokes, exportRef.current) : null;
      if (png) result = await postImage(png, 'ClientSignature.save.draw');
    } else if (uploadPreview) {
      result = await postImage(uploadPreview, 'ClientSignature.save.image');
    }
    if (result.data) { setDone(true); onSigned?.(); }
    setSaving(false);
  };

  const deleteSignature = useCallback(async () => {
    if (!confirm(td('sig_delete_confirm'))) return;
    setDeleting(true);
    try {
      await api.delete(`/clients/${clientId}/sign`);
      setDone(false);
      setText('');
      setStrokes([]);
      setUploadPreview(null);
      onSigned?.();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }, [clientId, onSigned, td]);

  if (done) {
    return (
      <div>
        <div className="sigbox">
          {existingImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={existingImage} alt={td('sig_title')} style={{ maxHeight: 96, maxWidth: '90%', objectFit: 'contain', filter: 'invert(1) hue-rotate(180deg)' }} />
          ) : (
            existingText || td('sig_saved')
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Btn size="sm" onClick={() => setDone(false)}>{td('sig_edit')}</Btn>
          <Btn size="sm" variant="quiet" className="danger" style={{ marginInlineStart: 'auto' }} disabled={deleting} onClick={deleteSignature}>
            {deleting ? td('sig_deleting') : td('sig_delete')}
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Segmented
        value={mode}
        onChange={switchMode}
        options={[
          { value: 'draw', label: t('sig_draw') },
          { value: 'type', label: t('sig_type') },
          { value: 'upload', label: t('sig_upload') },
        ]}
      />
      <div className="pad" ref={padRef}>
        {mode === 'draw' && (
          <>
            <canvas
              ref={drawRef}
              role="img"
              aria-label={t('sig_draw_label')}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
            />
            <span className="base" />
            <span className="x">×</span>
            {strokes.length > 0 && (
              <button type="button" className="clr" onClick={() => setStrokes([])}>{t('sig_clear')}</button>
            )}
          </>
        )}
        {mode === 'type' && (
          <>
            <input
              className="typed"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('sig_type_ph')}
              aria-label={t('sig_type')}
              style={{ background: 'none', border: 0, outline: 0, textAlign: 'center', width: '90%', color: 'inherit' }}
            />
            <span className="base" />
          </>
        )}
        {mode === 'upload' && (
          <>
            <input ref={fileRef} type="file" accept=".png,image/png" onChange={handleFile} className="hidden" style={{ display: 'none' }} data-testid="sig-file" />
            {uploadPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={uploadPreview} alt={td('sig_title')} style={{ maxHeight: 130, maxWidth: '80%', objectFit: 'contain', filter: 'invert(1) hue-rotate(180deg)' }} />
            ) : (
              <button type="button" className="drop" style={{ border: 0, width: '100%' }} onClick={() => fileRef.current?.click()}>
                <div>{t('drop_pre')} <b>{t('drop_browse')}</b></div>
                <div style={{ marginTop: 4 }}>{t('sig_drop_png')}</div>
              </button>
            )}
          </>
        )}
      </div>
      {error && <p role="alert" style={{ color: 'var(--crimson-ink)', fontSize: 12.5, marginTop: 10 }}>{error}</p>}
      <canvas ref={exportRef} style={{ display: 'none' }} />
      <div className="acts2">
        <Btn variant="primary" size="lg" disabled={!canSave || saving} onClick={save}>
          {saving ? t('sig_saving') : t('sig_save')}
        </Btn>
      </div>
    </div>
  );
}
