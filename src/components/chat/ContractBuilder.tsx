'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { notifyWriteError } from '@/lib/utils';
import { useContractClauseTemplates, useShowContractDatesSetting, useCreateContract } from '@/hooks/queries/useContracts';
import type { Contract } from '@/types';

export default function ContractBuilder({ wsId, onCreated, onCancel }: { wsId: number; onCreated: (contract: Contract) => void; onCancel: () => void }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [form, setForm] = useState({ title: '', value: '', currency: 'SAR', start_date: '', end_date: '' });
  const [selectedOptional, setSelectedOptional] = useState<Record<number, boolean>>({});
  const [customClauses, setCustomClauses] = useState<string[]>([]);
  const [newCustom, setNewCustom] = useState('');

  const templatesQuery = useContractClauseTemplates();
  const showDatesQuery = useShowContractDatesSetting();
  const createMutation = useCreateContract(wsId);

  const templates = templatesQuery.data ?? [];
  const showDates = showDatesQuery.data ?? true;

  const fixedTemplates = templates.filter((t) => t.type === 'fixed');
  const optionalTemplates = templates.filter((t) => t.type === 'optional');

  const toggleOptional = (id: number) => setSelectedOptional((prev) => ({ ...prev, [id]: !prev[id] }));

  const addCustom = () => {
    const trimmed = newCustom.trim();
    if (trimmed) { setCustomClauses((prev) => [...prev, trimmed]); setNewCustom(''); }
  };

  const removeCustom = (idx: number) => setCustomClauses((prev) => prev.filter((_, i) => i !== idx));

  const create = () => {
    if (!form.title) return;
    const clauses: { content: string; type: 'optional' | 'custom'; sort_order: number }[] = [];
    optionalTemplates.forEach((t) => { if (selectedOptional[t.id]) clauses.push({ content: t.content, type: 'optional', sort_order: clauses.length }); });
    customClauses.forEach((c) => clauses.push({ content: c, type: 'custom', sort_order: clauses.length }));

    createMutation.mutate({ ...form, clauses }, {
      onSuccess: (data) => { if (data?.contract) onCreated(data.contract); },
      onError: (err) => notifyWriteError(tc, 'ContractBuilder.create', err),
    });
  };

  return (
    <div className="border border-[var(--color-card-border)] rounded-xl bg-[var(--color-card-border)] p-4 space-y-3">
      <h3 className="text-sm font-bold text-[var(--color-foreground)]">{t('builder_title')}</h3>

      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('builder_title_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />

      <div className="flex gap-2">
        <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} type="number" placeholder={t('builder_value_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-28 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
        <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-24 bg-[var(--color-input-fill)] text-[var(--color-foreground)]">
          <option value="SAR">SAR</option><option value="USD">USD</option><option value="EUR">EUR</option>
          <option value="AED">AED</option><option value="EGP">EGP</option><option value="KWD">KWD</option>
          <option value="QAR">QAR</option><option value="BHD">BHD</option><option value="OMR">OMR</option>
        </select>
        {showDates && (
          <>
            <input value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} type="date" className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm flex-1 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
            <input value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} type="date" className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm flex-1 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
          </>
        )}
      </div>

      {fixedTemplates.length > 0 && (
        <div className="border border-[var(--color-card-border)] rounded p-3 bg-[var(--color-card)]">
          <h4 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">{t('builder_fixed_heading')}</h4>
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
          <h4 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">{t('builder_optional_heading')}</h4>
          {optionalTemplates.map((t) => (
            <label key={t.id} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)] py-1 cursor-pointer hover:text-[var(--color-gold-text)]">
              <input type="checkbox" checked={!!selectedOptional[t.id]} onChange={() => toggleOptional(t.id)} className="mt-0.5" />
              <span>{t.content}</span>
            </label>
          ))}
        </div>
      )}

      <div className="border border-[var(--color-card-border)] rounded p-3 bg-[var(--color-card)]">
        <h4 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">{t('builder_custom_heading')}</h4>
        <div className="flex gap-2 mb-2">
          <input value={newCustom} onChange={(e) => setNewCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} placeholder={t('builder_clause_ph')} className="border border-[var(--color-input-border)] rounded px-3 py-2 text-sm flex-1 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
          <button onClick={addCustom} className="bg-[var(--color-primary)] text-white px-3 py-2 rounded-lg text-xs hover:bg-[var(--color-primary-dark)]">{t('builder_add')}</button>
        </div>
        {customClauses.map((c, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)] py-1">
            <span className="text-blue-500 mt-0.5">•</span>
            <span className="flex-1">{c}</span>
            <button onClick={() => removeCustom(i)} aria-label={t('builder_remove_clause', { clause: c })} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={create} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)]">{t('builder_create_send')}</button>
        <button onClick={onCancel} className="bg-[var(--color-input-fill)] text-[var(--color-text-secondary)] px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-card-border)]">{t('builder_cancel')}</button>
      </div>
    </div>
  );
}
