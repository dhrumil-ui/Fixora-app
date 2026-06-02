import { useCallback, useEffect } from "react";
import { useSocket, useSocketEvents } from "./useSocket";
import { EVENTS } from "../lib/socketEvents";

// =============================================================
// useBookingLive(bookingId)
//   - Joins booking room for location tracking
//   - Exposes callbacks for provider to send location/arrived
// =============================================================
export function useBookingLive(
  bookingId: string | undefined,
  role: "customer" | "provider" | "admin",
  handlers?: {
    onLocationUpdate?: (p: { lat: number; lng: number; at?: number }) => void;
    onProviderArrived?: (p: { bookingId: string }) => void;
    onStatusChange?: (booking: any) => void;
  }
) {
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!bookingId || !connected) return;

    socket.emit(EVENTS.JOIN_BOOKING, { bookingId, role });

    if (handlers?.onLocationUpdate) socket.on(EVENTS.LOCATION_UPDATE, handlers.onLocationUpdate);
    if (handlers?.onProviderArrived) socket.on(EVENTS.PROVIDER_ARRIVED, handlers.onProviderArrived);

    const statusHandler = (payload: any) => {
      if (!handlers?.onStatusChange) return;
      if (payload?.booking?._id === bookingId) handlers.onStatusChange(payload.booking);
    };

    const statusEvents = [
      EVENTS.BOOKING_ACCEPTED, EVENTS.BOOKING_REJECTED, EVENTS.BOOKING_CONFIRMED,
      EVENTS.BOOKING_CANCELLED, EVENTS.BOOKING_WORK_COMPLETED, EVENTS.BOOKING_COMPLETED,
      EVENTS.BOOKING_UPDATED,
    ];
    statusEvents.forEach((e) => socket.on(e, statusHandler));

    return () => {
      if (handlers?.onLocationUpdate) socket.off(EVENTS.LOCATION_UPDATE, handlers.onLocationUpdate);
      if (handlers?.onProviderArrived) socket.off(EVENTS.PROVIDER_ARRIVED, handlers.onProviderArrived);
      statusEvents.forEach((e) => socket.off(e, statusHandler));
    };
  }, [socket, connected, bookingId, role, handlers]);

  const sendLocation = useCallback(
    (lat: number, lng: number) => {
      if (!bookingId) return;
      socket.emit(EVENTS.PROVIDER_LOCATION, { bookingId, lat, lng });
    },
    [socket, bookingId]
  );

  const markArrived = useCallback(() => {
    if (!bookingId) return;
    socket.emit(EVENTS.PROVIDER_ARRIVED, { bookingId });
  }, [socket, bookingId]);

  return { connected, sendLocation, markArrived };
}

// =============================================================
// useCustomerLive — subscribe to all events that affect a customer
//   Drop into CustomerDashboard.tsx, give it a setter to mutate state.
// =============================================================
export function useCustomerLive(opts: {
  onBookingUpdate?: (booking: any) => void;
  onPaymentSuccess?: (payment: any, booking?: any) => void;
  onPaymentFailed?: (payment: any) => void;
  onIssueResolved?: (issue: any) => void;
}) {
  useSocketEvents({
    [EVENTS.BOOKING_ACCEPTED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.BOOKING_REJECTED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.BOOKING_CONFIRMED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.BOOKING_CANCELLED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.BOOKING_WORK_COMPLETED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.BOOKING_COMPLETED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.BOOKING_UPDATED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.RESCHEDULE_REQUESTED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.RESCHEDULE_APPROVED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.RESCHEDULE_REJECTED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.PAYMENT_SUCCEEDED]: (p) => opts.onPaymentSuccess?.(p.payment, p.booking),
    [EVENTS.PAYMENT_FAILED]: (p) => opts.onPaymentFailed?.(p.payment),
    [EVENTS.ISSUE_RESOLVED]: (p) => opts.onIssueResolved?.(p.issue),
  });
}

export function useProviderLive(opts: {
  onNewRequest?: (booking: any) => void;
  onBookingUpdate?: (booking: any) => void;
  onNewReview?: (review: any) => void;
  onNewIssue?: (issue: any) => void;
  onPaymentReceived?: (payment: any, booking?: any) => void;
  onUrgentBroadcast?: (booking: any) => void;  // ← ADD
  onUrgentTaken?: () => void;                   // ← ADD
}) {
  useSocketEvents({
    [EVENTS.PROVIDER_NEW_REQUEST]: (p) => opts.onNewRequest?.(p.booking),
    [EVENTS.BOOKING_CREATED]: (p) => opts.onNewRequest?.(p.booking),
    [EVENTS.BOOKING_CANCELLED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.BOOKING_UPDATED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.BOOKING_COMPLETED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.RESCHEDULE_REQUESTED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.RESCHEDULE_APPROVED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.RESCHEDULE_REJECTED]: (p) => opts.onBookingUpdate?.(p.booking),
    [EVENTS.REVIEW_CREATED]: (p) => opts.onNewReview?.(p.review),
    [EVENTS.ISSUE_CREATED]: (p) => opts.onNewIssue?.(p.issue),
    [EVENTS.PAYMENT_SUCCEEDED]: (p) => opts.onPaymentReceived?.(p.payment, p.booking),
    [EVENTS.URGENT_BROADCAST]: (p) => opts.onUrgentBroadcast?.(p.booking), // ← ADD
    [EVENTS.URGENT_TAKEN]: () => opts.onUrgentTaken?.(),              // ← ADD
  });
}

export function useAdminLive(opts: {
  onNewUser?: (user: any) => void;
  onNewBooking?: (booking: any) => void;
  onNewPayment?: (payment: any, booking?: any) => void;
  onNewIssue?: (issue: any) => void;
  onNewReview?: (review: any) => void;
  onRefund?: (payment: any) => void;
  onReviewUpdated?: (review: any) => void;  // ← ADD
  onReviewDeleted?: (reviewId: any) => void; // ← ADD
}) {
  useSocketEvents({
    [EVENTS.ADMIN_NEW_USER]: (p) => opts.onNewUser?.(p.user),
    [EVENTS.ADMIN_NEW_BOOKING]: (p) => opts.onNewBooking?.(p.booking),
    [EVENTS.ADMIN_NEW_PAYMENT]: (p) => opts.onNewPayment?.(p.payment, p.booking),
    [EVENTS.ADMIN_NEW_ISSUE]: (p) => opts.onNewIssue?.(p.issue),
    [EVENTS.ADMIN_NEW_REVIEW]: (p) => opts.onNewReview?.(p.review),
    [EVENTS.PAYMENT_REFUNDED]: (p) => opts.onRefund?.(p.payment),
    [EVENTS.ADMIN_REVIEW_UPDATED]: (p) => opts.onReviewUpdated?.(p.review),   // ← ADD
    [EVENTS.ADMIN_REVIEW_DELETED]: (p) => opts.onReviewDeleted?.(p.reviewId), // ← ADD
  });
}
