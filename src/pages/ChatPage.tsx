import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminLayout, EmployeeLayout, TabletLayout } from '../components/Layouts';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import { Message, User } from '../types';
import {
  fetchMessagesBetween,
  sendMessageToDB,
  fetchUnreadCountFromDB,
  markMessagesAsReadInDB,
} from '../lib/authService';
import { Send, MessageSquare, Store, ArrowLeft, Users, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  buildPhoneTransferResponseContent,
  parsePhoneTransferMessage,
  PhoneTransferRequestPayload,
  PhoneTransferResponsePayload,
} from '../lib/phoneRequestProtocol';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function UserAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm';
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-bold shrink-0 shadow-sm', sizeClass)}>
      {initials}
    </div>
  );
}

const ChatPageInner = () => {
  const navigate = useNavigate();
  const { storeName } = useParams();
  const { currentUser, users, inventory, updatePhone } = useStore();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [actionSending, setActionSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, boolean>>({});
  const [rejectingRequest, setRejectingRequest] = useState<PhoneTransferRequestPayload | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const onlineChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const activeStore = decodeURIComponent(storeName || '');
  const allStores = useMemo(() => Array.from(new Set(users.flatMap(u => u.stores))), [users]);
  const targetStockStore = useMemo(() => {
    if (currentUser?.role !== 'Stock') return '';
    const base = activeStore || currentUser.currentStore || currentUser.stores[0] || '';
    return currentUser.stores.find(s => s !== base) || allStores.find(s => s !== base) || '';
  }, [currentUser, activeStore, allStores]);

  // All other users (employees + admin, except current)
  const contacts = useMemo(
    () => users.filter(u => {
      if (u.id === currentUser?.id) return false;
      if (currentUser?.role !== 'Stock') return true;
      return targetStockStore ? u.stores.includes(targetStockStore) : true;
    }),
    [users, currentUser, targetStockStore]
  );

  // (tablet mode shows contact list first — no auto-select)

  // Initialize online statuses from store users
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    users.forEach(u => { if (u.id !== currentUser?.id) initial[u.id] = u.online ?? false; });
    setOnlineStatuses(initial);
  }, [users, currentUser]);

  // Realtime subscription for online status changes
  useEffect(() => {
    if (!currentUser) return;
    if (onlineChannelRef.current) { supabase.removeChannel(onlineChannelRef.current); }

    const onlineCh = supabase
      .channel('users-online')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload: any) => {
        if (payload.new && payload.new.id && payload.new.id !== currentUser.id) {
          setOnlineStatuses(prev => ({ ...prev, [payload.new.id]: payload.new.online ?? false }));
        }
      })
      .subscribe();

    onlineChannelRef.current = onlineCh;
    return () => { supabase.removeChannel(onlineCh); onlineChannelRef.current = null; };
  }, [currentUser]);

  const loadUnread = useCallback(async () => {
    if (!currentUser) return;
    const counts = await fetchUnreadCountFromDB(currentUser.id);
    setUnreadCounts(counts);
  }, [currentUser]);

  useEffect(() => { loadUnread(); }, [loadUnread]);

  // Load messages when selecting a user
  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    let cancelled = false;

    fetchMessagesBetween(currentUser.id, selectedUser.id).then(msgs => {
      if (!cancelled) setMessages(msgs);
    });

    // Mark their messages as read
    markMessagesAsReadInDB(selectedUser.id, currentUser.id).then(() => {
      setUnreadCounts(prev => { const next = { ...prev }; delete next[selectedUser.id]; return next; });
    });

    return () => { cancelled = true; };
  }, [selectedUser, currentUser]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Supabase Broadcast subscription — works without Supabase Auth
  useEffect(() => {
    if (!currentUser) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel('phonetastic-messages')
      .on('broadcast', { event: 'new-message' }, ({ payload }: any) => {
        const msg: Message = payload as Message;
        if (!msg || !msg.id) return;

        // Only care about messages involving the current user
        if (msg.receiverId !== currentUser.id && msg.senderId !== currentUser.id) return;

        setSelectedUser(sel => {
          const isBetweenUs = sel && (
            (msg.senderId === sel.id && msg.receiverId === currentUser.id) ||
            (msg.senderId === currentUser.id && msg.receiverId === sel.id)
          );

          if (isBetweenUs) {
            setMessages(prev => {
              // Replace temp if sender is current user, otherwise just append
              if (msg.senderId === currentUser.id) {
                const hasDupe = prev.some(m => m.id === msg.id);
                if (hasDupe) return prev;
                return prev
                  .filter(m => !(m.id.startsWith('temp-') && m.content === msg.content))
                  .concat(msg);
              }
              // From the other person — append if not already present
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            if (msg.senderId === sel.id) {
              markMessagesAsReadInDB(sel.id, currentUser.id);
            }
          } else if (msg.receiverId === currentUser.id) {
            setUnreadCounts(prev => ({ ...prev, [msg.senderId]: (prev[msg.senderId] || 0) + 1 }));
          }
          return sel;
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentUser]);

  const handleSend = async () => {
    if (!input.trim() || !currentUser || !selectedUser || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);

    // Optimistic update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      senderId: currentUser.id,
      receiverId: selectedUser.id,
      content,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    const saved = await sendMessageToDB(currentUser.id, selectedUser.id, content);
    if (saved && channelRef.current) {
      // Broadcast via the already-subscribed channel so ALL parties receive it
      await channelRef.current.send({
        type: 'broadcast',
        event: 'new-message',
        payload: saved,
      });
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const sendTransferDecision = async (
    req: PhoneTransferRequestPayload,
    status: 'approved' | 'rejected',
    reason?: string
  ) => {
    if (!currentUser || actionSending) return;
    setActionSending(true);

    const content = buildPhoneTransferResponseContent({
      type: 'phone_transfer_response',
      requestId: req.requestId,
      phoneId: req.phoneId,
      status,
      reason: reason?.trim() || undefined,
      responderId: currentUser.id,
      responderName: currentUser.fullName,
      createdAt: new Date().toISOString(),
    });

    const saved = await sendMessageToDB(currentUser.id, req.requesterId, content);
    if (saved) {
      setMessages(prev => (prev.some(m => m.id === saved.id) ? prev : [...prev, saved]));
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'new-message',
          payload: saved,
        });
      }

      // Decrease inventory on approval
      if (status === 'approved') {
        const phone = inventory.find(p => p.id === req.phoneId);
        if (phone) {
          let updatedColors = phone.colors ? [...phone.colors] : [];
          if (req.colorDetails && req.colorDetails.length > 0) {
            req.colorDetails.forEach(cd => {
              updatedColors = updatedColors.map(pc =>
                pc.color === cd.color && pc.reference === cd.reference
                  ? { ...pc, qty: Math.max(0, pc.qty - cd.qty) }
                  : pc
              );
            });
          }
          const newQty = Math.max(0, phone.quantity - req.qty);
          updatePhone(phone.id, { quantity: newQty, colors: updatedColors });
        }
      }
    }

    setActionSending(false);
    setRejectingRequest(null);
    setRejectReason('');
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  const requestResponses = new Map<string, PhoneTransferResponsePayload>();
  messages.forEach(msg => {
    const parsed = parsePhoneTransferMessage(msg.content);
    if (parsed?.kind === 'response') {
      requestResponses.set(parsed.data.requestId, parsed.data);
    }
  });

  messages.forEach(msg => {
    const date = msg.createdAt.slice(0, 10);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else groupedMessages.push({ date, msgs: [msg] });
  });

  // ── Tablet (Stock role) rendering ─────────────────────────────────────
  if (currentUser?.role === 'Stock') {
    return (
      <div className="flex flex-col h-[calc(100dvh-64px)] bg-slate-100">

        {/* ── Contact list ──────────────────────────── */}
        {!selectedUser && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 py-5 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center gap-4">
              <button
                onClick={() => navigate(`/tablet/hub/${encodeURIComponent(activeStore)}`)}
                className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20 active:bg-white/20 shrink-0"
              >
                <ArrowLeft size={22} />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white">Messages</h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5 uppercase tracking-wide">
                  {contacts.length} contact{contacts.length !== 1 ? 's' : ''}{targetStockStore ? ` · ${targetStockStore}` : ''}
                </p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/10 shrink-0">
                <MessageSquare size={20} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {contacts.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
                  <Users size={36} className="text-slate-300" />
                  <p className="text-base font-medium">Aucun contact disponible</p>
                </div>
              )}
              {contacts.map(user => {
                const unread = unreadCounts[user.id] || 0;
                const isOnline = onlineStatuses[user.id] ?? user.online ?? false;
                return (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="w-full flex items-center gap-4 px-5 py-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 active:bg-indigo-50 text-left transition-colors"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar name={user.fullName} size="lg" />
                      <span className={cn(
                        'absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-white',
                        isOnline ? 'bg-emerald-400' : 'bg-slate-300'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-slate-900 truncate">{user.fullName}</p>
                        {unread > 0 && (
                          <span className="min-w-[22px] h-[22px] rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center px-1 shrink-0">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                      <p className={cn('text-sm font-medium mt-1 flex items-center gap-1.5', isOnline ? 'text-emerald-600' : 'text-slate-400')}>
                        <span className={cn('h-2 w-2 rounded-full shrink-0', isOnline ? 'bg-emerald-400' : 'bg-slate-300')} />
                        {isOnline ? 'En ligne' : 'Hors ligne'}
                        {user.role === 'Administrateur' && <span className="ml-1 text-amber-600 font-bold">· Admin</span>}
                      </p>
                      {user.role !== 'Administrateur' && user.stores.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <Store size={11} />
                          {user.stores.join(', ')}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={22} className="text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Chat view ─────────────────────────────── */}
        {selectedUser && (
          <>
            <div className="flex items-center gap-4 px-4 py-4 bg-white border-b border-slate-200 shadow-sm shrink-0">
              <button
                onClick={() => setSelectedUser(null)}
                className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 active:bg-slate-200 shrink-0"
              >
                <ArrowLeft size={22} />
              </button>
              <div className="relative shrink-0">
                <UserAvatar name={selectedUser.fullName} size="lg" />
                <span className={cn(
                  'absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-white',
                  (onlineStatuses[selectedUser.id] ?? selectedUser.online) ? 'bg-emerald-400' : 'bg-slate-300'
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-slate-900 truncate">{selectedUser.fullName}</p>
                <p className={cn('text-sm font-medium flex items-center gap-1.5 mt-0.5', (onlineStatuses[selectedUser.id] ?? selectedUser.online) ? 'text-emerald-600' : 'text-slate-400')}>
                  <span className={cn('h-2 w-2 rounded-full shrink-0', (onlineStatuses[selectedUser.id] ?? selectedUser.online) ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300')} />
                  {(onlineStatuses[selectedUser.id] ?? selectedUser.online) ? 'En ligne' : 'Hors ligne'}
                  {selectedUser.role !== 'Administrateur' && selectedUser.stores.length > 0 && (
                    <><span className="text-slate-300">·</span><span className="text-slate-500 truncate">{selectedUser.stores.join(', ')}</span></>
                  )}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-100">
              {groupedMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 py-20">
                  <div className="h-20 w-20 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-slate-200">
                    <MessageSquare size={36} className="text-slate-400" />
                  </div>
                  <p className="font-semibold text-slate-600 text-base">Aucun message</p>
                  <p className="text-sm text-slate-400">Démarrez la conversation !</p>
                </div>
              )}
              {groupedMessages.map(group => (
                <div key={group.date}>
                  <div className="flex items-center justify-center my-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">{formatDate(group.date)}</span>
                  </div>
                  <div className="space-y-4">
                    {group.msgs.map(msg => {
                      const isMine = msg.senderId === currentUser?.id;
                      const parsed = parsePhoneTransferMessage(msg.content);

                      if (parsed?.kind === 'request') {
                        const req = parsed.data;
                        const response = requestResponses.get(req.requestId);
                        const status = response?.status || 'pending';
                        const canAct = status === 'pending' && currentUser?.id === req.receiverId && !isMine;
                        return (
                          <div key={msg.id} className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
                            {!isMine && <UserAvatar name={selectedUser.fullName} size="sm" />}
                            <div className={cn(
                              'max-w-[88%] px-4 py-4 rounded-2xl text-sm leading-relaxed border',
                              isMine ? 'bg-indigo-600/10 border-indigo-200 text-slate-900' : 'bg-white border-slate-200 text-slate-900'
                            )}>
                              <p className="font-bold text-base">📦 Demande de transfert</p>
                              <div className="mt-2 space-y-1">
                                <p className="text-sm font-semibold text-slate-700">📱 {req.phoneLabel}</p>
                                {(req.storage || req.ram) && (
                                  <p className="text-sm text-slate-600">{req.storage && `💾 ${req.storage}`}{req.storage && req.ram && ' · '}{req.ram && `🧠 ${req.ram}`}</p>
                                )}
                                {req.condition && <p className="text-sm text-slate-600">🏷️ État: {req.condition}</p>}
                                {req.basePrice && <p className="text-sm text-slate-600">💰 Prix: {req.basePrice}€</p>}
                              </div>
                              {req.colorDetails && req.colorDetails.length > 0 && (
                                <div className="mt-3 border-t border-slate-200 pt-3 space-y-2">
                                  {req.colorDetails.map((cd, i) => (
                                    <div key={i} className="text-sm">
                                      <p className="font-semibold text-slate-700">🎨 {cd.color} × {cd.qty}{cd.price ? ` · ${cd.price}€` : ''}</p>
                                      {cd.reference && <p className="text-slate-500 pl-2">🔖 Réf: {cd.reference}</p>}
                                      {(cd.batteryHealth || cd.screenCondition || cd.frameCondition) && (
                                        <p className="text-slate-500 pl-2">
                                          {cd.batteryHealth && `🔋 ${cd.batteryHealth}`}
                                          {cd.batteryHealth && cd.screenCondition && ' · '}
                                          {cd.screenCondition && `📱 ${cd.screenCondition}`}
                                          {cd.screenCondition && cd.frameCondition && ' · '}
                                          {cd.frameCondition && `🛡️ ${cd.frameCondition}`}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="mt-3 border-t border-slate-200 pt-2 space-y-1">
                                <p className="text-sm text-slate-600">🏪 {req.fromStore} → {req.toStore} · Qté: {req.qty}</p>
                                <p className="text-sm text-slate-500">Demandé par {req.requesterName}</p>
                              </div>
                              <p className={cn(
                                'inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-semibold',
                                status === 'pending' ? 'bg-amber-100 text-amber-800' : status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              )}>
                                {status === 'pending' ? 'En attente' : status === 'approved' ? '✅ Confirmée' : '❌ Refusée'}
                              </p>
                              {canAct && (
                                <div className="mt-4 flex items-center gap-3">
                                  <button
                                    onClick={() => sendTransferDecision(req, 'approved')}
                                    disabled={actionSending}
                                    className="flex-1 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white disabled:opacity-50 flex items-center justify-center gap-2"
                                  >
                                    <CheckCircle2 size={16} /> Confirmer
                                  </button>
                                  <button
                                    onClick={() => setRejectingRequest(req)}
                                    disabled={actionSending}
                                    className="flex-1 py-3 rounded-xl text-sm font-bold bg-rose-600 text-white disabled:opacity-50 flex items-center justify-center gap-2"
                                  >
                                    <XCircle size={16} /> Refuser
                                  </button>
                                </div>
                              )}
                              <p className="text-xs mt-2 text-right font-medium text-slate-400">{formatTime(msg.createdAt)}</p>
                            </div>
                          </div>
                        );
                      }

                      if (parsed?.kind === 'response') {
                        const res = parsed.data;
                        return (
                          <div key={msg.id} className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
                            {!isMine && <UserAvatar name={selectedUser.fullName} size="sm" />}
                            <div className={cn(
                              'max-w-[88%] px-4 py-4 rounded-2xl text-sm leading-relaxed border',
                              res.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                            )}>
                              <p className="font-bold text-base">Réponse à la demande</p>
                              <p className="mt-1 text-sm">{res.status === 'approved' ? '✅ Demande acceptée' : '❌ Demande refusée'}</p>
                              {res.reason && <p className="mt-1 text-sm">Raison : {res.reason}</p>}
                              <p className="text-xs mt-2 text-right font-medium opacity-70">{formatTime(msg.createdAt)}</p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
                          {!isMine && <UserAvatar name={selectedUser.fullName} size="sm" />}
                          <div className={cn(
                            'max-w-[80%] px-4 py-3.5 rounded-2xl leading-relaxed',
                            isMine
                              ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-md shadow-md shadow-indigo-600/20'
                              : 'bg-white text-slate-900 rounded-bl-md shadow-sm border border-slate-200/80'
                          )}>
                            <p className="whitespace-pre-wrap break-all text-base">{msg.content}</p>
                            <p className={cn('text-xs mt-1.5 text-right font-medium', isMine ? 'text-indigo-200' : 'text-slate-400')}>
                              {formatTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-4 bg-white border-t border-slate-200 flex items-end gap-3 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] shrink-0">
              <textarea
                className="flex-1 resize-none rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all max-h-32 min-h-14"
                placeholder="Écrire un message…"
                value={input}
                rows={1}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className={cn(
                  'h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 transition-all',
                  input.trim() && !sending
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                <Send size={22} />
              </button>
            </div>
          </>
        )}

        {rejectingRequest && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50">
            <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Refuser la demande</h3>
              <p className="text-sm text-slate-500 mt-1">Ajoutez une raison (obligatoire).</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: vendu, appareil défectueux, introuvable..."
                className="mt-3 w-full min-h-28 rounded-2xl border-2 border-slate-300 px-4 py-3 text-base focus:outline-none focus:border-indigo-500"
              />
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => { setRejectingRequest(null); setRejectReason(''); }}
                  className="flex-1 px-4 py-4 rounded-2xl border-2 border-slate-300 text-slate-700 text-base font-bold"
                >
                  Annuler
                </button>
                <button
                  onClick={() => sendTransferDecision(rejectingRequest, 'rejected', rejectReason)}
                  disabled={!rejectReason.trim() || actionSending}
                  className="flex-1 px-4 py-4 rounded-2xl bg-rose-600 text-white text-base font-bold disabled:opacity-50"
                >
                  Confirmer le refus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100dvh-64px)] md:h-[calc(100vh-80px)] rounded-2xl border border-slate-200 overflow-hidden shadow-xl shadow-slate-300/40">

      {/* ── Left panel — contacts ─────────────────────────── */}
      <aside className={cn(
        'border-r border-slate-200 flex flex-col bg-white',
        'w-full md:w-80 md:shrink-0',
        selectedUser ? 'hidden md:flex' : 'flex'
      )}>
        <div className="px-4 py-4 bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white border border-white/10">
              <MessageSquare size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Messages</h2>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
                {currentUser?.role === 'Stock' && targetStockStore ? ` · Vers ${targetStockStore}` : ''}
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {contacts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
              <Users size={24} className="text-slate-300" />
              Aucun contact trouvé
            </div>
          )}
          {contacts.map(user => {
            const unread = unreadCounts[user.id] || 0;
            const isSelected = selectedUser?.id === user.id;
            const isOnline = onlineStatuses[user.id] ?? user.online ?? false;
            return (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-b border-slate-200/60',
                  isSelected
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white hover:bg-indigo-50/50'
                )}
              >
                <div className="relative shrink-0">
                  <UserAvatar name={user.fullName} size="md" />
                  <span className={cn(
                    'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2',
                    isSelected ? 'border-indigo-600' : 'border-white',
                    isOnline ? 'bg-emerald-400' : 'bg-slate-300'
                  )} />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm px-1">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={cn('text-sm font-bold truncate', isSelected ? 'text-white' : 'text-slate-900')}>
                      {user.fullName}
                    </p>
                    <span className={cn(
                      'text-[10px] font-semibold shrink-0 flex items-center gap-1',
                      isOnline
                        ? (isSelected ? 'text-emerald-300' : 'text-emerald-600')
                        : (isSelected ? 'text-indigo-200' : 'text-slate-400')
                    )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', isOnline ? 'bg-emerald-400' : 'bg-slate-300', isSelected && isOnline && 'bg-emerald-300', isSelected && !isOnline && 'bg-indigo-200')} />
                      {isOnline ? 'En ligne' : 'Hors ligne'}
                    </span>
                  </div>
                  <p className={cn('text-xs truncate flex items-center gap-1 mt-0.5', isSelected ? 'text-indigo-200' : 'text-slate-500')}>
                    {user.role === 'Administrateur' ? (
                      <span className={cn('font-semibold', isSelected ? 'text-amber-300' : 'text-amber-600')}>Admin</span>
                    ) : (
                      <>
                        <Store size={10} className="shrink-0" />
                        {user.stores.join(', ') || 'Sans magasin'}
                      </>
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Right panel — chat ───────────────────────────── */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0 bg-slate-100',
        // Mobile: full width when chat open, hidden otherwise
        !selectedUser ? 'hidden md:flex' : 'flex'
      )}>
        {!selectedUser ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5 px-8">
            <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-xl shadow-indigo-600/25">
              <MessageSquare size={40} className="text-white" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">Sélectionnez un contact</p>
              <p className="text-sm text-slate-500 mt-2 max-w-xs leading-relaxed">Choisissez un collègue à gauche pour commencer une conversation.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3.5 bg-white border-b border-slate-200 shadow-sm">
              {/* Back button — mobile only */}
              <button
                onClick={() => {
                  if (currentUser?.role === 'Stock' && activeStore) {
                    navigate(`/tablet/hub/${encodeURIComponent(activeStore)}`);
                    return;
                  }
                  setSelectedUser(null);
                }}
                className="md:hidden p-2 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="relative shrink-0">
                <UserAvatar name={selectedUser.fullName} size="md" />
                <span className={cn(
                  'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white',
                  (onlineStatuses[selectedUser.id] ?? selectedUser.online) ? 'bg-emerald-400' : 'bg-slate-300'
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{selectedUser.fullName}</p>
                <p className="text-xs flex items-center gap-1.5 mt-0.5">
                  <span className={cn(
                    'font-semibold flex items-center gap-1',
                    (onlineStatuses[selectedUser.id] ?? selectedUser.online) ? 'text-emerald-600' : 'text-slate-400'
                  )}>
                    <span className={cn('h-2 w-2 rounded-full', (onlineStatuses[selectedUser.id] ?? selectedUser.online) ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300')} />
                    {(onlineStatuses[selectedUser.id] ?? selectedUser.online) ? 'En ligne' : 'Hors ligne'}
                  </span>
                  {selectedUser.role !== 'Administrateur' && selectedUser.stores.length > 0 && (
                    <><span className="text-slate-300">·</span><span className="text-slate-500 truncate">{selectedUser.stores.join(', ')}</span></>
                  )}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-slate-100">
              {groupedMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm space-y-3">
                  <div className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-slate-200">
                    <MessageSquare size={28} className="text-slate-400" />
                  </div>
                  <p className="font-semibold text-slate-600">Aucun message</p>
                  <p className="text-xs text-slate-400">Démarrez la conversation !</p>
                </div>
              )}
              {groupedMessages.map(group => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">{formatDate(group.date)}</span>
                  </div>
                  <div className="space-y-3">
                    {group.msgs.map(msg => {
                      const isMine = msg.senderId === currentUser?.id;
                      const parsed = parsePhoneTransferMessage(msg.content);

                      if (parsed?.kind === 'request') {
                        const req = parsed.data;
                        const response = requestResponses.get(req.requestId);
                        const status = response?.status || 'pending';
                        const canAct =
                          status === 'pending' &&
                          currentUser?.id === req.receiverId &&
                          !isMine;

                        return (
                          <div key={msg.id} className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
                            {!isMine && <UserAvatar name={selectedUser.fullName} size="sm" />}
                            <div className={cn(
                              'max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed border',
                              isMine
                                ? 'bg-indigo-600/10 border-indigo-200 text-slate-900'
                                : 'bg-white border-slate-200 text-slate-900'
                            )}>
                              <p className="font-bold text-base">📦 Demande de transfert</p>
                              <div className="mt-2 space-y-0.5">
                                <p className="text-xs font-semibold text-slate-700">📱 {req.phoneLabel}</p>
                                {(req.storage || req.ram) && (
                                  <p className="text-xs text-slate-600">
                                    {req.storage && `💾 ${req.storage}`}{req.storage && req.ram && ' · '}{req.ram && `🧠 ${req.ram}`}
                                  </p>
                                )}
                                {req.condition && <p className="text-xs text-slate-600">🏷️ État: {req.condition}</p>}
                                {req.basePrice && <p className="text-xs text-slate-600">💰 Prix: {req.basePrice}€</p>}
                              </div>
                              {req.colorDetails && req.colorDetails.length > 0 && (
                                <div className="mt-2 border-t border-slate-200 pt-2 space-y-2">
                                  {req.colorDetails.map((cd, i) => (
                                    <div key={i} className="text-xs">
                                      <p className="font-semibold text-slate-700">🎨 {cd.color} × {cd.qty}{cd.price ? ` · ${cd.price}€` : ''}</p>
                                      {cd.reference && <p className="text-slate-500 pl-2">🔖 Réf: {cd.reference}</p>}
                                      {(cd.batteryHealth || cd.screenCondition || cd.frameCondition) && (
                                        <p className="text-slate-500 pl-2">
                                          {cd.batteryHealth && `🔋 ${cd.batteryHealth}`}
                                          {cd.batteryHealth && cd.screenCondition && ' · '}
                                          {cd.screenCondition && `📱 ${cd.screenCondition}`}
                                          {cd.screenCondition && cd.frameCondition && ' · '}
                                          {cd.frameCondition && `🛡️ ${cd.frameCondition}`}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="mt-2 border-t border-slate-200 pt-2 space-y-0.5">
                                <p className="text-xs text-slate-600">🏪 {req.fromStore} → {req.toStore} · Qté: {req.qty}</p>
                                <p className="text-xs text-slate-500">Demandé par {req.requesterName}</p>
                              </div>
                              <p className={cn(
                                'inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-semibold',
                                status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                              )}>
                                {status === 'pending' ? 'Demande en cours' : status === 'approved' ? 'Demande confirmée' : 'Demande refusée'}
                              </p>

                              {canAct && (
                                <div className="mt-3 flex items-center gap-2">
                                  <button
                                    onClick={() => sendTransferDecision(req, 'approved')}
                                    disabled={actionSending}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    <CheckCircle2 size={14} /> Confirmer
                                  </button>
                                  <button
                                    onClick={() => setRejectingRequest(req)}
                                    disabled={actionSending}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                                  >
                                    <XCircle size={14} /> Refuser
                                  </button>
                                </div>
                              )}

                              <p className={cn('text-[10px] mt-1.5 text-right font-medium', 'text-slate-400')}>
                                {formatTime(msg.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (parsed?.kind === 'response') {
                        const res = parsed.data;
                        return (
                          <div key={msg.id} className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
                            {!isMine && <UserAvatar name={selectedUser.fullName} size="sm" />}
                            <div className={cn(
                              'max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed border',
                              res.status === 'approved'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-rose-50 border-rose-200 text-rose-900'
                            )}>
                              <p className="font-bold">Réponse à la demande</p>
                              <p className="mt-1 text-xs">{res.status === 'approved' ? 'Demande acceptée' : 'Demande refusée'}</p>
                              {res.reason && <p className="mt-1 text-xs">Raison: {res.reason}</p>}
                              <p className="text-[10px] mt-1.5 text-right font-medium opacity-70">{formatTime(msg.createdAt)}</p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
                          {!isMine && <UserAvatar name={selectedUser.fullName} size="sm" />}
                          <div className={cn(
                            'max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                            isMine
                              ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-md shadow-md shadow-indigo-600/20'
                              : 'bg-white text-slate-900 rounded-bl-md shadow-sm border border-slate-200/80'
                          )}>
                            <p className="whitespace-pre-wrap break-all">{msg.content}</p>
                            <p className={cn('text-[10px] mt-1.5 text-right font-medium', isMine ? 'text-indigo-200' : 'text-slate-400')}>
                              {formatTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3.5 bg-white border-t border-slate-200 flex items-end gap-3 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
              <textarea
                className="flex-1 resize-none rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-indigo-500 transition-all max-h-28 min-h-11"
                placeholder="Écrire un message…"
                value={input}
                rows={1}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className={cn(
                  'h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-all',
                  input.trim() && !sending
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-105'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </div>

      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-5">
            <h3 className="text-base font-bold text-slate-900">Refuser la demande</h3>
            <p className="text-sm text-slate-500 mt-1">Ajoutez une raison (obligatoire).</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: vendu, appareil défectueux, introuvable..."
              className="mt-3 w-full min-h-24 rounded-xl border-2 border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => { setRejectingRequest(null); setRejectReason(''); }}
                className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-300 text-slate-700 text-sm font-bold"
              >
                Annuler
              </button>
              <button
                onClick={() => sendTransferDecision(rejectingRequest, 'rejected', rejectReason)}
                disabled={!rejectReason.trim() || actionSending}
                className="flex-1 px-3 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-50"
              >
                Envoyer refus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ChatPage = () => {
  const { currentUser } = useStore();

  if (!currentUser) return null;

  if (currentUser.role === 'Administrateur') {
    return (
      <AdminLayout title="Messages">
        <ChatPageInner />
      </AdminLayout>
    );
  }

  if (currentUser.role === 'Stock') {
    return (
      <TabletLayout title="Messagerie Stock">
        <ChatPageInner />
      </TabletLayout>
    );
  }

  return (
    <EmployeeLayout title="Messages">
      <ChatPageInner />
    </EmployeeLayout>
  );
};
