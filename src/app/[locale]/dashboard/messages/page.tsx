"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { trackSendMessage } from "@/lib/analytics";
import { convertHeicIfNeeded } from "@/lib/convert-heic";
import imageCompression from "browser-image-compression";

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
  text: string | null;
  media_url: string | null;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  created_at: string;
  read_at: string | null;
  failed?: boolean;
  is_system?: boolean;
}

type SSEStatus = "connected" | "reconnecting" | "disconnected";

function MessagesContent() {
  const { data: session } = useSession();
  const t = useTranslations("messages");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const initialChat = searchParams.get("chat");
  const userId = (session?.user as { id?: string })?.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChatRaw] = useState<string | null>(initialChat);
  function setActiveChat(chatId: string | null) {
    setActiveChatRaw(chatId);
    const url = chatId ? `?chat=${chatId}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingMsgIds, setUploadingMsgIds] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sseStatus, setSSEStatus] = useState<SSEStatus>("disconnected");

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // --- Fetch conversations ---
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/conversations");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setConversations(data);
      }
    } catch {
      // Silent fail for background refresh
    }
  }, []);

  useEffect(() => {
    fetchConversations().then(() => setLoadingConvos(false));
  }, [fetchConversations]);

  // --- Periodic conversation list refresh (every 10s) ---
  useEffect(() => {
    convoRefreshRef.current = setInterval(fetchConversations, 10000);
    return () => {
      if (convoRefreshRef.current) clearInterval(convoRefreshRef.current);
    };
  }, [fetchConversations]);

  // --- Fetch full message history for a chat ---
  async function fetchMessages(bookingId: string) {
    try {
      const res = await fetch(`/api/messages?booking_id=${bookingId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          // Preserve temp messages (not yet sent to server) and failed messages
          const keepMsgs = prev.filter((m) => m.id.startsWith("temp-") || m.failed);
          const newIds = new Set(data.map((m: Message) => m.id));
          const remainingKeep = keepMsgs.filter((m) => !newIds.has(m.id));
          if (
            remainingKeep.length === 0 &&
            JSON.stringify(prev.filter((m) => !m.id.startsWith("temp-") && !m.failed).map((m) => m.id)) ===
              JSON.stringify(data.map((m: Message) => m.id))
          ) {
            return prev;
          }
          setTimeout(scrollToBottom, 30);
          return [...data, ...remainingKeep];
        });
        setConversations((prev) =>
          prev.map((c) =>
            c.booking_id === bookingId ? { ...c, unread_count: 0 } : c
          )
        );
      }
    } catch {
      // Will retry via SSE reconnection
    }
  }

  // --- SSE connection management ---
  const closeSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connectSSE = useCallback(
    (chatId: string) => {
      closeSSE();

      const es = new EventSource(
        `/api/messages/stream?booking_id=${chatId}`
      );
      eventSourceRef.current = es;

      es.onopen = () => {
        setSSEStatus("connected");
      };

      es.onmessage = (event) => {
        try {
          const newMessages: Message[] = JSON.parse(event.data);
          if (newMessages.length > 0) {
            setMessages((prev) => {
              // Remove temp messages (optimistic) and deduplicate
              const realIds = new Set(newMessages.map((m) => m.id));
              const filtered = prev.filter((m) => {
                if (m.id.startsWith("temp-")) {
                  // Remove temp if a real message from same sender arrived
                  return !newMessages.some((n) => n.sender_id === m.sender_id);
                }
                return !realIds.has(m.id);
              });
              setTimeout(scrollToBottom, 30);
              return [...filtered, ...newMessages];
            });
            fetchConversations();
          }
        } catch {
          // Malformed SSE data — ignore
        }
      };

      es.onerror = () => {
        setSSEStatus("reconnecting");
        es.close();
        eventSourceRef.current = null;

        // Auto-reconnect after 3 seconds
        reconnectTimerRef.current = setTimeout(() => {
          connectSSE(chatId);
        }, 3000);
      };
    },
    [closeSSE, scrollToBottom, fetchConversations]
  );

  // --- When activeChat changes, open SSE and fetch history ---
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      closeSSE();
      setSSEStatus("disconnected");
      return;
    }

    setLoadingMessages(true);
    fetchMessages(activeChat).then(() => {
      setLoadingMessages(false);
      setTimeout(scrollToBottom, 50);
    });

    connectSSE(activeChat);

    return () => {
      closeSSE();
      setSSEStatus("disconnected");
    };
  }, [activeChat, scrollToBottom, connectSSE, closeSSE]);

  useEffect(() => {
    if (activeChat && !loadingMessages) inputRef.current?.focus();
  }, [activeChat, loadingMessages]);

  // --- Upload & compress a single file ---
  async function uploadFile(file: File, bookingId: string): Promise<string | null> {
    let processedFile = file;
    try { processedFile = await convertHeicIfNeeded(processedFile); } catch { /* use original */ }
    if (processedFile.size > 500 * 1024) {
      try {
        processedFile = await imageCompression(processedFile, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: false,
        });
      } catch { /* use uncompressed */ }
    }
    const formData = new FormData();
    formData.append("file", processedFile);
    formData.append("booking_id", bookingId);
    const res = await fetch("/api/messages/upload", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      return data.url;
    }
    return null;
  }

  // --- Send message ---
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = newMessage.trim();
    const hasMedia = pendingFiles.length > 0;
    if (!activeChat || (!text && !hasMedia)) return;

    // Create temp messages — images first, then text
    const filesToSend = [...pendingFiles];
    const previewsToRevoke = [...pendingPreviews];
    const tempIds: string[] = [];
    const tempMsgs: Message[] = [];

    // Image temp messages
    for (let i = 0; i < filesToSend.length; i++) {
      const tid = `temp-${Date.now()}-img-${i}`;
      tempIds.push(tid);
      tempMsgs.push({
        id: tid, text: null, media_url: previewsToRevoke[i],
        sender_id: userId || "", sender_name: session?.user?.name || "",
        sender_avatar: session?.user?.image || null,
        created_at: new Date().toISOString(), read_at: null,
      });
    }

    // Text temp message (after images)
    const textTempId = `temp-${Date.now()}-text`;
    if (text) {
      tempMsgs.push({
        id: textTempId, text, media_url: null,
        sender_id: userId || "", sender_name: session?.user?.name || "",
        sender_avatar: session?.user?.image || null,
        created_at: new Date().toISOString(), read_at: null,
      });
    }

    setMessages((prev) => [...prev, ...tempMsgs]);
    setNewMessage("");
    setPendingFiles([]);
    setPendingPreviews([]);
    setTimeout(scrollToBottom, 10);
    if (messages.length === 0) trackSendMessage(activeChat);

    setSending(true);
    try {
      // Upload all images first
      if (filesToSend.length > 0) {
        setUploadingMedia(true);
        setUploadingMsgIds(new Set(tempIds));
        for (let i = 0; i < filesToSend.length; i++) {
          const mediaUrl = await uploadFile(filesToSend[i], activeChat);
          if (mediaUrl) {
            await fetch("/api/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ booking_id: activeChat, media_url: mediaUrl }),
            });
          }
          setUploadingMsgIds((prev) => { const next = new Set(prev); next.delete(tempIds[i]); return next; });
        }
        setUploadingMedia(false);
        setUploadingMsgIds(new Set());
        previewsToRevoke.forEach((p) => URL.revokeObjectURL(p));
      }

      // Then send text message
      let res: Response | null = null;
      if (text) {
        res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking_id: activeChat, text }),
        });
      }

      setSending(false);
      await fetchMessages(activeChat);
      if (res && !res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === textTempId ? { ...m, failed: true } : m))
        );
      }
    } catch {
      setSending(false);
      setUploadingMedia(false);
      setUploadingMsgIds(new Set());
      setMessages((prev) =>
        prev.map((m) => (tempIds.includes(m.id) || m.id === textTempId ? { ...m, failed: true } : m))
      );
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.booking_id === activeChat
          ? { ...c, last_message: text || "📷 Photo", last_message_at: new Date().toISOString() }
          : c
      )
    );
    inputRef.current?.focus();
  }

  // --- Retry a failed message ---
  async function handleRetry(failedMsg: Message) {
    if (!activeChat) return;

    // Remove the failed flag while retrying
    setMessages((prev) =>
      prev.map((m) =>
        m.id === failedMsg.id ? { ...m, failed: false } : m
      )
    );

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: activeChat, text: failedMsg.text }),
      });
      if (res.ok) {
        await fetchMessages(activeChat);
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === failedMsg.id ? { ...m, failed: true } : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id ? { ...m, failed: true } : m
        )
      );
    }
  }

  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > 10 * 1024 * 1024) { alert(`${files[i].name}: max 10MB`); continue; }
      newFiles.push(files[i]);
      newPreviews.push(URL.createObjectURL(files[i]));
    }
    setPendingFiles((prev) => [...prev, ...newFiles]);
    setPendingPreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = "";
    inputRef.current?.focus();
  }

  function clearPendingMedia() {
    pendingPreviews.forEach((p) => URL.revokeObjectURL(p));
    setPendingFiles([]);
    setPendingPreviews([]);
  }

  function removePendingFile(index: number) {
    URL.revokeObjectURL(pendingPreviews[index]);
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  const activeConvo = conversations.find((c) => c.booking_id === activeChat);

  if (!session?.user)
    return (
      <div className="flex h-96 items-center justify-center">
        <Link href="/auth/signin" className="text-primary-600">
          {t("signInPrompt")}
        </Link>
      </div>
    );

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">
        {t("title")}
      </h1>
      <p className="mt-1 text-gray-500">
        {userId ? t("chatWithContacts") : t("chatWithPhotographers")}
      </p>

      <div
        className="mt-6 flex gap-4 rounded-xl border border-warm-200 bg-white"
        style={{ height: "min(700px, calc(100vh - 260px))" }}
      >
        {/* Conversations sidebar */}
        <div
          className={`w-full shrink-0 border-r border-warm-100 sm:w-64 ${
            activeChat ? "hidden sm:block" : ""
          }`}
        >
          <div
            className="overflow-y-auto p-2"
            style={{ height: "min(520px, calc(100vh - 220px))" }}
          >
            {loadingConvos ? (
              <div className="space-y-3 p-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-warm-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-16 animate-pulse rounded bg-warm-200" />
                      <div className="h-2.5 w-24 animate-pulse rounded bg-warm-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-gray-400">
                {t("noConversations")}
              </div>
            ) : (
              conversations.map((convo) => (
                <button
                  key={convo.booking_id}
                  onClick={() => setActiveChat(convo.booking_id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                    activeChat === convo.booking_id
                      ? "bg-primary-50"
                      : "hover:bg-warm-50"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar
                      src={convo.other_avatar}
                      fallback={convo.other_name}
                      size="sm"
                    />
                    {convo.unread_count > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-primary-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`truncate text-sm ${
                          convo.unread_count > 0
                            ? "font-semibold text-gray-900"
                            : "text-gray-700"
                        }`}
                      >
                        {convo.other_name}
                      </span>
                      {convo.last_message_at && (
                        <span className="ml-1 shrink-0 text-[10px] text-gray-400">
                          {formatTime(
                            convo.last_message_at,
                            locale,
                            t("yesterday")
                          )}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-400">
                      {convo.last_message || t("startConversation")}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat */}
        <div
          className={`flex flex-1 flex-col ${
            !activeChat ? "hidden sm:flex" : "flex"
          }`}
        >
          {activeChat && activeConvo ? (
            <>
              {/* Header with connection status */}
              <div className="flex items-center gap-2.5 border-b border-warm-100 px-4 py-3">
                <button
                  onClick={() => setActiveChat(null)}
                  className="text-gray-400 hover:text-gray-600 sm:hidden"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <Avatar
                  src={activeConvo.other_avatar}
                  fallback={activeConvo.other_name}
                  size="sm"
                />
                <span className="text-sm font-semibold text-gray-900">
                  {activeConvo.other_name}
                </span>
                {/* Connection status indicator */}
                <div className="ml-auto flex items-center gap-1.5">
                  {sseStatus === "connected" && (
                    <span
                      className="h-2 w-2 rounded-full bg-green-500"
                      title="Connected"
                    />
                  )}
                  {sseStatus === "reconnecting" && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
                      <span className="text-[10px] text-yellow-600">
                        Reconnecting...
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 py-3"
              >
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-gray-400">
                      {t("loadingMessages")}
                    </p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-gray-400">
                      {t("noMessages")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {messages.map((msg, i) => {
                      const isMe = msg.sender_id === userId;
                      const isLast =
                        i === messages.length - 1 ||
                        messages[i + 1]?.sender_id !== msg.sender_id;

                      // System messages — centered, different style
                      if (msg.is_system) {
                        return (
                          <div key={msg.id} className="flex justify-center my-3">
                            <div className="max-w-[85%] rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-center text-xs text-green-800 whitespace-pre-line">
                              {msg.text}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${
                            isMe ? "justify-end" : "justify-start"
                          } ${isLast ? "mb-2" : ""}`}
                        >
                          <div className="max-w-[70%]">
                            <div
                              className={`inline-block rounded-2xl px-3 py-1.5 text-sm ${
                                isMe
                                  ? msg.failed
                                    ? "bg-red-100 text-red-800"
                                    : "bg-primary-600 text-white"
                                  : "bg-warm-100 text-gray-900"
                              } ${
                                isMe
                                  ? isLast
                                    ? "rounded-br-sm"
                                    : ""
                                  : isLast
                                    ? "rounded-bl-sm"
                                    : ""
                              }`}
                            >
                              {msg.media_url && (
                                <div className="relative inline-block">
                                  <a href={msg.id.startsWith("temp-") ? undefined : msg.media_url} target="_blank" rel="noopener noreferrer" className="block relative">
                                    <div className="rounded-lg bg-warm-200 animate-pulse" style={{ width: 200, height: 150 }} />
                                    <img
                                      src={msg.media_url}
                                      alt="Shared photo"
                                      style={{ maxWidth: 240, maxHeight: 300 }}
                                      className="rounded-lg object-cover absolute inset-0"
                                      onLoad={(e) => {
                                        const img = e.currentTarget;
                                        const placeholder = img.previousElementSibling as HTMLElement;
                                        if (placeholder) placeholder.style.display = "none";
                                        img.style.position = "relative";
                                      }}
                                    />
                                  </a>
                                  {uploadingMsgIds.has(msg.id) && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30">
                                      <div className="h-8 w-8 animate-spin rounded-full border-3 border-white/30 border-t-white" />
                                    </div>
                                  )}
                                </div>
                              )}
                              {msg.text && (
                                <p className="whitespace-pre-wrap break-words">
                                  {msg.text}
                                </p>
                              )}
                            </div>
                            {/* Failed send indicator with retry */}
                            {msg.failed && (
                              <div className="mt-0.5 flex items-center justify-end gap-1.5">
                                <span className="text-[11px] text-red-500">
                                  Failed to send
                                </span>
                                <button
                                  onClick={() => handleRetry(msg)}
                                  className="text-[11px] font-medium text-red-600 underline hover:text-red-700"
                                >
                                  Retry
                                </button>
                              </div>
                            )}
                            {isLast && !msg.failed && (
                              <p
                                className={`mt-0.5 text-[10px] text-gray-400 ${
                                  isMe ? "text-right" : ""
                                }`}
                              >
                                {formatTime(
                                  msg.created_at,
                                  locale,
                                  t("yesterday")
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Input */}
              {/* Pending media preview */}
              {pendingPreviews.length > 0 && (
                <div className="flex items-center gap-2 border-t border-warm-100 bg-warm-50 px-3 py-2 overflow-x-auto">
                  {pendingPreviews.map((preview, i) => (
                    <div key={i} className="relative shrink-0">
                      <img src={preview} alt="" className="h-14 w-14 rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => removePendingFile(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white text-xs hover:bg-gray-900"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <span className="text-xs text-gray-400 shrink-0">{pendingFiles.length} {pendingFiles.length === 1 ? "photo" : "photos"}</span>
                </div>
              )}
              <form
                onSubmit={handleSend}
                className="flex items-center gap-2 border-t border-warm-100 px-3 py-2.5"
              >
                <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={handleMediaSelect} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingMedia}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-warm-100 hover:text-gray-600 disabled:opacity-30 sm:h-8 sm:w-8"
                  title="Send photo"
                >
                  {uploadingMedia ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  )}
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t("typePlaceholder")}
                  className="flex-1 rounded-full border border-warm-200 bg-warm-50 px-4 py-2 text-sm outline-none focus:border-primary-300 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={sending || uploadingMedia || (!newMessage.trim() && pendingFiles.length === 0)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white disabled:opacity-30 sm:h-8 sm:w-8"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 12h14M12 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-gray-400">
                {t("selectConversation")}
              </p>
            </div>
          )}
        </div>
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

function formatTime(
  dateStr: string,
  locale: string,
  yesterdayLabel: string
): string {
  const dateLocale = locale === "pt" ? "pt-PT" : "en-US";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0)
    return date.toLocaleTimeString(dateLocale, {
      hour: "numeric",
      minute: "2-digit",
    });
  if (days === 1) return yesterdayLabel;
  if (days < 7)
    return date.toLocaleDateString(dateLocale, { weekday: "short" });
  return date.toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
  });
}
