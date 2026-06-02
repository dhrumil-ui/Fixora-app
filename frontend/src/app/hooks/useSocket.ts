import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { getSocket, onConnectionChange, isSocketConnected } from "../lib/socket";
import { SocketEventName } from "../lib/socketEvents";

/**
 * Returns the singleton socket + live connected state.
 * Safe to use in any component — multiple useSocket() calls share one socket.
 */
export function useSocket(): { socket: Socket; connected: boolean } {
  const [connected, setConnected] = useState(isSocketConnected());
  const socketRef = useRef<Socket>(getSocket());

  useEffect(() => {
    const unsubscribe = onConnectionChange(setConnected);
    return unsubscribe;
  }, []);

  return { socket: socketRef.current, connected };
}

/**
 * Subscribe to a socket event. Handler is auto-unbound on unmount.
 * Pass a stable handler (useCallback) or it'll re-bind every render.
 *
 * Example:
 *   useSocketEvent(EVENTS.BOOKING_ACCEPTED, useCallback((p) => {
 *     toast.success("Accepted!");
 *   }, []));
 */
export function useSocketEvent<T = any>(
  event: SocketEventName,
  handler: (payload: T) => void
): void {
  const { socket } = useSocket();

  useEffect(() => {
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
}

/**
 * Subscribe to MULTIPLE events at once. Useful for dashboard-style components.
 *
 * Example:
 *   useSocketEvents({
 *     [EVENTS.BOOKING_ACCEPTED]: (p) => updateBooking(p.booking),
 *     [EVENTS.BOOKING_CANCELLED]: (p) => removeBooking(p.booking._id),
 *   });
 */
export function useSocketEvents(
  handlers: Partial<Record<SocketEventName, (payload: any) => void>>
): void {
  const { socket } = useSocket();

  useEffect(() => {
    const entries = Object.entries(handlers) as [SocketEventName, (p: any) => void][];
    entries.forEach(([evt, fn]) => socket.on(evt, fn));
    return () => {
      entries.forEach(([evt, fn]) => socket.off(evt, fn));
    };
    // Intentional: handlers object is expected to be stable per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);
}
