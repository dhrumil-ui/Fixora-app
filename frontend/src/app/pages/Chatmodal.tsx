import { useEffect, useRef, useState } from "react";
import { X, Send } from "lucide-react";
import { useSocket } from "../hooks/useSocket";
import { EVENTS } from "../lib/socketEvents";
import { useAuthStore } from "../auth.store";

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  "http://localhost:5001";

type Message = {
  _id: string;
  booking_id: string;
  sender_id: { _id: string; full_name?: string; role?: string } | string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  createdAt: string;
};

type Props = {
  open: boolean;
  bookingId: string | null;
  peerName: string; // "Sarah (Customer)" or "John (Plumber)"
  onClose: () => void;
};

export default function ChatModal({
  open,
  bookingId,
  peerName,
  onClose,
}: Props) {
  const me = useAuthStore((s) => s.me);
  const myId = me?._id;

  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingEmit = useRef<number>(0);

  // ── Load history on open ──
  useEffect(() => {
    if (!open || !bookingId) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/messages/${bookingId}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load");
        if (cancelled) return;
        setMessages(data.messages || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, bookingId]);

  // ── Mark all as read when modal opens / new message arrives while open ──
  useEffect(() => {
    if (!open || !bookingId || loading) return;
    const hasUnread = messages.some(
      (m) =>
        !m.read_at &&
        (typeof m.sender_id === "object"
          ? m.sender_id._id !== myId
          : m.sender_id !== myId),
    );
    if (!hasUnread) return;

    fetch(`${API_BASE}/api/messages/${bookingId}/read`, {
      method: "PATCH",
      credentials: "include",
    }).catch(() => {});
  }, [open, bookingId, messages, loading, myId]);

  // ── Join socket booking room + listen for events ──
  useEffect(() => {
    if (!open || !bookingId || !connected) return;

    socket.emit(EVENTS.JOIN_BOOKING, { bookingId });

    const handleNew = (payload: { bookingId: string; message: Message }) => {
      if (payload.bookingId !== bookingId) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === payload.message._id)) return prev;
        return [...prev, payload.message];
      });
    };

    const handleRead = (payload: { bookingId: string; readerId: string }) => {
      if (payload.bookingId !== bookingId) return;
      // Mark all messages I sent as read
      setMessages((prev) =>
        prev.map((m) => {
          const senderId =
            typeof m.sender_id === "object" ? m.sender_id._id : m.sender_id;
          if (senderId === myId && !m.read_at) {
            return { ...m, read_at: new Date().toISOString() };
          }
          return m;
        }),
      );
    };

    const handleTypingStart = (payload: {
      bookingId: string;
      userId: string;
    }) => {
      if (payload.bookingId !== bookingId) return;
      if (payload.userId === myId) return;
      setPeerTyping(true);
    };

    const handleTypingStop = (payload: {
      bookingId: string;
      userId: string;
    }) => {
      if (payload.bookingId !== bookingId) return;
      if (payload.userId === myId) return;
      setPeerTyping(false);
    };

    socket.on(EVENTS.CHAT_MESSAGE_NEW, handleNew);
    socket.on(EVENTS.CHAT_MESSAGE_READ, handleRead);
    socket.on(EVENTS.CHAT_TYPING_START, handleTypingStart);
    socket.on(EVENTS.CHAT_TYPING_STOP, handleTypingStop);

    return () => {
      socket.off(EVENTS.CHAT_MESSAGE_NEW, handleNew);
      socket.off(EVENTS.CHAT_MESSAGE_READ, handleRead);
      socket.off(EVENTS.CHAT_TYPING_START, handleTypingStart);
      socket.off(EVENTS.CHAT_TYPING_STOP, handleTypingStop);
    };
  }, [open, bookingId, connected, socket, myId]);

  // ── Auto-scroll to bottom on new messages ──
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, peerTyping]);

  // ── Send message ──
  async function send() {
    const body = draft.trim();
    if (!body || sending || !bookingId) return;
    setSending(true);
    setError("");

    // Emit typing-stop
    socket.emit(EVENTS.CHAT_TYPING_STOP, { bookingId });

    try {
      const res = await fetch(`${API_BASE}/api/messages/${bookingId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Send failed");
      // Optimistically add (socket will dedupe by _id)
      setMessages((prev) => {
        if (prev.some((m) => m._id === data.message._id)) return prev;
        return [...prev, data.message];
      });
      setDraft("");
    } catch (e: any) {
      setError(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  // ── Typing indicator (throttled) ──
  function handleDraftChange(value: string) {
    setDraft(value);
    if (!bookingId || !connected) return;

    const now = Date.now();
    if (now - lastTypingEmit.current > 2000) {
      socket.emit(EVENTS.CHAT_TYPING_START, { bookingId });
      lastTypingEmit.current = now;
    }

    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      socket.emit(EVENTS.CHAT_TYPING_STOP, { bookingId });
      lastTypingEmit.current = 0;
    }, 3000);
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return (
      d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      ", " +
      d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg h-[600px] max-h-[85vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h3 className="font-bold text-gray-900">{peerName}</h3>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-300"}`}
              />
              {connected ? "Online" : "Connecting..."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/60"
            aria-label="Close chat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
        >
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-10">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-10">
              No messages yet. Say hi! 👋
            </div>
          ) : (
            messages.map((m) => {
              const senderId =
                typeof m.sender_id === "object" ? m.sender_id._id : m.sender_id;
              const mine = senderId === myId;
              return (
                <div
                  key={m._id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}
                  >
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        mine
                          ? "bg-[#2563EB] text-white rounded-br-md"
                          : "bg-white text-gray-900 border border-gray-200 rounded-bl-md"
                      } whitespace-pre-wrap break-words text-sm`}
                    >
                      {m.body}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-400">
                      <span>{formatTime(m.createdAt)}</span>
                      {mine && (
                        <span
                          className={
                            m.read_at
                              ? "text-blue-500 font-semibold"
                              : "text-gray-400"
                          }
                        >
                          {m.read_at ? "✓✓ Read" : "✓✓"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {peerTyping && (
            <div className="flex justify-start">
              <div className="px-4 py-2 rounded-2xl bg-white border border-gray-200 rounded-bl-md">
                <div className="flex gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-200 bg-white">
          {error && (
            <div className="mb-2 text-xs text-red-600 px-2">{error}</div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              maxLength={2000}
              className="flex-1 resize-none border border-gray-300 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 max-h-24"
            />
            <button
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              className="p-2.5 rounded-full bg-[#2563EB] text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="flex justify-between mt-1 px-2">
            <span className="text-[11px] text-gray-400">
              {draft.length}/2000
            </span>
            <span className="text-[11px] text-gray-400">
              Enter to send · Shift+Enter for new line
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
