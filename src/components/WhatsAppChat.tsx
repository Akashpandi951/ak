import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Send,
  Smile,
  CheckCheck,
  Crown,
  Grid3X3,
  ArrowLeft,
  ArrowDown,
} from 'lucide-react';
import { UserProfile, Conversation, Message } from '../types/index.ts';
import { api, wsService } from '../services/api.ts';

interface WhatsAppChatProps {
  currentUser: UserProfile;
  initialTargetUserId?: string;
  onInviteGame: (targetUserId: string, gameType: 'chess' | 'ttt') => void;
  onBackToDashboard?: () => void;
}

const EMOJIS = ['👍', '🔥', '👑', '♟️', '🎮', '⚡', '👏', '😂', '🎯', '🤝', '❤️', '🏆'];

export const WhatsAppChat: React.FC<WhatsAppChatProps> = ({
  currentUser,
  initialTargetUserId,
  onInviteGame,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState<number>(0);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const forceScrollBottomRef = useRef<boolean>(false);
  const prevContactIdRef = useRef<string | null>(null);
  const prevMessagesLenRef = useRef<number>(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (behavior === 'instant') {
      container.scrollTop = container.scrollHeight;
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior });
    }
    isNearBottomRef.current = true;
    setNewMessagesCount(0);
  }, []);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom <= 80;
    isNearBottomRef.current = nearBottom;
    if (nearBottom && newMessagesCount > 0) {
      setNewMessagesCount(0);
    }
  };

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations || []);

      // If initialTargetUserId provided, select or fetch that user
      if (initialTargetUserId) {
        const found = res.conversations.find((c) => c.contact.id === initialTargetUserId);
        if (found) {
          selectConversation(found.contact);
        } else {
          // Fetch user details and initiate chat
          const userRes = await api.getUser(initialTargetUserId);
          if (userRes.user) {
            selectConversation(userRes.user);
          }
        }
      } else if (res.conversations.length > 0 && !selectedContact) {
        selectConversation(res.conversations[0].contact);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  // WebSocket message and typing listeners
  useEffect(() => {
    const unsubs = [
      wsService.on('new_message', (data: any) => {
        const newMsg = data.message;
        if (!newMsg) return;

        // If message is for currently active conversation, append without duplicates
        if (
          selectedContact &&
          (newMsg.sender_id === selectedContact.id || newMsg.receiver_id === selectedContact.id)
        ) {
          setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
        }

        // Refresh conversation preview list
        loadConversations();
      }),

      wsService.on('typing', (data: any) => {
        if (selectedContact && data.senderId === selectedContact.id) {
          setOpponentTyping(data.isTyping);
        }
      }),

      wsService.on('presence', (data: any) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.contact.id === data.userId
              ? { ...c, contact: { ...c.contact, isOnline: data.isOnline } }
              : c
          )
        );
        if (selectedContact && selectedContact.id === data.userId) {
          setSelectedContact((prev: any) => ({ ...prev, isOnline: data.isOnline }));
        }
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [selectedContact]);

  // Scoped message container auto-scroll:
  // - Jumps to bottom on conversation switch
  // - Smoothly scrolls to bottom when user sends a message or is already near the bottom
  // - Preserves scroll position and displays new-message indicator if user scrolled up to read history
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const currentContactId = selectedContact?.id || null;
    const contactSwitched = prevContactIdRef.current !== currentContactId;
    const addedCount = messages.length - prevMessagesLenRef.current;
    const latestMessage = messages[messages.length - 1];
    const sentByMe = latestMessage?.sender_id === currentUser.id;

    prevContactIdRef.current = currentContactId;
    prevMessagesLenRef.current = messages.length;

    if (contactSwitched) {
      forceScrollBottomRef.current = false;
      requestAnimationFrame(() => {
        scrollToBottom('instant');
      });
      return;
    }

    if (addedCount > 0) {
      if (forceScrollBottomRef.current || sentByMe || isNearBottomRef.current) {
        forceScrollBottomRef.current = false;
        requestAnimationFrame(() => {
          scrollToBottom('smooth');
        });
      } else {
        setNewMessagesCount((prev) => prev + addedCount);
      }
    } else if (opponentTyping && isNearBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });
    }
  }, [messages, selectedContact?.id, opponentTyping, currentUser.id, scrollToBottom]);

  const selectConversation = async (contact: any) => {
    setSelectedContact(contact);
    setOpponentTyping(false);
    setNewMessagesCount(0);
    isNearBottomRef.current = true;
    forceScrollBottomRef.current = true;
    try {
      const res = await api.getMessages(contact.id);
      setMessages(res.messages || []);
      // Mark read in local conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.contact.id === contact.id ? { ...c, unreadCount: 0 } : c
        )
      );
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedContact) return;

    const text = inputText.trim();
    setInputText('');
    setShowEmojiPicker(false);
    forceScrollBottomRef.current = true;

    // Stop typing notification
    wsService.send('typing', { receiverId: selectedContact.id, isTyping: false });

    try {
      const res = await api.sendMessage(selectedContact.id, text);
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      loadConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!selectedContact) return;

    if (!isTyping) {
      setIsTyping(true);
      wsService.send('typing', { receiverId: selectedContact.id, isTyping: true });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      wsService.send('typing', { receiverId: selectedContact.id, isTyping: false });
    }, 1500);
  };

  const formatTimestamp = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.contact.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact.public_uid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      data-testid="lobby-chat-container"
      className="flex-1 h-[calc(100dvh-8rem)] md:h-[calc(100dvh-4rem)] max-h-[calc(100dvh-8rem)] md:max-h-[calc(100dvh-4rem)] min-h-0 p-2 sm:p-4 lg:p-6 flex flex-col max-w-7xl mx-auto w-full overflow-hidden"
    >
      <div className="flex-1 min-h-0 h-full w-full flex bg-slate-950/90 border border-cyan-500/25 rounded-3xl overflow-hidden shadow-2xl shadow-cyan-950/50 backdrop-blur-2xl">
        {/* Left: WhatsApp Conversations List */}
        <div
          className={`w-full md:w-80 lg:w-96 h-full min-h-0 border-r border-slate-800/80 flex flex-col bg-slate-950/60 ${
            selectedContact ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={currentUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`}
                alt="My Avatar"
                className="w-10 h-10 rounded-full object-cover border border-cyan-400/40"
              />
              <div>
                <h3 className="font-bold text-sm text-slate-100">Private Messages</h3>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> WhatsApp Sync
                </span>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-shrink-0 p-3 border-b border-slate-800/60">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats or UID..."
                className="w-full h-9 pl-9 pr-3 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Conversation Items */}
          <div
            data-testid="lobby-chat-conversations"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y divide-y divide-slate-800/40"
          >
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No conversations yet. Search players using the top bar to start chatting!
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedContact?.id === conv.contact.id;
                return (
                  <div
                    key={conv.conversationId}
                    onClick={() => selectConversation(conv.contact)}
                    className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-900/90 border-l-4 border-cyan-400'
                        : 'hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={conv.contact.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${conv.contact.username}`}
                        alt={conv.contact.username}
                        className="w-11 h-11 rounded-full object-cover border border-slate-700"
                      />
                      {conv.contact.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-sm text-slate-200 truncate">
                          {conv.contact.username}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-slate-500">
                            {formatTimestamp(conv.lastMessage.created_at)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400 truncate max-w-[170px]">
                          {conv.lastMessage?.content || 'Started a conversation'}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="w-5 h-5 rounded-full bg-emerald-500 text-black font-bold text-[10px] flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active WhatsApp Chat Window */}
        <div
          className={`flex-1 h-full min-h-0 flex flex-col bg-slate-950/40 relative overflow-hidden ${
            !selectedContact ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedContact ? (
            <>
              {/* Chat Header (Fixed at Top of Chat Panel) */}
              <div className="flex-shrink-0 p-3 sm:p-4 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedContact(null)}
                    className="md:hidden p-1.5 text-slate-400 hover:text-white"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="relative">
                    <img
                      src={selectedContact.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedContact.username}`}
                      alt={selectedContact.username}
                      className="w-10 h-10 rounded-full object-cover border border-cyan-400/40"
                    />
                    {selectedContact.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-slate-900 rounded-full" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      <span>{selectedContact.username}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                        {selectedContact.public_uid}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {opponentTyping ? (
                        <span className="text-emerald-400 font-semibold animate-pulse">
                          typing...
                        </span>
                      ) : selectedContact.isOnline ? (
                        <span className="text-emerald-400 font-medium">Online</span>
                      ) : (
                        'Offline'
                      )}
                    </p>
                  </div>
                </div>

                {/* Instant Game Challenge Buttons inside WhatsApp Header */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onInviteGame(selectedContact.id, 'chess')}
                    className="px-2.5 py-1.5 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-cyan-500/30"
                    title="Invite to 3D Chess"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Play Chess</span>
                  </button>
                  <button
                    onClick={() => onInviteGame(selectedContact.id, 'ttt')}
                    className="px-2.5 py-1.5 bg-violet-500/20 text-violet-300 hover:bg-violet-500 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-violet-500/30"
                    title="Invite to Tic-Tac-Toe"
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Play TTT</span>
                  </button>
                </div>
              </div>

              {/* Vertically Scrollable Chat Message Stream */}
              <div
                ref={messagesContainerRef}
                data-testid="lobby-chat-messages"
                onScroll={handleMessagesScroll}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6 space-y-3"
                style={{
                  backgroundImage: `radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.03) 0%, transparent 60%)`,
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {messages.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs">
                    <p className="mb-2">🔒 Messages are end-to-end synchronized and private between you and {selectedContact.username}.</p>
                    <p>Send a message below or challenge them to a match!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender_id === currentUser.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`relative max-w-[80%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl shadow-md ${
                            isMe
                              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none shadow-cyan-900/30'
                              : 'bg-slate-900/90 text-slate-100 border border-slate-800 rounded-tl-none'
                          }`}
                        >
                          <p className="text-sm leading-relaxed break-words">{m.content}</p>

                          <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-300/80">
                            <span>{formatTimestamp(m.created_at)}</span>
                            {isMe && (
                              <CheckCheck
                                className={`w-3.5 h-3.5 ${m.read ? 'text-cyan-200' : 'text-slate-300'}`}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {opponentTyping && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-full w-fit border border-slate-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
                    <span className="ml-1 text-[11px]">{selectedContact.username} is typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* New-Message Indicator when User Has Scrolled Up */}
              {newMessagesCount > 0 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
                  <button
                    type="button"
                    data-testid="lobby-chat-new-msg-btn"
                    onClick={() => scrollToBottom('smooth')}
                    className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xs shadow-lg shadow-cyan-500/30 flex items-center gap-1.5 hover:brightness-110 transition-all animate-bounce"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>
                      {newMessagesCount} new {newMessagesCount === 1 ? 'message' : 'messages'}
                    </span>
                  </button>
                </div>
              )}

              {/* Quick Emoji Bar */}
              {showEmojiPicker && (
                <div className="flex-shrink-0 p-2 border-t border-slate-800 bg-slate-900/90 flex flex-wrap gap-2 animate-in slide-in-from-bottom-2 duration-150">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setInputText((prev) => prev + emoji)}
                      className="text-lg p-1.5 hover:bg-slate-800 rounded-lg transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Bottom Input Field (Fixed at Bottom of Chat Panel) */}
              <form
                data-testid="lobby-chat-input-form"
                onSubmit={handleSendMessage}
                className="flex-shrink-0 p-3 border-t border-slate-800 bg-slate-900/80 flex items-center gap-2 z-10"
              >
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-2 rounded-xl transition-colors ${
                    showEmojiPicker ? 'text-cyan-400 bg-slate-800' : 'text-slate-400 hover:text-white'
                  }`}
                  aria-label="Toggle emoji picker"
                >
                  <Smile className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  data-testid="lobby-chat-input"
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder={`Message ${selectedContact.username}...`}
                  className="flex-1 h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />

                <button
                  type="submit"
                  data-testid="lobby-chat-send"
                  disabled={!inputText.trim()}
                  className="w-11 h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-md shadow-cyan-500/25 disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400">
                <Crown className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-300 mb-1">
                WhatsApp-Style Private Messenger
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Select a conversation from the left, or search players by username or public UID to start messaging in real time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

