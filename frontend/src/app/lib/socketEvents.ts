// Mirror of backend/src/socket/events.js — KEEP IN SYNC.
// If you add an event here, add it to the backend too.

export const EVENTS = {
  CONNECTED: "connected",
  ERROR: "socket_error",

  BOOKING_CREATED: "booking:created",
  BOOKING_ACCEPTED: "booking:accepted",
  BOOKING_REJECTED: "booking:rejected",
  BOOKING_CONFIRMED: "booking:confirmed",
  BOOKING_CANCELLED: "booking:cancelled",
  BOOKING_WORK_COMPLETED: "booking:work_completed",
  BOOKING_COMPLETED: "booking:completed",
  BOOKING_UPDATED: "booking:updated",

  RESCHEDULE_REQUESTED: "booking:reschedule_requested",
  RESCHEDULE_APPROVED: "booking:reschedule_approved",
  RESCHEDULE_REJECTED: "booking:reschedule_rejected",

  PAYMENT_INTENT_CREATED: "payment:intent_created",
  PAYMENT_SUCCEEDED: "payment:succeeded",
  PAYMENT_FAILED: "payment:failed",
  PAYMENT_REFUNDED: "payment:refunded",

  REVIEW_CREATED: "review:created",

  ISSUE_CREATED: "issue:created",
  ISSUE_RESOLVED: "issue:resolved",

  JOIN_BOOKING: "join_booking",
  PROVIDER_LOCATION: "provider_location",
  LOCATION_UPDATE: "location_update",
  PROVIDER_ARRIVED: "provider_arrived",

  ADMIN_NEW_USER: "admin:new_user",
  ADMIN_NEW_BOOKING: "admin:new_booking",
  ADMIN_NEW_PAYMENT: "admin:new_payment",
  ADMIN_NEW_ISSUE: "admin:new_issue",
  ADMIN_NEW_REVIEW: "admin:new_review",

  PROVIDER_NEW_REQUEST: "provider:new_request",
  PROVIDER_AVAILABILITY_CHANGED: "provider:availability_changed",

  // Chat
  CHAT_MESSAGE_NEW: "chat:message_new",
  CHAT_MESSAGE_READ: "chat:message_read",
  CHAT_TYPING_START: "chat:typing_start",
  CHAT_TYPING_STOP: "chat:typing_stop",
  CHAT_UNREAD_UPDATE: "chat:unread_update",
} as const;

export type SocketEventName = typeof EVENTS[keyof typeof EVENTS];

// Payload shapes — loose, refine as your types solidify
export interface BookingPayload { booking: any }
export interface PaymentPayload { payment: any; booking?: any }
export interface ReviewPayload { review: any }
export interface IssuePayload { issue: any }
export interface UserPayload { user: any }
export interface LocationPayload { lat: number; lng: number; at?: number }
export interface ConnectedPayload {
  userId: string;
  role: "customer" | "provider" | "admin";
  rooms: string[];
}