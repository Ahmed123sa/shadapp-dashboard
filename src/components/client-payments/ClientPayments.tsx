'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTranslations } from 'next-intl';

export default function ClientPayments({ wsId }: { wsId: number }) {
  const t = useTranslations('dashboard');
  const [payments, setPayments] = useState<any[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [payableContract, setPayableContract] = useState<any>(null);
  const [payableContracts, setPayableContracts] = useState<any[]>([]);
  const [taxSummary, setTaxSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [methodType, setMethodType] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [payRes, contRes] = await Promise.all([
          api.get(`/workspaces/${wsId}/payments`),
          api.get(`/workspaces/${wsId}/contracts`),
        ]);
        const payData = payRes.data;
        setPayments(payData.payments || []);
        setMethods(payData.available_methods || []);
        setTaxSummary(payData.tax_summary || null);

        const contracts = contRes.data.contracts?.data ?? contRes.data.contracts ?? [];
        const payableList = contracts.filter((c: any) =>
          c.status === 'company_approved' || c.status === 'completed'
        );
        if (payableList.length > 0) {
          setPayableContract(payableList[0]);
          setPayableContracts(payableList);
          if (!payData.payments?.length) setAmount(String(taxSummary?.grand_total ?? payableList[0].value));
        }
      } catch (e) {
        console.error(e);
        setError(t('load_error'));
      }
    };
    loadAll().finally(() => setLoading(false));
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [wsId]);

  const methodLabels: Record<string, string> = {
    bank_transfer: t('pay_method_bank_transfer'), swift: t('pay_method_swift'), corporate_account: t('pay_method_corporate_account'),
    instapay: t('pay_method_instapay'), vodafone_cash: t('pay_method_vodafone_cash'), mobile_wallet: t('pay_method_mobile_wallet'),
  };

  const startEdit = (p: any) => {
    setEditingPayment(p);
    setAmount(String(p.amount));
    setCurrency(p.currency || 'SAR');
    setMethodType(p.method_type);
    setProofFile(null);
  };

  const cancelEdit = () => {
    setEditingPayment(null);
    setAmount('');
    setCurrency('SAR');
    setMethodType('');
    setProofFile(null);
  };

  const submit = async () => {
    if (!amount || !methodType) return;
    setSaving(true);
    const form = new FormData();
    form.append('amount', amount);
    form.append('currency', currency);
    form.append('method_type', methodType);
    if (proofFile) form.append('proof_file', proofFile);
    if (editingPayment) {
      form.append('_method', 'PUT');
    }
    const url = editingPayment
      ? `/workspaces/${wsId}/payments/${editingPayment.id}`
      : `/workspaces/${wsId}/payments`;
    const { data } = await api.post(url, form).catch(() => ({ data: null }));
    if (data) {
      if (editingPayment) {
        setPayments((prev) => prev.map((p) => p.id === editingPayment.id ? data.payment : p));
      } else {
        setPayments((prev) => [...prev, data.payment]);
      }
      cancelEdit();
    }
    setSaving(false);
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <p className="text-sm text-red-500 text-center py-8">{error}</p>;

  const pendingPayment = payments.find((p) => p.status === 'pending');
  const showPaymentForm = pendingPayment || payableContract;

  const approvedPayments = payments.filter(p => p.status === 'approved');
  const totalPaid = approvedPayments.reduce((s, p) => s + Number(p.amount), 0);
  const grandTotal = taxSummary?.grand_total != null ? Number(taxSummary.grand_total) : (payableContracts.length > 0 ? payableContracts.reduce((s, c) => s + Number(c.value), 0) : payments.reduce((s, p) => s + Number(p.amount), 0));
  const contractCurrency = payableContract?.currency || 'SAR';
  const remaining = grandTotal - totalPaid;
  const isFullyPaid = totalPaid >= grandTotal && grandTotal > 0;
  const progress = grandTotal > 0 ? Math.min(totalPaid / grandTotal, 1) : 0;

  const installmentName = (i: number) => t('pay_installment_num', { num: i + 1 });

  return (
    <div className="space-y-3">
      {/* إجمالي المدفوع */}
      <div className="bg-[#0d0d0d] border border-[var(--color-card-border)] rounded-xl p-4">
        {isFullyPaid ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[var(--color-success)] text-lg">✅</span>
              <p className="text-sm font-bold text-[var(--color-success)]">{t('pay_fully_paid')}</p>
            </div>
            <p className="text-2xl font-bold text-[var(--color-gold)]" style={{ fontFamily: "'Playfair Display', serif" }}>
              {totalPaid.toFixed(2)} {contractCurrency}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-[var(--color-gold)] font-medium">{t('pay_total_paid')}</p>
            <p className="text-2xl font-bold text-[var(--color-gold)] mt-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              {totalPaid.toFixed(2)} {contractCurrency}
            </p>
            <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">
              {t('pay_of_prefix', { total: grandTotal.toFixed(2), currency: contractCurrency, remaining: remaining.toFixed(2) })}
            </p>
            {taxSummary && taxSummary.tax_percentage > 0 && (
              <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">
                {t('pay_value_detail', { value: Number(taxSummary.contracts_total).toFixed(2), taxPercent: taxSummary.tax_percentage, taxAmount: Number(taxSummary.tax_amount).toFixed(2), currency: contractCurrency })}
              </p>
            )}
          </>
        )}
        <div className="mt-3">
          <div className="w-full h-1.5 bg-[var(--color-card-border)] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isFullyPaid ? 'bg-[var(--color-success)]' : 'bg-[var(--color-gold)]'}`} style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>

      {/* طرق الدفع المتاحة */}
      {methods.length > 0 && (
        <div className="bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl p-4">
          <p className="text-sm font-medium mb-2">{t('pay_method_ph')}:</p>
          <div className="flex flex-wrap gap-2">
            {methods.map((m) => (
              <span key={m} className="px-3 py-1 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded-full text-xs font-medium">
                {methodLabels[m] || m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* تنبيه بوجود عقد معتمد يتطلب الدفع */}
      {!pendingPayment && payableContract && (
        <div className="bg-[var(--color-card)] border border-[var(--color-gold)]/30 rounded-xl p-4">
          <p className="text-sm text-[var(--color-gold)] font-medium">
            💳 {t('pay_approved_contract_notice', { title: payableContract.title, value: payableContract.value, taxSuffix: taxSummary && taxSummary.tax_percentage > 0 ? ` + ${taxSummary.tax_percentage}% ${t('plus_tax')}` : '' })}
          </p>
        </div>
      )}

      {/* نموذج إرسال الدفع */}
      {showPaymentForm && (
        <div className="bg-blue-900/30 border border-blue-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💳</span>
            <div>
              {pendingPayment ? (
                <p className="font-medium text-blue-800">{t('pay_required_notice', { amount: pendingPayment.amount })}</p>
              ) : (
                <p className="font-medium text-blue-800">
                  {t('pay_complete_notice', { title: payableContract?.title || '' })}
                </p>
              )}
              <p className="text-xs text-[var(--color-gold)] mt-0.5">{t('pay_upload_proof_hint')}</p>
            </div>
          </div>
          <div className="space-y-3">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder={t('pay_amount_ph')}
              className="border border-[var(--color-input-border)] rounded-lg px-4 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)] placeholder-[var(--color-text-disabled)]" />
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}
              className="border border-[var(--color-input-border)] rounded-lg px-4 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]">
              <option value="SAR">{t('currency_sar')}</option><option value="USD">{t('currency_usd')}</option><option value="EUR">{t('currency_eur')}</option>
              <option value="AED">{t('currency_aed')}</option><option value="EGP">{t('currency_egp')}</option><option value="KWD">{t('currency_kwd')}</option>
              <option value="QAR">{t('currency_qar')}</option><option value="BHD">{t('currency_bhd')}</option><option value="OMR">{t('currency_omr')}</option>
            </select>
            <select value={methodType} onChange={(e) => setMethodType(e.target.value)}
              className="border border-[var(--color-input-border)] rounded-lg px-4 py-2 text-sm w-full bg-[var(--color-input-fill)] text-[var(--color-foreground)]">
              <option value="">{t('pay_method_ph')}</option>
              {methods.map((m) => <option key={m} value={m}>{methodLabels[m] || m}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-[var(--color-gold)] cursor-pointer hover:text-[var(--color-gold)]">
              <input type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
              <span className="border border-blue-200 rounded-lg px-4 py-2 bg-[var(--color-card)]">
                {proofFile ? proofFile.name : t('pay_choose_proof')}
              </span>
            </label>
            <div className="flex gap-2">
              <button onClick={submit} disabled={saving || !amount || !methodType}
                className="flex-1 bg-[var(--color-primary)] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
                {saving ? t('pay_saving') : editingPayment ? t('pay_update') : t('pay_submit_proof')}
              </button>
              {editingPayment && (
                <button onClick={cancelEdit} type="button"
                  className="bg-[var(--color-input-fill)] px-4 py-2.5 rounded-lg text-sm hover:bg-[var(--color-card-border)]">
                  {t('pay_cancel')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* قائمة المدفوعات السابقة أو رسالة عدم وجود مدفوعات */}
      {payments.length === 0 && !pendingPayment && !payableContract
        ? <EmptyState message={t('pay_no_payments')} />
        : payments.map((p, idx) => {
          const linkedContract = p.contract;
          const isPending = p.status === 'pending';
          const isApproved = p.status === 'approved';
          const statusColor = isApproved ? 'text-green-400' : isPending ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-disabled)]';
          const statusDot = isApproved ? 'bg-green-400' : isPending ? 'bg-[var(--color-gold)]' : 'bg-gray-500';
          const statusText = isApproved ? t('pay_status_approved') : isPending ? t('pay_status_pending') : p.status;

          const FILE_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
          const proofRaw = Array.isArray(p.proof_file_url) ? (p.proof_file_url[0] || null) : (p.proof_file_url || null);
          const proofUrl = proofRaw ? `${FILE_BASE_URL}/storage/${proofRaw.replace(/^\/?storage\//, '')}` : null;

          return (
          <div key={p.id} className={`border rounded-xl overflow-hidden ${isPending ? 'border-[var(--color-gold)]' : 'border-[var(--color-card-border)]'}`}>
            {/* ── القسم العلوي ── */}
            <div className="px-5 pt-5 pb-4">
              <p className="text-xs text-[var(--color-gold)] font-medium">{installmentName(idx)}</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1" style={{ fontFamily: "'Playfair Display', serif" }}>{p.amount} <span className="text-sm font-normal text-[var(--color-text-disabled)]">{p.currency || 'SAR'}</span></p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span>
                <span className={`text-xs font-medium ${statusColor}`}>{statusText}</span>
              </div>
            </div>

            {/* ── الفاصل ── */}
            <div className="h-px bg-[var(--color-card-border)]"></div>

            {/* ── القسم السفلي ── */}
            <div className="px-5 py-4 space-y-2">
              {p.method_type && (
                <div className="flex items-center gap-2">
                  <span className="text-xs">💳</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{methodLabels[p.method_type] || p.method_type}</span>
                </div>
              )}
              {linkedContract && (
                <div className="flex items-center gap-2">
                  <span className="text-xs">📄</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{linkedContract.title}</span>
                </div>
              )}
              {proofUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-xs">📎</span>
                  <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-gold)] hover:underline">{t('pay_view_proof')}</a>
                </div>
              )}
              {isPending && (
                <div className="pt-2">
                  <button onClick={() => startEdit(p)} className="w-full text-sm text-[var(--color-gold)] hover:underline font-medium">{t('pay_edit')}</button>
                </div>
              )}
            </div>
          </div>
          );
        })}
    </div>
  );
}
