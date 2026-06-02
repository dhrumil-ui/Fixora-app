// frontend/src/app/components/PWAUpdatePrompt.tsx
//
// Renders a small toast when a new version of the app is available.
// User clicks "Update" → service worker activates new version → page reloads.
//
// Mount this once in App.tsx (or main.tsx).

import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function PWAUpdatePrompt() {
  const [showOffline, setShowOffline] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      console.log("[PWA] Service worker registered:", swUrl);
    },
    onRegisterError(error) {
      console.error("[PWA] Service worker registration error:", error);
    },
    onOfflineReady() {
      console.log("[PWA] App ready to work offline");
      setShowOffline(true);
      setTimeout(() => setShowOffline(false), 4000);
    },
  });

  // Hide offline-ready toast after timeout
  useEffect(() => {
    if (offlineReady && !showOffline) {
      setOfflineReady(false);
    }
  }, [offlineReady, showOffline, setOfflineReady]);

  if (!needRefresh && !showOffline) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        maxWidth: 360,
      }}
    >
      {needRefresh && (
        <div
          style={{
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>
              🚀 New version available
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
              Refresh to load the latest version of Fixora.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => updateServiceWorker(true)}
              style={{
                flex: 1,
                padding: "8px 14px",
                background: "#2563EB",
                color: "white",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Update
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              style={{
                padding: "8px 14px",
                background: "white",
                color: "#374151",
                border: "1px solid #D1D5DB",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Later
            </button>
          </div>
        </div>
      )}

      {showOffline && !needRefresh && (
        <div
          style={{
            background: "#ECFDF3",
            border: "1px solid #BBF7D0",
            borderRadius: 16,
            padding: 14,
            boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20 }}>✓</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#166534" }}>
              Ready to work offline
            </div>
            <div style={{ fontSize: 12, color: "#15803D" }}>
              Fixora is now installed
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
