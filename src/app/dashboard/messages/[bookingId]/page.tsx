"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Message {
  id: string;
  text: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  created_at: string;
  read_at: string | null;
}

export default function MessagesPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userId = (session?.user as { id?: string })?.id;

  useEffect(() => {
    params.then(({ bookingId: id }) => {
      setBookingId(id);
      loadMessages(id);
    });
  }, [params]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!bookingId) return;
    const interval = setInterval(() => loadMessages(bookingId), 5000);
    return () => clearInterval(interval);
  }, [bookingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages(id: string) {
    try {
      const res = await fetch(`/api/messages?booking_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {}
    setLoading(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !bookingId) return;

    setSending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, text: newMessage }),
    });

    if (res.ok) {
      setNewMessage("");
      await loadMessages(bookingId);
    }
    setSending(false);
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Link href="/auth/signin" className="text-primary-600 hover:underline">Sign in to view messages</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-6 sm:px-6" style={{ height: "calc(100vh - 80px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-warm-200 pb-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Messages</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4">
        {loading ? (
          <p className="text-center text-gray-400">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-400">No messages yet. Start the conversation!</p>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isMe = msg.sender_id === userId;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] ${isMe ? "order-2" : ""}`}>
                    {!isMe && (
                      <div className="mb-1 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600 overflow-hidden">
                          {msg.sender_avatar ? (
                            <img src={msg.sender_avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            msg.sender_name.charAt(0)
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{msg.sender_name}</span>
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        isMe
                          ? "bg-primary-600 text-white"
                          : "bg-warm-100 text-gray-900"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    <p className={`mt-1 text-xs ${isMe ? "text-right" : ""} text-gray-400`}>
                      {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-3 border-t border-warm-200 pt-4">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
