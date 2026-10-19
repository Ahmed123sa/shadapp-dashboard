'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { subscribeToWorkspace } from '@/lib/echo';
import { resolveFileUrl, notifyWriteError } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import MeetingChip from '@/components/ui/MeetingChip';
import { formatTime, formatShortDate } from '@/lib/client-format';
import { Btn, Icon } from '@/components/client-portal/ui';
import { useTranslations, useLocale } from 'next-intl';
import { useWorkspaceChat, useSendChatMessage, useRespondChatAction } from '@/hooks/queries/useChat';
import { canDo } from '@/lib/client-auth';
import type { ChatMessage, User } from '@/types';

export default function ClientChat({ wsId, wsActive }: { wsId: number; wsActive?: boolean }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const tp = useTranslations('client_portal');
  const locale = useLocale();
  const chatQuery = useWorkspaceChat(wsId);
  const sendMutation = useSendChatMessage(wsId);
  const respondMutation = useRespondChatAction(wsId);
  const messages = chatQuery.data ?? [];
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [responding, setResponding] = useState<Record<number, boolean>>({});
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: ChatMessage } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToWorkspace(wsId, {
      onMessageSent: () => { chatQuery.refetch(); },
      onMessageUpdated: () => { chatQuery.refetch(); },
      onMessageDeleted: () => { chatQuery.refetch(); },
    });
    return () => { if (unsub) unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, message: ChatMessage) => {
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
      await sendMutation.mutateAsync(form);
      setText(''); setUploadFile(null); setReplyTo(null); if (fileRef.current) fileRef.current.value = '';
    } catch {
      setText('');
      setUploadFile(null);
      setReplyTo(null);
      if (fileRef.current) fileRef.current.value = '';
      chatQuery.refetch();
    }
  };

  const respond = async (id: number, action: string) => {
    setResponding((prev) => ({ ...prev, [id]: true }));
    try {
      await respondMutation.mutateAsync({ id, action });
    } catch (err) {
      notifyWriteError(tc, 'ClientChat.respond', err);
    }
    setResponding((prev) => ({ ...prev, [id]: false }));
  };

  const actionResultLabel: Record<string, string> = {
    approved: t('chat_action_approved'),
    edit_requested: t('chat_action_edit_requested'),
  };

  if (chatQuery.isLoading) return <TableSkeleton />;
  if (chatQuery.isError) return <p className="locked" style={{ padding: '40px 0', justifyContent: 'center', width: '100%' }}>{t('chat_load_error')}</p>;

  if (!wsActive) {
    return <p className="locked" style={{ padding: '48px 0', justifyContent: 'center', width: '100%' }}><Icon name="lock" />{t('chat_unavailable_short')}</p>;
  }

  const canChat = canDo('can_chat');
  const canRespond = canDo('can_respond_approvals');
  const dayKey = (iso?: string) => (iso ? new Date(iso).toDateString() : '');

  return (
    <div className="chat">
      <div ref={chatRef} className="stream">
        {messages.length === 0 ? <p className="locked" style={{ padding: '36px 0', justifyContent: 'center', width: '100%' }}>{t('chat_no_messages')}</p> : null}
        {messages.map((m, idx) => {
          const sentByClient = m.sender_type === 'App\\Models\\Client';
          const isSubUser = m.sender_type === 'App\\Models\\SubUser';
          const mine = sentByClient || isSubUser;
          const isPending = m.requires_action && !m.action_taken;
          const isResponded = m.action_taken;
          const approval = m.approval;
          const sender = m.sender;
          const senderName = sender?.name;
          const prev = idx > 0 ? messages[idx - 1] : null;
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          const day = newDay && m.created_at ? <div key={`d${m.id}`} className="day">{formatShortDate(m.created_at, locale)}</div> : null;
          const who = sentByClient
            ? (senderName || t('sender_you'))
            : isSubUser
              ? (senderName || t('sender_team_member'))
              : (senderName || '');
          const role = mine ? null : ((m.sender as User | undefined)?.role === 'super_admin' ? t('sender_supervisor') : t('sender_account_manager'));
          const time = formatTime(m.created_at, locale);
          const avatar = (
            <div className="av">
              {sender?.avatar_url ? (
                <img src={resolveFileUrl(sender.avatar_url)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span>{senderName?.[0]?.toUpperCase() || '?'}</span>
              )}
            </div>
          );

          if (m.type === 'meeting' && m.metadata) {
            return (
              <div key={m.id}>
                {day}
                <div className="msg">
                  {avatar}
                  <div>
                    <div className="who"><b>{who}</b>{role && <span className="tagr">{role}</span>}<span>{time}</span></div>
                    <div className="card"><MeetingChip metadata={m.metadata} /></div>
                  </div>
                </div>
              </div>
            );
          }

          const fileBlock = m.type === 'file' && m.file_url ? (
            /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(m.file_url) ? (
              <img src={resolveFileUrl(m.file_url)} alt={t('attachment_label')} style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 10, marginBottom: 6 }} />
            ) : (
              <a className="lnk" href={resolveFileUrl(m.file_url)} target="_blank" rel="noopener noreferrer" style={{ marginBottom: 6 }}>
                <Icon name="clip" />
                {t('view_attachment')}
              </a>
            )
          ) : null;

          const replyBlock = m.reply_to ? (
            <div className="sub" style={{ borderInlineStart: '2px solid var(--line-2)', paddingInlineStart: 8, marginBottom: 6, opacity: 0.8 }}>
              <div style={{ fontWeight: 500 }}>{m.reply_to.sender?.name || 'Unknown'}</div>
              <div style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.reply_to.message || '...'}</div>
            </div>
          ) : null;

          const resultLabel = isResponded ? actionResultLabel[m.action_result || ''] : null;

          return (
            <div key={m.id}>
              {day}
              <div className={`msg ${mine ? 'mine' : ''}`.trim()} onContextMenu={(e) => handleContextMenu(e, m)}>
                {avatar}
                <div>
                  <div className="who"><b>{who}</b>{role && <span className="tagr">{role}</span>}<span>{time}</span></div>
                  {isPending || approval ? (
                    <div className={`card ${isPending ? 'apcard' : ''}`.trim()}>
                      {isPending && <div className="k"><span>{t('chat_requires_your_approval')}</span></div>}
                      {replyBlock}
                      {fileBlock}
                      {m.message && <div className="v" style={{ color: 'var(--ink)', marginTop: 8 }}>{m.message}</div>}
                      {resultLabel && <div className="v" style={{ marginTop: 8 }}>{resultLabel}</div>}
                      {approval?.certificate?.pdf_url && (
                        <a className="lnk" style={{ marginTop: 12 }} href={resolveFileUrl(approval.certificate.pdf_url)} target="_blank" rel="noopener noreferrer">
                          <Icon name="doc" />
                          {t('download_certificate')}
                        </a>
                      )}
                      {/* subuser-review-plan.md م٦ — responding to an approval
                          request maps to can_respond_approvals (same key as
                          ClientApprovals.tsx). */}
                      {isPending && canRespond && (
                        <div className="row">
                          <Btn variant="primary" onClick={() => respond(m.id, 'approved')} disabled={responding[m.id]}>{t('chat_approve_button')}</Btn>
                          <Btn onClick={() => respond(m.id, 'edit_requested')} disabled={responding[m.id]}>{t('chat_edit_button')}</Btn>
                        </div>
                      )}
                      {isPending && !canRespond && (
                        <div className="row"><span className="locked"><Icon name="lock" />{t('subuser_action_needs_owner')}</span></div>
                      )}
                    </div>
                  ) : (
                    <div className="bubble">
                      {replyBlock}
                      {fileBlock}
                      {m.message}
                      {resultLabel && <div className="sub" style={{ marginTop: 6 }}>{resultLabel}</div>}
                    </div>
                  )}
                  <div style={{ marginTop: 4, display: 'flex', gap: 10, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                    <button type="button" className="lnk" style={{ border: 0, fontSize: 11, opacity: 0.6 }} onClick={() => setReplyTo(m)} aria-label={t('chat_context_reply')} title={t('chat_context_reply')}>
                      {t('chat_context_reply')}
                    </button>
                    {mine && (
                      <span className="sub" style={{ fontSize: 11 }} title={m.read_at ? (locale === 'ar' ? 'مقروءة' : 'Read') : (locale === 'ar' ? 'تم الإرسال' : 'Sent')}>
                        {m.read_at ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {replyTo && canChat && (
        <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderInlineStart: '2px solid var(--crimson-ink)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{t('chat_reply_to', { name: replyTo.sender?.name || '...' })}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.message || '...'}</div>
          </div>
          <button type="button" onClick={() => setReplyTo(null)} aria-label={t('chat_cancel_reply')} className="lnk" style={{ border: 0 }}>✕</button>
        </div>
      )}

      {sendError && <p className="sub" style={{ color: 'var(--crimson-ink)' }}>{sendError}</p>}

      {canChat ? (
        <div className="composer">
          <div className="field">
            <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            <button type="button" className="ib" style={{ width: 28, height: 28 }} onClick={() => fileRef.current?.click()} title={t('chat_attach_file_title')} aria-label={t('chat_attach_file_title')}>
              <Icon name="clip" />
            </button>
            {uploadFile && <span className="sub" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadFile.name}</span>}
            <input value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={t('chat_input_placeholder')} />
          </div>
          <button type="button" className="send" onClick={send} title={t('chat_send_title')} aria-label={t('chat_send_title')}>
            <Icon name="send" />
          </button>
        </div>
      ) : (
        <div className="viewonly"><Icon name="lock" />{tp('viewonly')}</div>
      )}

      {contextMenu && canChat && (
        <div style={{ position: 'fixed', zIndex: 50, left: contextMenu.x, top: contextMenu.y }}>
          <Btn onClick={() => { setReplyTo(contextMenu.message); setContextMenu(null); }}>{t('chat_context_reply')}</Btn>
        </div>
      )}
    </div>
  );
}
