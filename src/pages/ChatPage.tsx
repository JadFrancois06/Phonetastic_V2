import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AdminLayout, EmployeeLayout } from '../components/Layouts';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import { Message, User } from '../types';
import {
  fetchMessagesBetween,
  sendMessageToDB,
  fetchUnreadCountFromDB,
  markMessagesAsReadInDB,
} from '../lib/authService';
import { Send, MessageSquare, Store, ArrowLeft, Search, Users } from 'lucide-react';
import { cn } from '../lib/utils';

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
  const { currentUser, users } = useStore();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const onlineChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // All other users (employees + admin, except current)
  const contacts = users.filter(u => u.id !== currentUser?.id);

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

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  messages.forEach(msg => {
    const date = msg.createdAt.slice(0, 10);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else groupedMessages.push({ date, msgs: [msg] });
  });

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
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
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
                onClick={() => setSelectedUser(null)}
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

  return (
    <EmployeeLayout title="Messages">
      <ChatPageInner />
    </EmployeeLayout>
  );
};
