"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { trackSendMessage } from "@/lib/analytics";
import { useSwipeNavigation } from "@/lib/use-swipe";
import { convertHeicIfNeeded } from "@/lib/convert-heic";
import imageCompression from "browser-image-compression";
import { useWebSocket } from "@/hooks/useWebSocket";

// Render structured message payloads (BOOKING_CARD:, DELIVERY:) as readable
// previews in the sidebar instead of the raw JSON string.
function formatLastMessagePreview(text: string | null): string | null {
  if (!text) return null;
  if (text.startsWith("BOOKING_CARD:")) {
    try {
      const card = JSON.parse(text.slice("BOOKING_CARD:".length));
      const icon = card.is_custom ? "✨" : "📦";
      return `${icon} ${card.name} — €${Math.round(card.price)}`;
    } catch {
      return "📦 Package offer";
    }
  }
  if (text.startsWith("DELIVERY:")) {
    const parts = text.split(":");
    const count = parts[1];
    return `📸 Gallery delivered${count ? ` (${count} photos)` : ""}`;
  }
  if (text.startsWith("REVIEW_REQUEST:")) {
    return "⭐ How was your photoshoot?";
  }
  return text;
}

interface Conversation {
  booking_id: string;
  other_name: string;
  other_avatar: string | null;
  other_role: "client" | "photographer";
  other_slug: string | null;
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
  const { data: session, status: authStatus } = useSession();
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showPackagePicker, setShowPackagePicker] = useState(false);
  const [shareablePackages, setShareablePackages] = useState<{ id: string; name: string; price: number; duration_minutes: number; num_photos: number }[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  // Custom-proposal sub-flow inside the package picker. When the
  // photographer clicks "+ Create custom proposal" the picker swaps to a
  // mini form (name/price/duration/photos/description). On submit it hits
  // PUT /api/messages/share-package which both creates the package row
  // (private, custom_for_user_id=client) and shares the chat card in one
  // call. Sender flow stays single-pop-up; no extra dashboard step.
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customDuration, setCustomDuration] = useState("");
  const [customPhotos, setCustomPhotos] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customSaving, setCustomSaving] = useState(false);
  const [customError, setCustomError] = useState("");

  // Lightbox keyboard nav
  useEffect(() => {
    if (lightboxIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      const allMedia = messages.filter((m) => m.media_url && !m.id.startsWith("temp-") && !m.media_url!.endsWith('.pdf'));
      if (e.key === "Escape") setLightboxIndex(null);
      else if (e.key === "ArrowLeft" && lightboxIndex! > 0) setLightboxIndex(lightboxIndex! - 1);
      else if (e.key === "ArrowRight" && lightboxIndex! < allMedia.length - 1) setLightboxIndex(lightboxIndex! + 1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, messages]);

  useSwipeNavigation({
    enabled: lightboxIndex !== null,
    onPrev: () => {
      const allMedia = messages.filter((m) => m.media_url && !m.id.startsWith("temp-") && !m.media_url!.endsWith(".pdf"));
      if (lightboxIndex !== null && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
      void allMedia;
    },
    onNext: () => {
      const allMedia = messages.filter((m) => m.media_url && !m.id.startsWith("temp-") && !m.media_url!.endsWith(".pdf"));
      if (lightboxIndex !== null && lightboxIndex < allMedia.length - 1) setLightboxIndex(lightboxIndex + 1);
    },
    onDismiss: () => setLightboxIndex(null),
  });
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sseStatus, setSSEStatus] = useState<SSEStatus>("disconnected");

  const [wsToken, setWsToken] = useState<string | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<{ userId: string; userName: string }[]>([]);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef<number>(0);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const convoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lock outer page scroll on desktop while the messages page is
  // mounted. The chat container is already height-bound to the
  // viewport, so the body shouldn't need to scroll — but without
  // this, momentum scroll inside the message list can chain up to
  // the document. Mobile keeps body scroll because the sidebar/
  // chat each fill the viewport individually.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 639px)").matches) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  const isUserScrolledUp = useRef(false);

  const scrollToBottom = useCallback((force?: boolean) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    // Don't auto-scroll if user has scrolled up to read history, unless forced
    if (isUserScrolledUp.current && !force) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  // Track if user scrolled up
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isUserScrolledUp.current = distFromBottom > 100;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [activeChat]);

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

  // Fetch WS token on mount
  useEffect(() => {
    fetch("/api/auth/ws-token").then(r => r.json()).then(d => setWsToken(d.token)).catch(() => {});
  }, []);

  // --- Periodic conversation list refresh (every 30s) ---
  useEffect(() => {
    convoRefreshRef.current = setInterval(fetchConversations, 30000);
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
          return [...data, ...remainingKeep];
        });
        setConversations((prev) =>
          prev.map((c) =>
            c.booking_id === bookingId ? { ...c, unread_count: 0 } : c
          )
        );
      }
    } catch {
      // Will retry via WebSocket reconnection
    }
  }

  // --- WebSocket handlers ---
  const sendReadRef = useRef<() => void>(() => {});

  const handleWSMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      // For media messages from self: update temp in-place instead of remove+add to avoid flash
      if (msg.sender_id === userId && msg.media_url) {
        const tempIdx = prev.findIndex(m => m.id.startsWith("temp-") && m.sender_id === msg.sender_id && m.media_url);
        if (tempIdx >= 0) {
          const updated = [...prev];
          updated[tempIdx] = msg;
          return updated;
        }
      }
      // Dedup: remove temp messages that match the real message
      const filtered = prev.filter((m) => {
        if (m.id.startsWith("temp-")) {
          return !(msg.sender_id === m.sender_id && ((msg.text && m.text && msg.text === m.text) || (msg.media_url && m.media_url)));
        }
        return m.id !== msg.id;
      });
      return [...filtered, msg];
    });
    // Mark as read if message is from the other user and document is visible
    if (msg.sender_id !== userId && document.visibilityState === "visible") {
      sendReadRef.current();
    }
    // Force scroll for own messages, respect scroll for others
    if (msg.sender_id === userId) {
      isUserScrolledUp.current = false;
      setTimeout(() => scrollToBottom(true), 30);
    } else {
      setTimeout(() => scrollToBottom(), 30);
    }
    fetchConversations();
  }, [scrollToBottom, fetchConversations, userId]);

  const handleTyping = useCallback((typingUserId: string, userName: string) => {
    if (typingUserId === userId) return;
    setTypingUser(userName);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setTypingUser(null), 3000);
  }, [userId]);

  const handleRead = useCallback((readUserId: string, timestamp: string) => {
    setMessages(prev => prev.map(m =>
      m.sender_id !== readUserId && !m.read_at ? { ...m, read_at: timestamp } : m
    ));
  }, []);

  const { status: wsStatus, sendTyping, sendRead } = useWebSocket({
    bookingId: activeChat,
    token: wsToken,
    onMessage: handleWSMessage,
    onTyping: handleTyping,
    onRead: handleRead,
    onOnline: setOnlineUsers,
    onStatusChange: (s) => setSSEStatus(s === "connected" ? "connected" : s === "reconnecting" ? "reconnecting" : "disconnected"),
  });

  // Keep sendRead ref in sync to avoid circular dependency
  sendReadRef.current = sendRead;

  // --- When activeChat changes, fetch history ---
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      setSSEStatus("disconnected");
      return;
    }

    setLoadingMessages(true);
    isUserScrolledUp.current = false;
    fetchMessages(activeChat).then(() => {
      setLoadingMessages(false);
      // Multiple scroll attempts to catch images loading and layout shifts
      setTimeout(() => scrollToBottom(true), 50);
      setTimeout(() => scrollToBottom(true), 200);
      setTimeout(() => scrollToBottom(true), 500);
    });
  }, [activeChat, scrollToBottom]);

  useEffect(() => {
    if (activeChat && !loadingMessages) inputRef.current?.focus();
  }, [activeChat, loadingMessages]);

  // --- Upload & compress a single file ---
  async function uploadFile(file: File, bookingId: string): Promise<string | null> {
    let processedFile = file;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
    // Skip compression for PDFs and GIFs
    if (!isPdf && !isGif) {
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
    if (inputRef.current) inputRef.current.style.height = "auto";
    setPendingFiles([]);
    setPendingPreviews([]);
    isUserScrolledUp.current = false;
    setTimeout(() => scrollToBottom(true), 10);
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
        // Show contact info warning if returned by server
        if (res && res.ok) {
          try {
            const resData = await res.json();
            if (resData.warning) {
              setTimeout(() => {
                setMessages((prev) => [...prev, {
                  id: `warning-${Date.now()}`, text: resData.warning, media_url: null,
                  sender_id: "system", sender_name: "system", sender_avatar: null,
                  created_at: new Date().toISOString(), read_at: null, is_system: true,
                }]);
                setTimeout(() => scrollToBottom(true), 50);
              }, 500);
            }
          } catch {}
        }
      }

      setSending(false);
      // Don't fetchMessages — WebSocket will deliver the real message and dedup the temp
      if (res && !res.ok) {
        try {
          const errData = await res.json();
          if (errData.error === "social_platform_blocked") {
            // Remove temp message and show the warning instead
            setMessages((prev) => [
              ...prev.filter((m) => m.id !== textTempId),
              {
                id: `warning-${Date.now()}`, text: errData.warning, media_url: null,
                sender_id: "system", sender_name: "system", sender_avatar: null,
                created_at: new Date().toISOString(), read_at: null, is_system: true,
              },
            ]);
            setNewMessage(text);
            setTimeout(() => scrollToBottom(true), 50);
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.id === textTempId ? { ...m, failed: true } : m))
            );
          }
        } catch {
          setMessages((prev) =>
            prev.map((m) => (m.id === textTempId ? { ...m, failed: true } : m))
          );
        }
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

  async function openPackagePicker() {
    if (!activeChat) return;
    setLoadingPackages(true);
    setShowPackagePicker(true);
    try {
      const res = await fetch(`/api/messages/share-package?booking_id=${activeChat}`);
      if (res.ok) {
        setShareablePackages(await res.json());
      }
    } catch {}
    setLoadingPackages(false);
  }

  function resetCustomForm() {
    setCustomMode(false);
    setCustomName("");
    setCustomPrice("");
    setCustomDuration("");
    setCustomPhotos("");
    setCustomDescription("");
    setCustomError("");
    setCustomSaving(false);
  }

  async function submitCustomProposal() {
    if (!activeChat) return;
    setCustomError("");
    const name = customName.trim();
    const price = Number(customPrice);
    const duration = Number(customDuration);
    const photos = Number(customPhotos);
    if (name.length < 3) return setCustomError(t("customProposalNameTooShort"));
    if (!Number.isFinite(price) || price < 1) return setCustomError(t("customProposalPriceRequired"));
    if (!Number.isFinite(duration) || duration < 5) return setCustomError(t("customProposalDurationRequired"));
    if (!Number.isFinite(photos) || photos < 1) return setCustomError(t("customProposalPhotosRequired"));
    setCustomSaving(true);
    try {
      const res = await fetch("/api/messages/share-package", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: activeChat,
          name,
          price,
          duration_minutes: duration,
          num_photos: photos,
          description: customDescription.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCustomError(data.error || "Failed to send");
        setCustomSaving(false);
        return;
      }
      if (data?.message) {
        setMessages((prev) => prev.some((m) => m.id === data.message.id) ? prev : [...prev, {
          ...data.message,
          sender_name: session?.user?.name || "",
          sender_avatar: session?.user?.image || null,
        }]);
        setConversations((prev) => prev.map((c) =>
          c.booking_id === activeChat
            ? { ...c, last_message: data.message.text, last_message_at: data.message.created_at }
            : c
        ));
        setTimeout(() => scrollToBottom(true), 10);
      }
      resetCustomForm();
      setShowPackagePicker(false);
    } catch {
      setCustomError("Failed to send");
      setCustomSaving(false);
    }
  }

  async function sharePackage(packageId: string) {
    if (!activeChat) return;
    setShowPackagePicker(false);
    try {
      const res = await fetch("/api/messages/share-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: activeChat, package_id: packageId }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.message) {
          setMessages((prev) => prev.some((m) => m.id === data.message.id) ? prev : [...prev, {
            ...data.message,
            sender_name: session?.user?.name || "",
            sender_avatar: session?.user?.image || null,
          }]);
          setConversations((prev) => prev.map((c) =>
            c.booking_id === activeChat
              ? { ...c, last_message: data.message.text, last_message_at: data.message.created_at }
              : c
          ));
          setTimeout(() => scrollToBottom(true), 10);
        }
      }
    } catch {}
  }

  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > 30 * 1024 * 1024) { alert(`${files[i].name}: max 30MB`); continue; }
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

  if (authStatus === "loading")
    return (
      <div className="p-6 sm:p-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-warm-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-warm-100" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-warm-200 bg-white p-4">
              <div className="h-10 w-10 animate-pulse rounded-full bg-warm-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-warm-200" />
                <div className="h-3 w-48 animate-pulse rounded bg-warm-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );

  if (!session?.user)
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-warm-300 border-t-primary-600" />
      </div>
    );

  return (
    <>
      <style>{`footer { display: none !important; } @media(min-width:640px){ .chat-container { height: calc(100dvh - 200px) !important; } }`}</style>
    <div className="p-1 sm:p-3 overflow-hidden">
      <div
        className="flex gap-0 sm:rounded-xl sm:border sm:border-warm-200 bg-white overflow-hidden chat-container"
        style={{ height: "calc(100dvh - 120px)" }}
      >
        {/* Conversations sidebar */}
        <div
          className={`w-full shrink-0 border-r border-warm-100 sm:w-72 ${
            activeChat ? "hidden sm:block" : ""
          }`}
        >
          <div className="overflow-y-auto p-2 h-full" style={{ overscrollBehavior: "contain" }}>
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
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                    activeChat === convo.booking_id
                      ? "bg-primary-50"
                      : "hover:bg-warm-50"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar
                      src={convo.other_avatar}
                      fallback={convo.other_name}
                      size="md"
                    />
                    {convo.unread_count > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-primary-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`truncate text-sm ${
                          convo.unread_count > 0
                            ? "font-bold text-gray-900"
                            : "font-medium text-gray-700"
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
                    <p className={`mt-0.5 text-xs leading-4 line-clamp-2 ${convo.unread_count > 0 ? "text-gray-600" : "text-gray-400"}`}>
                      {formatLastMessagePreview(convo.last_message) || t("startConversation")}
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
                {activeConvo.other_slug ? (
                  <a href={`/photographers/${activeConvo.other_slug}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Avatar src={activeConvo.other_avatar} fallback={activeConvo.other_name} size="md" />
                  </a>
                ) : (
                  <Avatar src={activeConvo.other_avatar} fallback={activeConvo.other_name} size="md" />
                )}
                <div className="min-w-0">
                  {activeConvo.other_slug ? (
                    <a href={`/photographers/${activeConvo.other_slug}`} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-semibold text-gray-900 hover:text-primary-600 transition">
                      {activeConvo.other_name}
                    </a>
                  ) : (
                    <span className="text-sm font-semibold text-gray-900">{activeConvo.other_name}</span>
                  )}
                  <p className="text-[11px] text-gray-400 capitalize">{activeConvo.other_role}</p>
                </div>
                {/* Connection & online status indicator */}
                <div className="ml-auto flex items-center gap-1.5">
                  {onlineUsers.some(u => u.userId !== userId) && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-[11px] text-green-600 hidden sm:inline">{t("online")}</span>
                    </span>
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
                style={{ overscrollBehavior: "contain" }}
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
                        // Delivery card
                        if (msg.text?.startsWith("DELIVERY:")) {
                          const parts = msg.text!.split(":");
                          const photoCount = parts[1];
                          const url = parts.slice(2, -1).join(":");
                          const pw = parts[parts.length - 1];
                          return (
                            <div key={msg.id} className="flex justify-center my-3">
                              <div className="max-w-[90%] sm:max-w-[70%] rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-5 text-center shadow-sm">
                                <div className="text-3xl">📸</div>
                                <p className="mt-2 text-base font-bold text-gray-900">{t("photoPreviewsReady", { count: photoCount })}</p>
                                <p className="mt-1 text-xs text-gray-500">{t("deliveryReviewHint")}</p>
                                <a href={`${url}?pw=${encodeURIComponent(pw)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block rounded-xl bg-accent-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-accent-700 transition">
                                  {t("viewGallery")}
                                </a>
                              </div>
                            </div>
                          );
                        }
                        // Package card shared by photographer
                        if (msg.text?.startsWith("BOOKING_CARD:")) {
                          try {
                            const card = JSON.parse(msg.text.slice("BOOKING_CARD:".length));
                            const durationLabel = card.duration_minutes >= 60 ? `${card.duration_minutes / 60}h` : `${card.duration_minutes} min`;
                            // is_custom payload signals a one-off proposal
                            // (photographer created it on the fly for this
                            // client). Card gets an amber "Custom" badge so
                            // both sides know it's not a public package.
                            const isCustom = !!card.is_custom;
                            return (
                              <div key={msg.id} className="flex justify-center my-3">
                                <div className={`max-w-[90%] sm:max-w-[70%] rounded-2xl border p-5 shadow-sm ${
                                  isCustom
                                    ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white"
                                    : "border-primary-200 bg-gradient-to-br from-primary-50 to-white"
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <p className={`text-xs font-medium uppercase tracking-wide ${isCustom ? "text-amber-700" : "text-primary-500"}`}>
                                      {isCustom ? t("customProposalBadge") : t("packageLabel")}
                                    </p>
                                    {isCustom && (
                                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                        ✨
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-base font-bold text-gray-900">{card.name}</p>
                                  {isCustom && card.description && (
                                    <p className="mt-1 text-xs text-gray-500 italic">&ldquo;{card.description}&rdquo;</p>
                                  )}
                                  <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
                                    <span>{durationLabel}</span>
                                    <span className="text-gray-300">&middot;</span>
                                    <span>{card.num_photos} photos</span>
                                  </div>
                                  <p className="mt-2 text-xl font-bold text-gray-900">&euro;{Math.round(card.price)}</p>
                                  {card.slug && activeConvo?.other_role === "photographer" && (
                                    <a href={`/book/${card.slug}?package=${card.package_id}`}
                                      className={`mt-3 inline-block rounded-xl px-6 py-2.5 text-sm font-bold text-white transition ${
                                        isCustom ? "bg-amber-600 hover:bg-amber-700" : "bg-primary-600 hover:bg-primary-700"
                                      }`}>
                                      {t("bookNow")}
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          } catch {
                            // fall through to default system message
                          }
                        }
                        // Kate's review-request card. Payload format:
                        //   REVIEW_REQUEST:<bookingId>[:<urlEncodedFirstName>]
                        // Photographer-side gets an info-only version so they
                        // don't think Kate is asking THEM for a review.
                        if (msg.text?.startsWith("REVIEW_REQUEST:")) {
                          const payload = msg.text.slice("REVIEW_REQUEST:".length).trim();
                          const [reviewBookingId, encodedName] = payload.split(":");
                          const firstName = encodedName ? (() => { try { return decodeURIComponent(encodedName); } catch { return ""; } })() : "";
                          // viewer is photographer when the OTHER side of the convo is the client
                          const viewerIsPhotographer = activeConvo?.other_role === "client";
                          if (viewerIsPhotographer) {
                            return (
                              <div key={msg.id} className="flex justify-center my-3">
                                <div className="max-w-[90%] sm:max-w-[70%] rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
                                  <div className="flex items-center gap-3">
                                    <Avatar src={msg.sender_avatar} alt={msg.sender_name || "Kate"} fallback={msg.sender_name || "K"} size="sm" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-gray-900">{msg.sender_name || "Kate Belova"}</p>
                                      <p className="text-xs text-gray-500">{t("founderRole") || "Founder of Photo Portugal"}</p>
                                    </div>
                                  </div>
                                  <p className="mt-2 text-xs text-gray-600">{firstName
                                    ? (t("reviewRequestPhotographerWithName", { name: firstName }) || `⭐ Kate asked ${firstName} to leave a review. They'll get 10% off their next booking as a thank-you.`)
                                    : (t("reviewRequestPhotographer") || "⭐ Kate asked your client to leave a review. They'll get 10% off their next booking as a thank-you.")}</p>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={msg.id} className="flex justify-center my-3">
                              <div className="max-w-[90%] sm:max-w-[70%] rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-white p-5 shadow-sm">
                                <div className="flex items-start gap-3">
                                  <Avatar src={msg.sender_avatar} alt={msg.sender_name || "Kate"} fallback={msg.sender_name || "K"} size="md" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900">{msg.sender_name || "Kate Belova"}</p>
                                    <p className="text-xs text-gray-500">{t("founderRole") || "Founder of Photo Portugal"}</p>
                                  </div>
                                </div>
                                <p className="mt-3 text-sm text-gray-700">{firstName
                                  ? (t("reviewRequestTextWithName", { name: firstName }) || `Hi ${firstName}, hope you loved your shoot! A quick review means the world to us — and as a thank-you, we'll send you a 10% off code for your next session.`)
                                  : (t("reviewRequestText") || "Hope you loved your shoot! A quick review means the world to us — and as a thank-you, we'll send you a 10% off code for your next session.")}</p>
                                <a
                                  href={`/dashboard/bookings?review=${encodeURIComponent(reviewBookingId)}`}
                                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-gray-900 transition hover:bg-yellow-500"
                                >
                                  ⭐ {t("leaveReviewCta") || "Leave a review"}
                                </a>
                              </div>
                            </div>
                          );
                        }
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
                              className={`inline-block rounded-2xl text-[15px] leading-relaxed ${
                                msg.media_url && !msg.text
                                  ? "p-1"
                                  : `px-3.5 py-2 ${isMe
                                    ? msg.failed
                                      ? "bg-red-100 text-red-800"
                                      : "bg-primary-600 text-white"
                                    : "bg-warm-100 text-gray-900"
                                  }`
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
                              {msg.media_url && (() => {
                                // PDF files: show icon + link
                                if (msg.media_url!.endsWith('.pdf')) {
                                  return (
                                    <a href={msg.media_url!} target="_blank" rel="noopener noreferrer"
                                      className="flex flex-col items-center rounded-xl bg-white border border-gray-200 p-4 hover:shadow-md transition" style={{ width: 140 }}>
                                      <div className="flex h-20 w-16 items-center justify-center rounded-lg bg-red-50 border border-red-100 mb-2">
                                        <svg className="h-10 w-8 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM9 13h2v2H9v-2zm4 0h2v2h-2v-2z"/></svg>
                                      </div>
                                      <p className="text-[11px] font-medium text-gray-700 text-center">PDF</p>
                                      <p className="text-[10px] text-gray-400 mt-0.5">{t("tapToOpen")}</p>
                                    </a>
                                  );
                                }
                                const allMedia = messages.filter((m) => m.media_url && !m.id.startsWith("temp-") && !m.media_url!.endsWith('.pdf'));
                                const mediaIndex = allMedia.findIndex((m) => m.id === msg.id);
                                return (
                                <div className="relative inline-block">
                                  <button
                                    type="button"
                                    onClick={() => { if (!msg.id.startsWith("temp-") && mediaIndex >= 0) setLightboxIndex(mediaIndex); }}
                                    className="block relative cursor-pointer"
                                  >
                                    <div className="rounded-lg bg-warm-200 animate-pulse" style={{ width: 200, height: 150 }} />
                                    <img
                                      src={msg.media_url!}
                                      alt={t("sharedPhoto")}
                                      style={{ maxWidth: 240, maxHeight: 300 }}
                                      className="rounded-lg object-cover absolute inset-0"
                                      onLoad={(e) => {
                                        const img = e.currentTarget;
                                        const placeholder = img.previousElementSibling as HTMLElement;
                                        if (placeholder) placeholder.style.display = "none";
                                        img.style.position = "relative";
                                      }}
                                    />
                                  </button>
                                  {uploadingMsgIds.has(msg.id) && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30">
                                      <div className="h-8 w-8 animate-spin rounded-full border-3 border-white/30 border-t-white" />
                                    </div>
                                  )}
                                </div>
                                );
                              })()}
                              {msg.text && (
                                <p className="whitespace-pre-wrap break-words">
                                  {msg.text.split(/(https?:\/\/[^\s]+)/g).map((part, pi) =>
                                    /^https?:\/\//.test(part) ? (
                                      <a key={pi} href={part} target="_blank" rel="noopener noreferrer"
                                        className={`underline break-all ${isMe ? "text-white/90 hover:text-white" : "text-primary-600 hover:text-primary-700"}`}
                                      >{part.replace(/^https?:\/\//, "").slice(0, 50)}{part.replace(/^https?:\/\//, "").length > 50 ? "…" : ""}</a>
                                    ) : part
                                  )}
                                </p>
                              )}
                            </div>
                            {/* Failed send indicator with retry */}
                            {msg.failed && (
                              <div className="mt-0.5 flex items-center justify-end gap-1.5">
                                <span className="text-[11px] text-red-500">
                                  {t("failedToSend")}
                                </span>
                                <button
                                  onClick={() => handleRetry(msg)}
                                  className="text-[11px] font-medium text-red-600 underline hover:text-red-700"
                                >
                                  {t("retry")}
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
                                {isMe && msg.read_at && (
                                  <span className="ml-1.5 font-medium text-green-500">read</span>
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

              {/* Typing indicator */}
              {typingUser && (
                <div className="px-4 pb-1">
                  <span className="text-xs text-gray-400 italic">{typingUser} is typing...</span>
                </div>
              )}

              {/* Input */}
              {/* Pending media preview */}
              {pendingPreviews.length > 0 && (
                <div className="flex items-center gap-2 border-t border-warm-100 bg-warm-50 px-3 py-2 overflow-x-auto">
                  {pendingPreviews.map((preview, i) => (
                    <div key={i} className="relative shrink-0">
                      {pendingFiles[i]?.type === "application/pdf" || pendingFiles[i]?.name?.toLowerCase().endsWith(".pdf") ? (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-warm-200 text-2xl" role="img" aria-label={t("pdfLabel")}>&#x1F4C4;</div>
                      ) : (
                        <img src={preview} alt={t("pendingPhotoAttachment")} aria-hidden="true" className="h-14 w-14 rounded-lg object-cover" />
                      )}
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
                <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,.pdf,.gif" multiple className="hidden" onChange={handleMediaSelect} />
                <div className="group relative">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-warm-100 hover:text-gray-600 disabled:opacity-30 sm:h-8 sm:w-8"
                  >
                    {uploadingMedia ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" /></svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    )}
                  </button>
                  <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {t("sendPhoto")}
                  </span>
                </div>
                {activeConvo?.other_role === "client" && (
                  <div className="group/pkg relative">
                    <button
                      type="button"
                      onClick={openPackagePicker}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-warm-100 hover:text-gray-600 sm:h-8 sm:w-8"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
                    </button>
                    {!showPackagePicker && (
                      <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/pkg:opacity-100">
                        {t("sharePackage")}
                      </span>
                    )}
                    {showPackagePicker && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => { setShowPackagePicker(false); resetCustomForm(); }} />
                        <div className="absolute bottom-12 left-0 z-50 w-80 rounded-xl border border-warm-200 bg-white shadow-xl">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-100">
                            <p className="text-sm font-semibold text-gray-900">
                              {customMode ? t("customProposalTitle") : t("shareAPackage")}
                            </p>
                            {customMode && (
                              <button
                                type="button"
                                onClick={() => resetCustomForm()}
                                className="text-xs font-medium text-gray-500 hover:text-gray-700"
                              >
                                {t("customProposalBack")}
                              </button>
                            )}
                          </div>

                          {/* Custom-proposal mini form. Photographer picks
                              "+ Create custom proposal" → swaps to this
                              view → fills 4 required fields + optional
                              description → submit shares the card in one
                              shot via PUT /api/messages/share-package. */}
                          {customMode ? (
                            <div className="px-4 py-3 space-y-2">
                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t("customProposalName")}</label>
                                <input
                                  type="text"
                                  value={customName}
                                  onChange={(e) => setCustomName(e.target.value)}
                                  maxLength={80}
                                  placeholder={t("customProposalNamePlaceholder")}
                                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                  autoFocus
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">€</label>
                                  <input
                                    type="number" min={1} max={99999}
                                    value={customPrice}
                                    onChange={(e) => setCustomPrice(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t("customProposalMin")}</label>
                                  <div className="relative mt-1">
                                    <input
                                      type="number" min={5} max={1440} step={5}
                                      value={customDuration}
                                      onChange={(e) => setCustomDuration(e.target.value)}
                                      className="w-full rounded-lg border border-gray-300 bg-white pl-2 pr-9 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                    />
                                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">{t("customProposalMinHint")}</span>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t("customProposalPhotos")}</label>
                                  <input
                                    type="number" min={1} max={9999}
                                    value={customPhotos}
                                    onChange={(e) => setCustomPhotos(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t("customProposalDescription")}</label>
                                <textarea
                                  value={customDescription}
                                  onChange={(e) => setCustomDescription(e.target.value)}
                                  maxLength={500}
                                  rows={2}
                                  placeholder={t("customProposalDescriptionPlaceholder")}
                                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                />
                              </div>
                              {customError && (
                                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{customError}</p>
                              )}
                              <button
                                type="button"
                                onClick={submitCustomProposal}
                                disabled={customSaving}
                                className="mt-1 w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                              >
                                {customSaving ? t("customProposalSending") : t("customProposalSend")}
                              </button>
                            </div>
                          ) : (
                            <div className="max-h-72 overflow-y-auto py-1">
                              {/* "+ Create custom proposal" sits FIRST so
                                  it's the natural top option when the
                                  photographer wants something off-catalog. */}
                              <button
                                type="button"
                                onClick={() => setCustomMode(true)}
                                className="w-full px-4 py-2.5 text-left hover:bg-primary-50 transition flex items-center gap-2 border-b border-warm-100"
                              >
                                <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                <div>
                                  <p className="text-sm font-semibold text-primary-700">{t("customProposalCreate")}</p>
                                  <p className="text-xs text-gray-400">{t("customProposalSubtitle")}</p>
                                </div>
                              </button>

                              {loadingPackages ? (
                                <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" /></div>
                              ) : shareablePackages.length === 0 ? (
                                <p className="px-4 py-4 text-sm text-gray-400 text-center">{t("noPackagesYet")}</p>
                              ) : (
                                shareablePackages.map((pkg) => (
                                  <button key={pkg.id} type="button" onClick={() => sharePackage(pkg.id)}
                                    className="w-full px-4 py-2.5 text-left hover:bg-warm-50 transition flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">{pkg.name}</p>
                                      <p className="text-xs text-gray-400">{pkg.duration_minutes >= 60 ? `${pkg.duration_minutes / 60}h` : `${pkg.duration_minutes} min`} &middot; {pkg.num_photos} photos</p>
                                    </div>
                                    <span className="text-sm font-bold text-gray-700">&euro;{Math.round(pkg.price)}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    // Auto-resize textarea
                    const el = e.target;
                    el.style.height = "auto";
                    el.style.height = Math.min(el.scrollHeight, 120) + "px";
                    // Debounced typing indicator (max once per 2s)
                    const now = Date.now();
                    if (now - lastTypingSent.current > 2000) {
                      sendTyping();
                      lastTypingSent.current = now;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      (e.target as HTMLTextAreaElement).form?.requestSubmit();
                    }
                  }}
                  placeholder={t("typePlaceholder")}
                  className="flex-1 resize-none rounded-2xl border border-warm-200 bg-warm-50 px-4 py-2 text-base outline-none focus:border-primary-300 focus:bg-white"
                  style={{ maxHeight: 120 }}
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
              <p className="hidden sm:block mt-1 text-[11px] text-gray-300 text-right pr-12">Enter — send · Shift+Enter — new line</p>
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

      {/* Lightbox */}
      {lightboxIndex !== null && (() => {
        const allMedia = messages.filter((m) => m.media_url && !m.id.startsWith("temp-") && !m.media_url!.endsWith('.pdf'));
        const current = allMedia[lightboxIndex];
        if (!current) return null;
        const total = allMedia.length;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
              {lightboxIndex + 1} / {total}
            </div>

            {/* Prev */}
            {lightboxIndex > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Next */}
            {lightboxIndex < total - 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Image */}
            <img
              src={current.media_url!}
              alt="Shared photo in conversation"
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        );
      })()}
    </div>
    </>
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
  const dateLocale = ({pt:"pt-PT",de:"de-DE",es:"es-ES",fr:"fr-FR",en:"en-US"} as Record<string,string>)[locale] || "en-US";
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
