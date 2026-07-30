'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { subscribeToWorkspace } from '@/lib/echo';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import MeetingChip from '@/components/ui/MeetingChip';

const CLIENT_FILE_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
function resolveFileUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${CLIENT_FILE_BASE}/storage/${url.replace(/^\/?storage\//, '')}`;
}

export default function ClientChat({ wsId, wsActive }: { wsId: number; wsActive?: boolean }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [responding, setResponding] = useState<Record<number, boolean>>({});
  const [replyTo, setReplyTo] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: any } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const load = () => {
    api.get(`/workspaces/${wsId}/chat`)
      .then(({ data }) => { setMessages(data.messages || []); setError(''); })
      .catch(() => setError('فشل تحميل المحادثة'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    const unsub = subscribeToWorkspace(wsId, {
      onMessageSent: () => { load(); },
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
      if (data?.message) { setMessages((prev) => [...prev, data.message]); setText(''); setUploadFile(null); setReplyTo(null); if (fileRef.current) fileRef.current.value = ''; }
    } catch {
      setText('');
      setUploadFile(null);
      setReplyTo(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
    }
  };

  const respond = async (id: number, action: string) => {
    setResponding((prev) => ({ ...prev, [id]: true }));
    const { data } = await api.post(`/chat/${id}/respond`, { action }).catch(() => ({ data: null }));
    if (data) setMessages((prev) => prev.map((m) => m.id === id ? data.message : m));
    setResponding((prev) => ({ ...prev, [id]: false }));
  };

  const actionResultLabel: Record<string, string> = {
    approved: '✅ تمت الموافقة',
    edit_requested: '✎ تم طلب تعديل',
  };

  if (loading) return <LoadingSkeleton message="جاري تحميل المحادثة..." />;
  if (error) return <p className="text-sm text-red-500 text-center py-8">{error}</p>;

  if (!wsActive) {
    return (
      <div className="text-center py-10">
        <span className="text-4xl block mb-3">🔒</span>
        <p className="text-[var(--color-text-secondary)] text-sm">المحادثة غير متاحة — في انتظار تفعيل مساحة العمل بعد اكتمال الدفع</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div ref={chatRef} className="h-72 overflow-y-auto space-y-3 border border-[var(--color-card-border)] rounded-lg p-3 bg-[var(--color-card-border)]">
        {messages.length === 0 ? <EmptyState message="لا توجد رسائل بعد" /> : null}
        {messages.map((m, idx) => {
          const sentByClient = m.sender_type === 'App\\Models\\Client';
          const isSubUser = m.sender_type === 'App\\Models\\SubUser';
          const isClientTeam = sentByClient || isSubUser;
          const isPending = m.requires_action && !m.action_taken;
          const isResponded = m.action_taken;
          const approval = m.approval;
          const sender = m.sender;
          const senderAvatarUrl = sender?.avatar_url as string | undefined;
          const senderName = sender?.name as string | undefined;
          const prev = idx > 0 ? messages[idx - 1] : null;
          const isConsecutive = prev && prev.sender_type === m.sender_type && prev.sender_id === m.sender_id;
          if (m.type === 'meeting' && m.metadata) {
            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-xs">
                  <MeetingChip metadata={m.metadata} />
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex gap-2 ${isClientTeam ? 'justify-end' : 'justify-start'}`}
              onContextMenu={(e) => handleContextMenu(e, m)}>
              {!isClientTeam && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full border border-[var(--color-primary)] overflow-hidden bg-[var(--color-input-fill)] flex items-center justify-center text-xs text-[var(--color-gold)] font-bold mt-1">
                  {senderAvatarUrl ? (
                    <img src={senderAvatarUrl.startsWith('http') ? senderAvatarUrl : `${CLIENT_FILE_BASE}/storage/${senderAvatarUrl.replace(/^\/?storage\//, '')}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{senderName?.[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
              )}
              {isClientTeam && !isConsecutive && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full border border-[var(--color-gold)] overflow-hidden bg-[var(--color-primary)] flex items-center justify-center text-xs text-white font-bold mt-1">
                  {senderAvatarUrl ? (
                    <img src={senderAvatarUrl.startsWith('http') ? senderAvatarUrl : `${CLIENT_FILE_BASE}/storage/${senderAvatarUrl.replace(/^\/?storage\//, '')}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{senderName?.[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
              )}
              <div className="max-w-xs">
                <div className={`px-3 py-2 text-sm ${isClientTeam ? 'bg-[var(--color-primary)] text-white rounded-br-lg rounded-tl-lg rounded-tr-lg' : 'bg-[var(--color-card)] text-[var(--color-foreground)] rounded-bl-lg rounded-tl-lg rounded-tr-lg'}`}>
                  <p className={`text-xs mb-0.5 ${isClientTeam ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {sentByClient ? (senderName || 'أنت') : isSubUser ? (m.sender?.name || 'عضو فريق') : ((m.sender?.role === 'super_admin' ? 'مشرف' : 'مدير حساب') + ': ' + (m.sender?.name || ''))}
                  </p>
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
                  {isPending && <p className="text-xs text-red-500 mt-1 font-medium">🏷️ يتطلب موافقتك</p>}
                  {isResponded && <p className={`text-xs mt-1 font-medium ${m.action_result === 'approved' ? 'text-emerald-600' : m.action_result === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>{actionResultLabel[m.action_result || '']}</p>}
                  {approval?.certificate?.pdf_url && (
                    <a href={resolveFileUrl(approval.certificate.pdf_url)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
                      📄 تحميل شهادة الموافقة
                    </a>
                  )}
                </div>
                {isPending && (
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => respond(m.id, 'approved')} disabled={responding[m.id]}
                      className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700 disabled:opacity-50">✔ موافقة</button>
                    <button onClick={() => respond(m.id, 'edit_requested')} disabled={responding[m.id]}
                      className="text-xs bg-amber-600 text-white px-2 py-1 rounded hover:bg-amber-700 disabled:opacity-50">✎ تعديل</button>
                  </div>
                )}
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

      {sendError && <p className="text-xs text-red-500">{sendError}</p>}
      <div className="flex gap-2 items-center">
        <input type="file" ref={fileRef} className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
        <button onClick={() => fileRef.current?.click()} className="text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] text-lg px-1 flex-shrink-0" title="إرفاق ملف">📎</button>
        {uploadFile && <span className="text-xs text-[var(--color-gold)] self-center truncate max-w-24 flex-shrink-0">{uploadFile.name}</span>}
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          className="flex-1 border border-[var(--color-input-border)] rounded-full px-4 py-2 text-sm bg-[var(--color-input-fill)] text-[var(--color-foreground)] placeholder-[var(--color-text-disabled)]" placeholder="اكتب رسالة..." />
        <button onClick={send} className="bg-[var(--color-primary)] text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--color-primary-dark)] flex-shrink-0" title="إرسال">↑</button>
      </div>

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
