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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  // Load conversations
  useEffect(() => {
    fetch("/api/messages/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConversations(data);
        setLoadingConvos(false);
      })
      .catch(() => setLoadingConvos(false));
  }, []);

  // Load messages when chat opens + poll for new ones
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    // Immediate fetch
    setLoadingMessages(true);
    fetchMessages(activeChat).then(() => {
      setLoadingMessages(false);
      setTimeout(scrollToBottom, 50);
    });

    // Poll every 2 seconds
    pollRef.current = setInterval(() => {
      fetchMessages(activeChat);
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeChat, scrollToBottom]);

  async function fetchMessages(bookingId: string) {
    try {
      const res = await fetch(`/api/messages?booking_id=${bookingId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          // Only update if messages changed
          if (JSON.stringify(prev.map(m => m.id)) === JSON.stringify(data.map((m: Message) => m.id))) {
            return prev;
          }
          return data;
        });

        // Clear unread in sidebar
        setConversations((prev) =>
          prev.map((c) =>
            c.booking_id === bookingId ? { ...c, unread_count: 0 } : c
          )
        );
      }
    } catch {}
  }

  // Focus input when chat opens
  useEffect(() => {
    if (activeChat && !loadingMessages) inputRef.current?.focus();
  }, [activeChat, loadingMessages]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || !activeChat) return;

    // Optimistic update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      text,
      sender_id: userId || "",
      sender_name: session?.user?.name || "",
      sender_avatar: session?.user?.image || null,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage("");

    setSending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: activeChat, text }),
    });
    setSending(false);

    if (res.ok) {
      // Fetch real messages to replace optimistic
      await fetchMessages(activeChat);
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    }

    // Update sidebar
    setConversations((prev) =>
      prev.map((c) =>
        c.booking_id === activeChat
          ? { ...c, last_message: text, last_message_at: new Date().toISOString() }
          : c
      )
    );

    inputRef.current?.focus();
  }

  const activeConvo = conversations.find((c) => c.booking_id === activeChat);

  if (!session?.user) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Link href="/auth/signin" className="text-primary-600 hover:underline">Sign in to view messages</Link>
      </div>
    );
  }

  return (
    <div className="flex" style={{ height: "min(600px, calc(100vh - 160px))" }}>
      {/* Sidebar */}
      <div className={`w-full shrink-0 border-r border-warm-200 bg-white sm:w-72 ${activeChat ? "hidden sm:block" : ""}`}>
        <div className="flex h-12 items-center border-b border-warm-200 px-4">
          <h2 className="text-sm font-bold text-gray-900">Conversations</h2>
        </div>

        <div className="overflow-y-auto" style={{ height: "calc(100% - 48px)" }}>
          {loadingConvos ? (
            <div className="space-y-3 p-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-warm-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-20 animate-pulse rounded bg-warm-200" />
                    <div className="h-3 w-32 animate-pulse rounded bg-warm-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No conversations yet
            </div>
          ) : (
            conversations.map((convo) => (
              <button
                key={convo.booking_id}
                onClick={() => setActiveChat(convo.booking_id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-warm-50 ${
                  activeChat === convo.booking_id ? "bg-primary-50" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-sm font-bold text-primary-600">
                    {convo.other_avatar ? (
                      <img src={convo.other_avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      convo.other_name.charAt(0)
                    )}
                  </div>
                  {convo.unread_count > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                      {convo.unread_count}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${convo.unread_count > 0 ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                      {convo.other_name}
                    </span>
                    {convo.last_message_at && (
                      <span className="shrink-0 text-[10px] text-gray-400">
                        {formatTime(convo.last_message_at)}
                      </span>
                    )}
                  </div>
                  <p className={`truncate text-xs ${convo.unread_count > 0 ? "font-medium text-gray-700" : "text-gray-400"}`}>
                    {convo.last_message || convo.package_name || "Start a conversation"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex flex-1 flex-col ${!activeChat ? "hidden sm:flex" : "flex"}`}>
        {activeChat && activeConvo ? (
          <>
            {/* Chat header */}
            <div className="flex h-12 items-center gap-3 border-b border-warm-200 bg-white px-4">
              <button onClick={() => setActiveChat(null)} className="p-1 text-gray-400 hover:text-gray-600 sm:hidden">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xs font-bold text-primary-600">
                {activeConvo.other_avatar ? (
                  <img src={activeConvo.other_avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  activeConvo.other_name.charAt(0)
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{activeConvo.other_name}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-warm-50 px-4 py-4">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-gray-400">Loading...</p>
                </div>
              ) : (
                <div className="mx-auto max-w-2xl space-y-1">
                  {messages.length === 0 && (
                    <div className="py-12 text-center text-sm text-gray-400">
                      No messages yet. Say hello!
                    </div>
                  )}
                  {messages.map((msg, i) => {
                    const isMe = msg.sender_id === userId;
                    const showAvatar = !isMe && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);
                    const isLast = i === messages.length - 1 || messages[i + 1]?.sender_id !== msg.sender_id;

                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${isLast ? "mb-3" : "mb-0.5"}`}>
                        {!isMe && (
                          <div className="mr-2 w-7 shrink-0">
                            {showAvatar && (
                              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-[10px] font-bold text-primary-600">
                                {msg.sender_avatar ? (
                                  <img src={msg.sender_avatar} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  msg.sender_name.charAt(0)
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="max-w-[75%]">
                          <div className={`inline-block rounded-2xl px-3.5 py-2 text-sm ${
                            isMe ? "bg-primary-600 text-white" : "bg-white text-gray-900 shadow-sm"
                          } ${isMe ? (isLast ? "rounded-br-md" : "") : (isLast ? "rounded-bl-md" : "")}`}>
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          </div>
                          {isLast && (
                            <p className={`mt-0.5 text-[10px] text-gray-400 ${isMe ? "text-right" : ""}`}>
                              {formatTime(msg.created_at)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-warm-200 bg-white px-4 py-3">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-warm-200 bg-warm-50 px-4 py-2 text-sm outline-none transition focus:border-primary-300 focus:bg-white"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition hover:bg-primary-700 disabled:opacity-30"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-warm-50">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warm-100">
                <svg className="h-7 w-7 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="mt-3 text-sm text-gray-400">Select a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
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
