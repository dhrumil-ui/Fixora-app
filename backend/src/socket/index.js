import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import { EVENTS, ROOMS } from "./events.js";

let io = null;

/**
 * Parse JWT from (1) auth.token handshake arg, (2) Authorization header, (3) cookie.
 * Mirrors what /backend/src/middleware/auth.js does for HTTP.
 */
function extractToken(socket) {
  // 1. Explicit auth arg — sent by frontend: io(URL, { auth: { token } })
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  // 2. Authorization header — Bearer
  const authHeader = socket.handshake.headers?.authorization || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);

  // 3. Cookie (same name as HTTP auth: fixora_token)
  const rawCookie = socket.handshake.headers?.cookie;
  if (rawCookie) {
    const parsed = cookie.parse(rawCookie);
    if (parsed.fixora_token) return parsed.fixora_token;
  }

  return null;
}

function authMiddleware(socket, next) {
  const token = extractToken(socket);

  // Allow unauthenticated for public channels (booking tracking uses join_booking directly)
  // But attach user info if token is present.
  if (!token) {
    socket.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: payload.id, role: payload.role };
    return next();
  } catch {
    // Invalid token — reject connection
    return next(new Error("Invalid or expired token"));
  }
}

/**
 * Initialize Socket.io on the existing http server.
 * Call this ONCE from server.js after httpServer is created.
 */
export function initSocket(httpServer, { allowedOrigins }) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"],
    },
    // Longer ping to survive mobile tab backgrounding
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(authMiddleware);

  io.on("connection", (socket) => {
    const who = socket.user
      ? `${socket.user.role}:${socket.user.id}`
      : `anon:${socket.id}`;
    console.log(`🔌 Socket connected: ${who}`);

    // Auto-join user's personal room + role-based rooms
    if (socket.user) {
      socket.join(ROOMS.user(socket.user.id));

      if (socket.user.role === "provider") {
        socket.join(ROOMS.provider(socket.user.id));
      }
      if (socket.user.role === "admin") {
        socket.join(ROOMS.admin);
      }

      socket.emit(EVENTS.CONNECTED, {
        userId: socket.user.id,
        role: socket.user.role,
        rooms: [...socket.rooms],
      });
    }

    // --- Existing booking tracking events (kept, now auth-scoped) ---
    socket.on(EVENTS.JOIN_BOOKING, ({ bookingId, role }) => {
      if (!bookingId) return;
      socket.join(ROOMS.booking(bookingId));
      console.log(`📌 ${role || "unknown"} joined booking:${bookingId}`);
    });

    socket.on(EVENTS.PROVIDER_LOCATION, ({ bookingId, lat, lng }) => {
      // Only providers should emit location
      if (socket.user?.role !== "provider") return;
      if (!bookingId || typeof lat !== "number" || typeof lng !== "number") return;

      socket
        .to(ROOMS.booking(bookingId))
        .emit(EVENTS.LOCATION_UPDATE, { lat, lng, at: Date.now() });
    });

    socket.on(EVENTS.PROVIDER_ARRIVED, ({ bookingId }) => {
      if (socket.user?.role !== "provider") return;
      if (!bookingId) return;
      io.to(ROOMS.booking(bookingId)).emit(EVENTS.PROVIDER_ARRIVED, { bookingId });
    });

    // --- Chat typing indicators (per-booking) ---
    socket.on(EVENTS.CHAT_TYPING_START, ({ bookingId }) => {
      if (!bookingId || !socket.user?.id) return;
      socket.to(ROOMS.booking(bookingId)).emit(EVENTS.CHAT_TYPING_START, {
        bookingId,
        userId: socket.user.id,
      });
    });

    socket.on(EVENTS.CHAT_TYPING_STOP, ({ bookingId }) => {
      if (!bookingId || !socket.user?.id) return;
      socket.to(ROOMS.booking(bookingId)).emit(EVENTS.CHAT_TYPING_STOP, {
        bookingId,
        userId: socket.user.id,
      });
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket disconnected: ${who} (${reason})`);
    });
  });

  return io;
}

/**
 * Get the io instance from anywhere (controllers, services).
 * Throws if initSocket wasn't called first.
 */
export function getIO() {
  if (!io) throw new Error("Socket.io not initialized — call initSocket first");
  return io;
}

export { EVENTS, ROOMS };