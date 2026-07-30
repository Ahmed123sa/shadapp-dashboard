'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { subscribeToWorkspace } from '@/lib/echo';
import ChatContractCard from '@/components/chat/ChatContractCard';
import ContractBuilder from '@/components/chat/ContractBuilder';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import MeetingChip from '@/components/ui/MeetingChip';

const FILE_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
function resolveFileUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${FILE_BASE}/storage/${url.replace(/^\/?storage\//, '')}`;
}

export default function ChatTab({ wsId, wsActive, clientType }: { wsId: number; wsActive?: boolean; clientType?: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [sendError, setSendError] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: any } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const load = () => {
    Promise.all([
      api.get(`/workspaces/${wsId}/chat`).then(({ data }) => setMessages(data.messages || [])),
      api.get(`/workspaces/${wsId}/contracts`).then(({ data }) => setContracts(data.contracts?.data || data.contracts || [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    const unsub = subscribeToWorkspace(wsId, {
      onMessageSent: () => { load(); },
      onContractStatusChanged: () => { load(); },
    });
    return () => { clearInterval(iv); if (unsub) unsub(); };
  }, [wsId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, message: any) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, message });
  }, []);

  const send = async () => {
    if (!text.trim() && !uploadFile) return;
    setSendError('');
    const form = new FormData();
    if (text.trim()) form.append('message', text);
    if (uploadFile) form.append('file', uploadFile);
    if (replyTo) form.append('reply_to_id', String(replyTo.id));
    try {
      const { data } = await api.post(`/workspaces/${wsId}/chat`, form);
      if (data) { setMessages((prev) => [...prev, data.message]); setText(''); setUploadFile(null); setReplyTo(null); if (fileRef.current) fileRef.current.value = ''; }
    } catch {
      setText('');
      setUploadFile(null);
      setReplyTo(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
    }
  };

  const toggleAction = async (id: number) => {
    const { data } = await api.patch(`/chat/${id}/require-action`).catch(() => ({ data: null }));
    if (data) setMessages((prev) => prev.map((m) => m.id === id ? data.message : m));
  };

  const doContractAction = async (id: number, action: string) => {
    const { data } = await api.post(`/contracts/${id}/${action}`).catch(() => ({ data: null }));
    if (data) setContracts((prev) => prev.map((c) => c.id === id ? data.contract : c));
  };

  const onContractCreated = (contract: any) => {
    setContracts((prev) => [contract, ...prev]);
    setShowBuilder(false);
  };

  if (loading) return <LoadingSkeleton message="جاري تحميل المحادثة..." />;

  const user = getUser();
  const isSA = user?.role === 'super_admin';
  const canChat = wsActive !== false && !isSA;

  if (!canChat) {
    return (
      <div className="text-center py-10 space-y-3">
        <span className="text-4xl block">{!wsActive ? '🔒' : '👁️'}</span>
        <p className="text-[var(--color-text-secondary)] text-sm">
          {!wsActive ? 'المحادثة غير متاحة — في انتظار اكتمال الدفع وتفعيل مساحة العمل' : 'عرض المحادثة فقط'}
        </p>
        <div className="h-72 overflow-y-auto space-y-3 border border-[var(--color-card-border)] rounded-lg p-3 bg-[var(--color-card-border)]">
          {contracts.length > 0 && contracts.map((c) => (
            <ChatContractCard key={`contract-${c.id}`} contract={c} clientType={clientType} onAction={() => {}} />
          ))}
          {messages.map((m) => {
            const isClient = m.sender_type === 'App\\Models\\Client';
            const isSubUser = m.sender_type === 'App\\Models\\SubUser';
            const isClientTeam = isClient || isSubUser;
            if (m.type === 'meeting' && m.metadata) {
              return (
                <div key={m.id} className="flex justify-start">
                  <MeetingChip metadata={m.metadata} />
                </div>
              );
            }
            const initial = ((m.sender?.name?.[0]) || '?').toUpperCase();
            return (
            <div key={m.id} className={`flex ${isClientTeam ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-xs flex gap-2 items-start">
                {!isClientTeam && (
                  <div className="w-6 h-6 rounded-full bg-blue-200 overflow-hidden flex-shrink-0 mt-1">
                    {m.sender?.avatar_url ? (
                      <img src={resolveFileUrl(m.sender.avatar_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-blue-700 font-medium">{initial}</div>
                    )}
                  </div>
                )}
                <div>
                  <div className={`px-3 py-2 rounded-lg text-sm ${isClientTeam ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-input-fill)] text-[var(--color-foreground)]'}`}>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">{isClient ? (m.sender?.name || 'العميل') : isSubUser ? ('عضو فريق: ' + (m.sender?.name || '')) : ((m.sender?.role === 'super_admin' ? 'مشرف' : 'مدير حساب') + ': ' + (m.sender?.name || ''))}</p>
                    {m.reply_to && (
                      <div className="mb-1.5 pl-2 border-l-2 border-[var(--color-primary)] opacity-70">
                        <p className="text-[10px] font-medium">{m.reply_to.sender?.name || 'Unknown'}</p>
                        <p className="text-[10px] truncate max-w-[180px]">{m.reply_to.message || '...'}</p>
                      </div>
                    )}
                    {m.message}
                  </div>
                </div>
                {isClientTeam && (
                  <div className="w-6 h-6 rounded-full bg-zinc-200 overflow-hidden flex-shrink-0 mt-1">
                    {m.sender?.avatar_url ? (
                      <img src={resolveFileUrl(m.sender.avatar_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-[var(--color-text-secondary)] font-medium">{initial}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    );
  }

  const actionResultLabel: Record<string, string> = {
    approved: '✅ تمت الموافقة',
    edit_requested: '✎ طلب تعديل',
  };

  return (
    <div className="space-y-4">
      {!showBuilder ? (
        <button onClick={() => setShowBuilder(true)} className="text-sm text-[var(--color-gold)] hover:underline font-medium">
          + إرسال عقد خدمة إضافية
        </button>
      ) : (
        <ContractBuilder wsId={wsId} onCreated={onContractCreated} onCancel={() => setShowBuilder(false)} />
      )}

      <div ref={chatRef} className="h-72 overflow-y-auto space-y-3 border border-[var(--color-card-border)] rounded-lg p-3 bg-[var(--color-card-border)]">
        {contracts.length > 0 && contracts.map((c) => (
          <ChatContractCard key={`contract-${c.id}`} contract={c} clientType={clientType} onAction={doContractAction} />
        ))}
        {messages.length === 0 && contracts.length === 0 ? <EmptyState message="لا توجد رسائل بعد" /> : null}
        {messages.map((m) => {
          const isClient = m.sender_type === 'App\\Models\\Client';
          const isSubUser = m.sender_type === 'App\\Models\\SubUser';
          const isClientTeam = isClient || isSubUser;
          if (m.type === 'meeting' && m.metadata) {
            return (
              <div key={m.id} className="flex justify-start">
                <MeetingChip metadata={m.metadata} />
              </div>
            );
          }
          const approval = m.approval;
          const isPending = m.requires_action && !m.action_taken;
          const isResponded = m.action_taken;
          const initial = ((m.sender?.name?.[0]) || '?').toUpperCase();
          const senderLabel = isClient ? (m.sender?.name || 'العميل') : isSubUser ? (m.sender?.name || 'عضو فريق') : ((m.sender?.role === 'super_admin' ? 'مشرف' : 'مدير حساب') + ': ' + (m.sender?.name || ''));
          return (
          <div key={m.id} className={`flex ${isClientTeam ? 'justify-end' : 'justify-start'}`} onContextMenu={(e) => handleContextMenu(e, m)}>
            <div className="max-w-xs flex gap-2 items-start">
              {!isClientTeam && (
                <div className="w-7 h-7 rounded-full bg-blue-200 overflow-hidden flex-shrink-0 mt-1">
                  {m.sender?.avatar_url ? (
                    <img src={resolveFileUrl(m.sender.avatar_url)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-blue-700 font-medium">{initial}</div>
                  )}
                </div>
              )}
              <div>
                <div className={`px-3 py-2 rounded-lg text-sm ${isClient ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-input-fill)] text-[var(--color-foreground)]'}`}>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">{senderLabel}</p>
                  {m.reply_to && (
                    <div className="mb-1.5 pl-2 border-l-2 border-[var(--color-primary)] opacity-70">
                      <p className="text-[10px] font-medium">{m.reply_to.sender?.name || 'Unknown'}</p>
                      <p className="text-[10px] truncate max-w-[180px]">{m.reply_to.message || '...'}</p>
                    </div>
                  )}
                  {m.type === 'file' && m.file_url && (
                    <div className="mb-1">
                      {m.file_url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                        <img src={resolveFileUrl(m.file_url)} alt="مرفق" className="max-w-full rounded-lg max-h-40" />
                      ) : (
                        <a href={resolveFileUrl(m.file_url)} target="_blank" rel="noopener noreferrer" className="text-[var(--color-gold)] underline text-xs">📎 عرض المرفق</a>
                      )}
                    </div>
                  )}
                  {m.message}
                  {isPending && <p className="text-xs text-red-500 mt-1 font-medium">🏷️ طلب موافقة — قيد الانتظار</p>}
                  {isResponded && <p className={`text-xs mt-1 font-medium ${m.action_result === 'approved' ? 'text-emerald-600' : m.action_result === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>{actionResultLabel[m.action_result || '']}</p>}
                  {approval?.certificate?.pdf_url && (
                    <a href={resolveFileUrl(approval.certificate.pdf_url)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
                      📄 تحميل شهادة الموافقة
                    </a>
                  )}
                </div>
                {isClientTeam && (
                  <div className="w-7 h-7 rounded-full bg-zinc-200 overflow-hidden flex-shrink-0 mt-1">
                    {m.sender?.avatar_url ? (
                      <img src={resolveFileUrl(m.sender.avatar_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-secondary)] font-medium">{initial}</div>
                    )}
                  </div>
                )}
                {!isClientTeam && !m.action_taken && (
                  <button onClick={() => toggleAction(m.id)} className={`text-xs mt-0.5 ${m.requires_action ? 'text-red-500' : 'text-[var(--color-text-disabled)]'} hover:underline`}>
                    {m.requires_action ? 'إلغاء طلب الموافقة' : 'طلب موافقة العميل'}
                  </button>
                )}
              </div>
            </div>
          </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-input-fill)] border border-[var(--color-primary)] border-r-4 rounded-lg text-sm relative">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-[var(--color-primary)]">↩ رد على {replyTo.sender?.name || '...'}</p>
            <p className="text-xs text-[var(--color-text-secondary)] truncate">{replyTo.message || '...'}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-[var(--color-text-secondary)] hover:text-red-500 text-xs px-1">✕</button>
        </div>
      )}

      <div className="flex gap-2">
        <input type="file" ref={fileRef} className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
        <button onClick={() => fileRef.current?.click()} className="text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] text-lg px-1" title="إرفاق ملف">📎</button>
        {uploadFile && <span className="text-xs text-[var(--color-gold)] self-center truncate max-w-24">{uploadFile.name}</span>}
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
          className="flex-1 border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-input-fill)] text-[var(--color-foreground)]" placeholder="اكتب رسالة..." />
        <button onClick={send} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)]">إرسال</button>
      </div>
      {sendError && <p className="text-xs text-red-500">{sendError}</p>}

      {contextMenu && (
        <div className="fixed z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button onClick={() => { setReplyTo(contextMenu.message); setContextMenu(null); }}
            className="bg-[var(--color-card)] border border-[var(--color-card-border)] shadow-lg rounded-lg px-4 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-input-fill)] whitespace-nowrap">
            ↩ رد
          </button>
        </div>
      )}
    </div>
  );
}
