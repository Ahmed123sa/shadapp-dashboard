'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { asSettingFlag, resolveFileUrl, notifyWriteError } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import ContractStatusStepper from '@/components/ui/ContractStatusStepper';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { reportError } from '@/lib/error-reporting';
import { useModalA11y } from '@/hooks/useModalA11y';
import type { Contract, ContractClauseTemplate } from '@/types';

// The backend has no `signature_type` field on users — signatures are
// distinguished by shape, not a stored flag. Detecting it here directly
// (rather than trusting an API field that doesn't exist) avoids the bug where
// an uploaded image signature would render as raw path text.
function isImageSignature(val: string | null | undefined) {
  return !!val && (val.startsWith('/storage/') || val.startsWith('http'));
}

export default function ContractsTab({ wsId, clientType, wsActive }: { wsId: number; clientType?: string; wsActive?: boolean }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractClauseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', value: '', currency: 'SAR', start_date: '', end_date: '' });
  const [selectedOptional, setSelectedOptional] = useState<Record<number, boolean>>({});
  const [customClauses, setCustomClauses] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [newCustom, setNewCustom] = useState('');
  const [approveSig, setApproveSig] = useState<{ id: number; signature: string } | null>(null);
  const [savedUserSig, setSavedUserSig] = useState<{ data: string; type: string } | null>(null);
  const [useSavedSig, setUseSavedSig] = useState(false);
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);
  const [newReqDoc, setNewReqDoc] = useState('');
  const [showDates, setShowDates] = useState(true);
  const approveSigTitleId = useId();
  const closeApproveSig = () => { setApproveSig(null); setSavedUserSig(null); setUseSavedSig(false); };
  const { dialogRef: approveSigDialogRef, dialogProps: approveSigDialogProps } = useModalA11y<HTMLDivElement>(!!approveSig, closeApproveSig);

  useEffect(() => {
    Promise.all([
      api.get(`/workspaces/${wsId}/contracts`).then(({ data }) => setContracts(data.contracts?.data || data.contracts || [])),
      api.get('/contract-clause-templates').then(({ data }) => setTemplates(data.templates || [])),
      api.get('/settings').then(({ data }) => {
        const cd = data.settings?.show_contract_dates?.value;
        if (cd !== undefined) setShowDates(asSettingFlag(cd));
      }).catch((err) => reportError('ContractsTab.loadSettings', err)),
    ]).catch((err) => { reportError('ContractsTab.load', err); setError(t('contracts_load_error')); }).finally(() => setLoading(false));
  }, [wsId]);

  const user = getUser();
  const isSA = user?.role === 'super_admin';

  const fixedTemplates = templates.filter((tpl) => tpl.type === 'fixed');
  const optionalTemplates = templates.filter((tpl) => tpl.type === 'optional');

  const create = async () => {
    if (!form.title) return;
    const clauses: { content: string; type: 'optional' | 'custom' }[] = [];
    optionalTemplates.forEach((tpl) => { if (selectedOptional[tpl.id]) clauses.push({ content: tpl.content, type: 'optional' }); });
    customClauses.forEach((c) => clauses.push({ content: c, type: 'custom' }));

    const required_documents = requiredDocs.map((name) => ({ name }));
    const contract_type = wsActive ? 'additional' : 'main';

    const { data } = await api.post(`/workspaces/${wsId}/contracts`, { ...form, contract_type, clauses, required_documents }).catch((err) => { notifyWriteError(tc, 'ContractsTab.create', err); return { data: null }; });
    if (data) { setContracts((prev) => [...prev, data.contract]); setShowForm(false); setForm({ title: '', value: '', currency: 'SAR', start_date: '', end_date: '' }); setSelectedOptional({}); setCustomClauses([]); setNewCustom(''); setRequiredDocs([]); setNewReqDoc(''); }
  };

  const toggleOptional = (id: number) => setSelectedOptional((prev) => ({ ...prev, [id]: !prev[id] }));

  const addCustom = () => {
    const trimmed = newCustom.trim();
    if (trimmed) { setCustomClauses((prev) => [...prev, trimmed]); setNewCustom(''); }
  };

  const removeCustom = (idx: number) => setCustomClauses((prev) => prev.filter((_, i) => i !== idx));

  const doAction = async (id: number, action: string) => {
    const { data } = await api.post(`/contracts/${id}/${action}`).catch((err) => { notifyWriteError(tc, 'ContractsTab.doAction', err); return { data: null }; });
    if (data) setContracts((prev) => prev.map((c) => c.id === id ? data.contract : c));
  };

  const openApproveSig = async (contractId: number) => {
    setUseSavedSig(false);
    setApproveSig({ id: contractId, signature: '' });
    setSavedUserSig(null);
    try {
      const { data } = await api.get('/auth/me');
      if (data.user?.signature_data) {
        setSavedUserSig({ data: data.user.signature_data, type: isImageSignature(data.user.signature_data) ? 'image' : 'text' });
      }
    } catch (err) {
      reportError('ContractsTab.openApproveSig', err);
    }
  };

  const doCompanyApprove = async () => {
    if (!approveSig) return;
    const payload = useSavedSig ? { use_saved_signature: true } : { signature: approveSig.signature };
    const { data } = await api.post(`/contracts/${approveSig.id}/company-approve`, payload).catch((err) => { notifyWriteError(tc, 'ContractsTab.doCompanyApprove', err); return { data: null }; });
    if (data) setContracts((prev) => prev.map((c) => c.id === approveSig.id ? data.contract : c));
    setApproveSig(null);
    setSavedUserSig(null);
  };

  if (loading) return <TableSkeleton />;
  if (error) return <p className="text-sm text-red-400 text-center py-8">{error}</p>;
  if (isSA && contracts.length === 0) return <EmptyState message={t('no_contracts')} />;

  return (
    <div className="space-y-3">
      {!isSA && (
        <button onClick={() => setShowForm(!showForm)} className="text-sm text-[var(--color-gold-text)] hover:underline font-medium">
          {wsActive ? `+ ${t('chat_send_extra_contract')}` : `+ ${t('new_contract')}`}
        </button>
      )}
      {!isSA && showForm && (
        <div className="space-y-2 border border-[var(--color-card-border)] rounded-lg p-4 bg-[var(--color-card-border)]">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('contract_title_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
          <div className="flex gap-2">
            <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} type="number" placeholder={t('value_ph')} className="border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm w-28 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
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
              <h3 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">{t('fixed_clauses_heading')}</h3>
              {fixedTemplates.map((tpl) => (
                <label key={tpl.id} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)] py-1">
                  <input type="checkbox" checked disabled className="mt-0.5" />
                  <span>{tpl.content}</span>
                </label>
              ))}
            </div>
          )}
          {optionalTemplates.length > 0 && (
            <div className="border border-[var(--color-card-border)] rounded p-3 bg-[var(--color-card)]">
              <h3 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">{t('optional_clauses_heading')}</h3>
              {optionalTemplates.map((tpl) => (
                <label key={tpl.id} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)] py-1 cursor-pointer hover:text-[var(--color-gold-text)]">
                  <input type="checkbox" checked={!!selectedOptional[tpl.id]} onChange={() => toggleOptional(tpl.id)} className="mt-0.5" />
                  <span>{tpl.content}</span>
                </label>
              ))}
            </div>
          )}
          <div className="border border-[var(--color-card-border)] rounded p-3 bg-[var(--color-card)]">
            <h3 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">{t('custom_clauses_heading')}</h3>
            <div className="flex gap-2 mb-2">
              <input value={newCustom} onChange={(e) => setNewCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} placeholder={t('clause_input_ph')} className="border border-[var(--color-input-border)] rounded px-3 py-2 text-sm flex-1 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
              <button onClick={addCustom} className="bg-[var(--color-primary)] text-white px-3 py-2 rounded-lg text-xs hover:bg-[var(--color-primary-dark)]">{t('add_button')}</button>
            </div>
            {customClauses.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)] py-1">
                <span className="text-blue-500 mt-0.5">•</span>
                <span className="flex-1">{c}</span>
                <button onClick={() => removeCustom(i)} aria-label={t('remove_clause', { clause: c })} className="text-red-400 hover:text-red-600 text-xs">✕</button>
              </div>
            ))}
          </div>
          <div className="border border-[var(--color-card-border)] rounded p-3 bg-[var(--color-card)]">
            <h3 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">{t('required_docs_heading')}</h3>
            <div className="flex gap-2 mb-2">
              <input value={newReqDoc} onChange={(e) => setNewReqDoc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const t = newReqDoc.trim(); if (t) { setRequiredDocs((prev) => [...prev, t]); setNewReqDoc(''); } } }} placeholder={t('doc_input_ph')} className="border border-[var(--color-input-border)] rounded px-3 py-2 text-sm flex-1 bg-[var(--color-input-fill)] text-[var(--color-foreground)]" />
              <button onClick={() => { const t = newReqDoc.trim(); if (t) { setRequiredDocs((prev) => [...prev, t]); setNewReqDoc(''); } }} className="bg-amber-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-amber-700">{t('add_button')}</button>
            </div>
            {requiredDocs.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)] py-1">
                <span className="text-amber-500 mt-0.5">📎</span>
                <span className="flex-1">{d}</span>
                <button onClick={() => setRequiredDocs((prev) => prev.filter((_, j) => j !== i))} aria-label={t('remove_document', { doc: d })} className="text-red-400 hover:text-red-600 text-xs">✕</button>
              </div>
            ))}
          </div>
          <button onClick={create} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)]">{tc('save')}</button>
        </div>
      )}
      {contracts.length === 0 ? <EmptyState message={t('no_contracts')} /> : null}
      {contracts.map((c) => (
        <div key={c.id} className="border border-[var(--color-card-border)] rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div><h3 className="font-medium">{c.title}</h3>
              {c.value ? <p className="text-xs text-[var(--color-text-secondary)]">{c.value} {c.currency || 'SAR'}{c.start_date ? ` • ${t('from_prefix')}${c.start_date}` : ''}{c.end_date ? `${t('to_prefix')}${c.end_date}` : ''}</p> : ''}
              {clientType === 'business' && <p className="text-xs text-[var(--color-text-disabled)]">{t('contract_value_excl_vat')}</p>}
              {(c.required_documents?.length ?? 0) > 0 && <p className="text-xs text-amber-600 mt-0.5">📎 {c.required_documents?.length}{t('doc_required_suffix')}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                c.contract_type === 'main' || c.contract_type === null
                  ? 'bg-[var(--color-gold-soft)] text-[var(--color-gold-text)] border border-[var(--color-gold-border)]'
                  : 'bg-blue-900/30 text-blue-400'
              }`}>
                {c.contract_type === 'main' || c.contract_type === null ? t('main_contract') : t('additional_contract')}
              </span>
              <StatusBadge status={c.status} />
            </div>
          </div>
          <ContractStatusStepper status={c.status} compact />
          {c.clauses?.length > 0 && (
            <div className="mt-2 space-y-1">
              {c.clauses.map((cl) => (
                <p key={cl.id} className="text-xs text-[var(--color-text-secondary)] pr-2 border-r-2 border-[var(--color-card-border)]">{cl.content}</p>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2 flex-wrap">
            {!isSA && c.status === 'draft' && <button onClick={() => doAction(c.id, 'send')} className="text-xs text-[var(--color-gold-text)] hover:underline">{t('send_contract')}</button>}
            {!isSA && c.status === 'edit_requested' && <button onClick={() => doAction(c.id, 'send')} className="text-xs text-amber-600 hover:underline">{t('resend_after_edit')}</button>}
            {c.status === 'client_approved' && (
              <>
                {c.pdf_url && <a href={c.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">{t('view_signed_contract')}</a>}
                {isSA && (
                  <button onClick={() => openApproveSig(c.id)} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700">{t('company_approve')}</button>
                )}
              </>
            )}
            {c.status === 'company_approved' && (
              <>
                {c.pdf_url && <a href={c.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">{t('download_final_contract')}</a>}
                {!isSA && <button onClick={() => doAction(c.id, 'archive')} className="text-xs text-[var(--color-text-secondary)] hover:underline">{t('archive_contract')}</button>}
              </>
            )}
            {c.status === 'completed' && (
              <>{c.pdf_url && <a href={c.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">{t('download_final_contract')}</a>}</>
            )}
          </div>
        </div>
      ))}

      {approveSig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={closeApproveSig}>
          <div
            ref={approveSigDialogRef}
            {...approveSigDialogProps}
            aria-labelledby={approveSigTitleId}
            className="bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={approveSigTitleId} className="font-bold">{t('company_approve_modal_title')}</h3>

            {savedUserSig && !useSavedSig ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-secondary)]">{t('saved_signature_label')}</p>
                {savedUserSig.type === 'text' ? (
                  <p className="text-lg font-[cursive] border border-[var(--color-card-border)] rounded-lg p-4 bg-[var(--color-card-border)] text-center">{savedUserSig.data}</p>
                ) : (
                  <img src={resolveFileUrl(savedUserSig.data)} alt={t('saved_signature_alt')} className="max-h-20 border border-[var(--color-card-border)] rounded-lg p-2 bg-[var(--color-card-border)] mx-auto" />
                )}
                <div className="flex gap-2">
                  <button onClick={() => setUseSavedSig(true)}
                    className="flex-1 bg-purple-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-purple-700">{t('use_saved_signature')}</button>
                  <button onClick={() => { setSavedUserSig(null); }}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--color-card-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-border)]">{t('write_new_signature')}</button>
                </div>
              </div>
            ) : useSavedSig ? (
              <div className="space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-purple-700 font-medium">{t('will_use_saved_sig')}</p>
                  {savedUserSig && (
                    savedUserSig.type === 'text' ? (
                      <p className="text-lg font-[cursive] mt-2 text-purple-900">{savedUserSig.data}</p>
                    ) : (
                      <img src={resolveFileUrl(savedUserSig.data)} alt="" className="max-h-16 mx-auto mt-2" />
                    )
                  )}
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-[var(--color-text-secondary)]">{t('signature_instructions')}</p>
                <textarea value={approveSig.signature} onChange={(e) => setApproveSig({ ...approveSig, signature: e.target.value })}
                  className="border border-[var(--color-input-border)] rounded-lg px-4 py-3 text-lg font-medium w-full h-20 text-center bg-[var(--color-input-fill)] text-[var(--color-foreground)]"
                  placeholder={t('signature_ph')} />
              </>
            )}

            <div className="flex gap-2">
              <button onClick={doCompanyApprove} disabled={!useSavedSig && !savedUserSig && !approveSig.signature.trim()}
                className="flex-1 bg-purple-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-purple-700 disabled:opacity-50">{t('approve_and_sign')}</button>
              <button onClick={closeApproveSig}
                className="px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--color-card-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-border)]">{t('cancel_button')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
