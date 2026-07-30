'use client';

import { useRef, useState } from 'react';
import api from '@/lib/api';

export default function UploadFileModal({ wsId, definitions, onClose, onCreated }: {
  wsId: number;
  definitions: any[];
  onClose: () => void;
  onCreated: (file: any) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [definitionId, setDefinitionId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!file) return;
    setSaving(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    if (definitionId) form.append('document_definition_id', definitionId);
    try {
      const { data } = await api.post(`/workspaces/${wsId}/files`, form);
      if (data) onCreated(data.file);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'فشل رفع الملف');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-[var(--color-card)] rounded-xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4 border border-[var(--color-card-border)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">رفع مستند</h3>
          <button onClick={onClose} className="text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)] text-xl">&times;</button>
        </div>

        <select value={definitionId} onChange={(e) => setDefinitionId(e.target.value)} className="border border-[var(--color-input-border)] rounded-lg px-4 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]">
          <option value="">بدون تصنيف</option>
          {definitions.map((d) => <option key={d.id} value={d.id}>{d.name}{d.is_required ? ' *' : ''}</option>)}
        </select>

        <input type="file" ref={fileRef} className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setError(''); }} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 text-sm text-[var(--color-gold)] cursor-pointer hover:text-[var(--color-gold)] border border-blue-200 rounded-lg px-4 py-2 w-full">
          {file ? file.name : '+ اختيار ملف'}
        </button>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button onClick={submit} disabled={saving || !file}
          className="w-full bg-[var(--color-primary)] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
          {saving ? 'جاري الرفع...' : 'رفع'}
        </button>
      </div>
    </div>
  );
}
