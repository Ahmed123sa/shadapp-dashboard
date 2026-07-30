'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

type Template = { id: number; content: string; type: string };

export default function ContractBuilder({ wsId, onCreated, onCancel }: { wsId: number; onCreated: (contract: any) => void; onCancel: () => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState({ title: '', value: '', start_date: '', end_date: '' });
  const [selectedOptional, setSelectedOptional] = useState<Record<number, boolean>>({});
  const [customClauses, setCustomClauses] = useState<string[]>([]);
  const [newCustom, setNewCustom] = useState('');

  useEffect(() => {
    api.get('/contract-clause-templates').then(({ data }) => setTemplates(data.templates || [])).catch(() => {});
  }, []);

  const fixedTemplates = templates.filter((t) => t.type === 'fixed');
  const optionalTemplates = templates.filter((t) => t.type === 'optional');

  const toggleOptional = (id: number) => setSelectedOptional((prev) => ({ ...prev, [id]: !prev[id] }));

  const addCustom = () => {
    const trimmed = newCustom.trim();
    if (trimmed) { setCustomClauses((prev) => [...prev, trimmed]); setNewCustom(''); }
  };

  const removeCustom = (idx: number) => setCustomClauses((prev) => prev.filter((_, i) => i !== idx));

  const create = async () => {
    if (!form.title) return;
    const clauses: any[] = [];
    fixedTemplates.forEach((t) => clauses.push({ content: t.content, type: 'fixed', sort_order: clauses.length }));
    optionalTemplates.forEach((t) => { if (selectedOptional[t.id]) clauses.push({ content: t.content, type: 'optional', sort_order: clauses.length }); });
    customClauses.forEach((c) => clauses.push({ content: c, type: 'custom', sort_order: clauses.length }));

    const { data } = await api.post(`/workspaces/${wsId}/contracts`, { ...form, clauses }).catch(() => ({ data: null }));
    if (data) onCreated(data.contract);
  };

  return (
    <div className="border border-[var(--color-card-border)] rounded-xl bg-[var(--color-card-border)] p-4 space-y-3">
      <h3 className="text-sm font-bold text-[var(--color-foreground)]">عقد خدمة إضافي</h3>

      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان العقد" className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />

      <div className="flex gap-2">
        <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} type="number" placeholder="القيمة" className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-32 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
        <input value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} type="date" className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm flex-1 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
        <input value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} type="date" className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm flex-1 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
      </div>

      {fixedTemplates.length > 0 && (
        <div className="border border-[var(--color-card-border)] rounded p-3 bg-[var(--color-card)]">
          <h4 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">بنود إلزامية</h4>
          {fixedTemplates.map((t) => (
            <label key={t.id} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)] py-1">
              <input type="checkbox" checked disabled className="mt-0.5" />
              <span>{t.content}</span>
            </label>
          ))}
        </div>
      )}

      {optionalTemplates.length > 0 && (
        <div className="border border-[var(--color-card-border)] rounded p-3 bg-[var(--color-card)]">
          <h4 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">بنود اختيارية</h4>
          {optionalTemplates.map((t) => (
            <label key={t.id} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)] py-1 cursor-pointer hover:text-[var(--color-gold)]">
              <input type="checkbox" checked={!!selectedOptional[t.id]} onChange={() => toggleOptional(t.id)} className="mt-0.5" />
              <span>{t.content}</span>
            </label>
          ))}
        </div>
      )}

      <div className="border border-[var(--color-card-border)] rounded p-3 bg-[var(--color-card)]">
        <h4 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">بنود مخصصة</h4>
        <div className="flex gap-2 mb-2">
          <input value={newCustom} onChange={(e) => setNewCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} placeholder="اكتب بنداً..." className="border border-[var(--color-input-border)] rounded px-3 py-2 text-sm flex-1 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
          <button onClick={addCustom} className="bg-[var(--color-primary)] text-white px-3 py-2 rounded-lg text-xs hover:bg-[var(--color-primary-dark)]">إضافة</button>
        </div>
        {customClauses.map((c, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)] py-1">
            <span className="text-blue-500 mt-0.5">•</span>
            <span className="flex-1">{c}</span>
            <button onClick={() => removeCustom(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={create} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)]">إنشاء وإرسال</button>
        <button onClick={onCancel} className="bg-[var(--color-input-fill)] text-[var(--color-text-secondary)] px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-card-border)]">إلغاء</button>
      </div>
    </div>
  );
}
