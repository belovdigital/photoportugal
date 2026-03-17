"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

interface Conversation {
  booking_id: string;
  other_name: string;
  other_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  booking_status: string;
  package_name: string | null;
}

interface Message {
  id: string;
  text: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  created_at: string;
  read_at: string | null;
}

function MessagesContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const initialChat = searchParams.get("chat");
  const userId = (session?.user as { id?: string })?.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(initialChat);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    fetch("/api/messages/conversations")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setConversations(data); setLoadingConvos(false); })
      .catch(() => setLoadingConvos(false));
  }, []);

  useEffect(() => {
    if (!activeChat) { setMessages([]); if (pollRef.current) clearInterval(pollRef.current); return; }
    setLoadingMessages(true);
    fetchMessages(activeChat).then(() => { setLoadingMessages(false); setTimeout(scrollToBottom, 50); });
    pollRef.current = setInterval(() => fetchMessages(activeChat), 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChat, scrollToBottom]);

  async function fetchMessages(bookingId: string) {
    try {
      const res = await fetch(`/api/messages?booking_id=${bookingId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          if (JSON.stringify(prev.map(m => m.id)) === JSON.stringify(data.map((m: Message) => m.id))) return prev;
          setTimeout(scrollToBottom, 30);
          return data;
        });
        setConversations((prev) => prev.map((c) => c.booking_id === bookingId ? { ...c, unread_count: 0 } : c));
      }
    } catch {}
  }

  useEffect(() => { if (activeChat && !loadingMessages) inputRef.current?.focus(); }, [activeChat, loadingMessages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || !activeChat) return;
    const tempMsg: Message = { id: `temp-${Date.now()}`, text, sender_id: userId || "", sender_name: session?.user?.name || "", sender_avatar: session?.user?.image || null, created_at: new Date().toISOString(), read_at: null };
    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage("");
    setTimeout(scrollToBottom, 10);
    setSending(true);
    const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: activeChat, text }) });
    setSending(false);
    if (res.ok) {
      const data = await res.json();
      await fetchMessages(activeChat);
      if (data.warning) alert(data.warning);
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    }
    setConversations((prev) => prev.map((c) => c.booking_id === activeChat ? { ...c, last_message: text, last_message_at: new Date().toISOString() } : c));
    inputRef.current?.focus();
  }

  const activeConvo = conversations.find((c) => c.booking_id === activeChat);

  if (!session?.user) return <div className="flex h-96 items-center justify-center"><Link href="/auth/signin" className="text-primary-600">Sign in</Link></div>;

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">Messages</h1>
      <p className="mt-1 text-gray-500">Chat with your {userId ? "contacts" : "photographers"}</p>

      <div className="mt-6 flex gap-4 rounded-xl border border-warm-200 bg-white" style={{ height: "min(520px, calc(100vh - 220px))" }}>
        {/* Conversations sidebar */}
        <div className={`w-full shrink-0 border-r border-warm-100 sm:w-64 ${activeChat ? "hidden sm:block" : ""}`}>
          <div className="overflow-y-auto p-2" style={{ height: "min(520px, calc(100vh - 220px))" }}>
            {loadingConvos ? (
              <div className="space-y-3 p-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-warm-200" />
                    <div className="flex-1 space-y-1.5"><div className="h-3 w-16 animate-pulse rounded bg-warm-200" /><div className="h-2.5 w-24 animate-pulse rounded bg-warm-100" /></div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-gray-400">
                No conversations yet
              </div>
            ) : (
              conversations.map((convo) => (
                <button
                  key={convo.booking_id}
                  onClick={() => setActiveChat(convo.booking_id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                    activeChat === convo.booking_id ? "bg-primary-50" : "hover:bg-warm-50"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xs font-bold text-primary-600">
                      {convo.other_avatar ? <img src={convo.other_avatar} alt="" className="h-full w-full object-cover" /> : convo.other_name.charAt(0)}
                    </div>
                    {convo.unread_count > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-primary-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`truncate text-sm ${convo.unread_count > 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{convo.other_name}</span>
                      {convo.last_message_at && <span className="ml-1 shrink-0 text-[10px] text-gray-400">{formatTime(convo.last_message_at)}</span>}
                    </div>
                    <p className="truncate text-xs text-gray-400">{convo.last_message || "Start a conversation"}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat */}
        <div className={`flex flex-1 flex-col ${!activeChat ? "hidden sm:flex" : "flex"}`}>
          {activeChat && activeConvo ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-2.5 border-b border-warm-100 px-4 py-3">
                <button onClick={() => setActiveChat(null)} className="text-gray-400 hover:text-gray-600 sm:hidden">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xs font-bold text-primary-600">
                  {activeConvo.other_avatar ? <img src={activeConvo.other_avatar} alt="" className="h-full w-full object-cover" /> : activeConvo.other_name.charAt(0)}
                </div>
                <span className="text-sm font-semibold text-gray-900">{activeConvo.other_name}</span>
              </div>

              {/* Messages */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center"><p className="text-sm text-gray-400">No messages yet. Say hello!</p></div>
                ) : (
                  <div className="space-y-0.5">
                    {messages.map((msg, i) => {
                      const isMe = msg.sender_id === userId;
                      const isLast = i === messages.length - 1 || messages[i + 1]?.sender_id !== msg.sender_id;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${isLast ? "mb-2" : ""}`}>
                          <div className="max-w-[70%]">
                            <div className={`inline-block rounded-2xl px-3 py-1.5 text-sm ${
                              isMe ? "bg-primary-600 text-white" : "bg-warm-100 text-gray-900"
                            } ${isMe ? (isLast ? "rounded-br-sm" : "") : (isLast ? "rounded-bl-sm" : "")}`}>
                              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            </div>
                            {isLast && <p className={`mt-0.5 text-[10px] text-gray-400 ${isMe ? "text-right" : ""}`}>{formatTime(msg.created_at)}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-warm-100 px-3 py-2.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-full border border-warm-200 bg-warm-50 px-4 py-2 text-sm outline-none focus:border-primary-300 focus:bg-white"
                />
                <button type="submit" disabled={sending || !newMessage.trim()} className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary-600 text-white disabled:opacity-30">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-gray-400">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return <Suspense><MessagesContent /></Suspense>;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
