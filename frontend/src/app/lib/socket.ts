import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  (import.meta.env.VITE_SOCKET_URL as string) || "http://localhost:5001";

let socket: Socket | null = null;
let connectListeners: Array<(connected: boolean) => void> = [];

/**
 * Get (or create) the singleton socket. Safe to call from anywhere/anytime.
 * Uses cookie auth (same fixora_token used by HTTP). Auto-reconnects.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    withCredentials: true,          // sends fixora_token cookie
    autoConnect: true,
    transports: ["websocket", "polling"], // WS first, fallback to polling
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,         // start 1s
    reconnectionDelayMax: 10000,     // cap at 10s
    timeout: 20000,
  });

  socket.on("connect", () => {
    // console.debug("[socket] connected", socket?.id);
    connectListeners.forEach((fn) => fn(true));
  });

  socket.on("disconnect", (reason) => {
    // console.debug("[socket] disconnected", reason);
    connectListeners.forEach((fn) => fn(false));

    // Server kicked us — force manual reconnect on next action
    if (reason === "io server disconnect") {
      socket?.connect();
    }
  });

  socket.on("connect_error", (err) => {
    // Auth failure or CORS — browser will keep retrying
    if (import.meta.env.DEV) {
      console.warn("[socket] connect_error:", err.message);
    }
  });

  // Handle browser tab wake-up: socket.io auto-reconnects, but we poke it
  // just in case the network fired before the socket noticed.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !socket?.connected) {
        socket?.connect();
      }
    });
  }

  return socket;
}

/** Subscribe to connected/disconnected state changes (for UI indicators) */
export function onConnectionChange(fn: (connected: boolean) => void): () => void {
  connectListeners.push(fn);
  return () => {
    connectListeners = connectListeners.filter((f) => f !== fn);
  };
}

/** Disconnect — call on logout */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    connectListeners = [];
  }
}

/** Quick check */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}
