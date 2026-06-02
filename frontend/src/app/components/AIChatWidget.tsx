import { useState, useRef, useEffect } from "react";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:5001";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "👋 Hi! I'm Fixora's AI assistant. Ask me anything about bookings, payments, or how to use the platform!",
  timestamp: Date.now(),
};

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const userMessage = input.trim();
    if (!userMessage || loading) return;

    setInput("");
    const newUserMsg: Message = {
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newUserMsg]);
    setLoading(true);

    try {
      // Send last 10 messages as context (excluding the welcome)
      const history = [...messages, newUserMsg]
        .filter((m) => m !== WELCOME_MESSAGE)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: history.slice(0, -1), // exclude the just-added user message
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to reply");

      const aiMsg: Message = {
        role: "assistant",
        content: data.reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (!open) setUnread(true);
    } catch (e: any) {
      const errorMsg: Message = {
        role: "assistant",
        content: `⚠️ Sorry, I had trouble responding: ${e?.message || "unknown error"}. Please try again or contact support@fixora.com.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function clearChat() {
    setMessages([WELCOME_MESSAGE]);
  }

  function toggleOpen() {
    setOpen((prev) => !prev);
    if (!open) setUnread(false);
  }

  return (
    <>
      {/* Floating bubble button */}
      <button
        onClick={toggleOpen}
        aria-label="Open AI Chat"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
          color: "white",
          border: "none",
          fontSize: 28,
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(99, 102, 241, 0.4)",
          zIndex: 9998,
          transition: "transform 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? "✕" : "💬"}
        {unread && !open && (
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#EF4444",
              border: "2px solid white",
            }}
          />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            right: 24,
            width: 380,
            maxWidth: "calc(100vw - 48px)",
            height: 560,
            maxHeight: "calc(100vh - 140px)",
            background: "white",
            borderRadius: 20,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            display: "flex",
            flexDirection: "column",
            zIndex: 9999,
            overflow: "hidden",
            border: "1px solid #E5E7EB",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: 16,
              background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                }}
              >
                ✨
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Fixora AI</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#10B981",
                      marginRight: 4,
                    }}
                  />
                  Online · Powered by Claude
                </div>
              </div>
            </div>
            <button
              onClick={clearChat}
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 700,
              }}
              title="Clear chat"
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              background: "#F9FAFB",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent:
                    msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "78%",
                    padding: "10px 14px",
                    borderRadius: 14,
                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)"
                        : "white",
                    color: msg.role === "user" ? "white" : "#1F2937",
                    fontSize: 14,
                    lineHeight: 1.5,
                    border:
                      msg.role === "assistant" ? "1px solid #E5E7EB" : "none",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    boxShadow:
                      msg.role === "user"
                        ? "0 2px 8px rgba(99, 102, 241, 0.3)"
                        : "0 1px 3px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    background: "white",
                    border: "1px solid #E5E7EB",
                    fontSize: 14,
                    color: "#6B7280",
                  }}
                >
                  <span className="typing-dot">●</span>
                  <span
                    className="typing-dot"
                    style={{ animationDelay: "0.2s" }}
                  >
                    ●
                  </span>
                  <span
                    className="typing-dot"
                    style={{ animationDelay: "0.4s" }}
                  >
                    ●
                  </span>
                  <style>{`
                    .typing-dot {
                      display: inline-block;
                      animation: typing 1.4s infinite;
                      opacity: 0.4;
                      margin: 0 2px;
                    }
                    @keyframes typing {
                      0%, 60%, 100% { opacity: 0.4; }
                      30% { opacity: 1; }
                    }
                  `}</style>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: 12,
              background: "white",
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 14px",
                border: "1px solid #D1D5DB",
                borderRadius: 12,
                fontSize: 14,
                outline: "none",
                resize: "none",
                fontFamily: "inherit",
                maxHeight: 100,
                lineHeight: 1.4,
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                padding: "10px 16px",
                background:
                  loading || !input.trim()
                    ? "#D1D5DB"
                    : "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "..." : "Send"}
            </button>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "6px 12px",
              fontSize: 10,
              color: "#9CA3AF",
              textAlign: "center",
              background: "#F9FAFB",
              borderTop: "1px solid #F3F4F6",
            }}
          >
            AI may make mistakes. For account issues, contact support@fixora.com
          </div>
        </div>
      )}
    </>
  );
}
