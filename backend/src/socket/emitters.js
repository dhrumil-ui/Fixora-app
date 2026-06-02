import { getIO, EVENTS, ROOMS } from "./index.js";

/**
 * Central place for all socket emits. Keeps controllers clean.
 * If an emit throws (e.g. socket.io not initialized during tests), we swallow
 * the error — a failed notification must never break a DB transaction.
 */
function safeEmit(room, event, payload) {
  try {
    getIO().to(room).emit(event, payload);
  } catch (err) {
    console.error(`Socket emit failed [${event} → ${room}]:`, err.message);
  }
}

function safeBroadcast(event, payload) {
  try {
    getIO().emit(event, payload);
  } catch (err) {
    console.error(`Socket broadcast failed [${event}]:`, err.message);
  }
}

// =======================================================
// BOOKING EMITS
// =======================================================

/** Provider sees new booking request in dashboard instantly */
export function emitBookingCreated(booking) {
  const customerId = String(booking.customer_id?._id || booking.customer_id);
  const providerId = String(booking.provider_id?._id || booking.provider_id);

  safeEmit(ROOMS.user(providerId), EVENTS.BOOKING_CREATED, { booking });
  safeEmit(ROOMS.provider(providerId), EVENTS.PROVIDER_NEW_REQUEST, { booking });
  safeEmit(ROOMS.user(customerId), EVENTS.BOOKING_CREATED, { booking });
  safeEmit(ROOMS.admin, EVENTS.ADMIN_NEW_BOOKING, { booking });
}

/** Customer sees "accepted" toast; booking card updates live */
export function emitBookingAccepted(booking) {
  const customerId = String(booking.customer_id?._id || booking.customer_id);
  const providerId = String(booking.provider_id?._id || booking.provider_id);

  safeEmit(ROOMS.user(customerId), EVENTS.BOOKING_ACCEPTED, { booking });
  safeEmit(ROOMS.user(providerId), EVENTS.BOOKING_UPDATED, { booking });
}

export function emitBookingRejected(booking) {
  const customerId = String(booking.customer_id?._id || booking.customer_id);
  const providerId = String(booking.provider_id?._id || booking.provider_id);

  safeEmit(ROOMS.user(customerId), EVENTS.BOOKING_REJECTED, { booking });
  safeEmit(ROOMS.user(providerId), EVENTS.BOOKING_UPDATED, { booking });
}

export function emitBookingConfirmed(booking) {
  const customerId = String(booking.customer_id?._id || booking.customer_id);
  const providerId = String(booking.provider_id?._id || booking.provider_id);

  safeEmit(ROOMS.user(customerId), EVENTS.BOOKING_CONFIRMED, { booking });
  safeEmit(ROOMS.user(providerId), EVENTS.BOOKING_UPDATED, { booking });
}

export function emitBookingCancelled(booking) {
  const customerId = String(booking.customer_id?._id || booking.customer_id);
  const providerId = String(booking.provider_id?._id || booking.provider_id);

  safeEmit(ROOMS.user(customerId), EVENTS.BOOKING_CANCELLED, { booking });
  safeEmit(ROOMS.user(providerId), EVENTS.BOOKING_CANCELLED, { booking });
}

export function emitBookingWorkCompleted(booking) {
  const customerId = String(booking.customer_id?._id || booking.customer_id);
  const providerId = String(booking.provider_id?._id || booking.provider_id);

  // Customer needs to know — this unlocks their payment flow
  safeEmit(ROOMS.user(customerId), EVENTS.BOOKING_WORK_COMPLETED, { booking });
  safeEmit(ROOMS.user(providerId), EVENTS.BOOKING_UPDATED, { booking });
}

export function emitBookingCompleted(booking) {
  const customerId = String(booking.customer_id?._id || booking.customer_id);
  const providerId = String(booking.provider_id?._id || booking.provider_id);

  safeEmit(ROOMS.user(customerId), EVENTS.BOOKING_COMPLETED, { booking });
  safeEmit(ROOMS.user(providerId), EVENTS.BOOKING_COMPLETED, { booking });
}

// =======================================================
// RESCHEDULE EMITS
// =======================================================

/** Tells the OTHER party (whoever didn't request) */
export function emitRescheduleRequested(booking, requestedByRole) {
  const customerId = String(booking.customer_id?._id || booking.customer_id);
  const providerId = String(booking.provider_id?._id || booking.provider_id);

  const targetUserId = requestedByRole === "customer" ? providerId : customerId;
  safeEmit(ROOMS.user(targetUserId), EVENTS.RESCHEDULE_REQUESTED, { booking });
}

export function emitRescheduleApproved(booking) {
  const customerId = String(booking.customer_id?._id || booking.customer_id);
  const providerId = String(booking.provider_id?._id || booking.provider_id);

  safeEmit(ROOMS.user(customerId), EVENTS.RESCHEDULE_APPROVED, { booking });
  safeEmit(ROOMS.user(providerId), EVENTS.RESCHEDULE_APPROVED, { booking });
}

export function emitRescheduleRejected(booking) {
  const customerId = String(booking.customer_id?._id || booking.customer_id);
  const providerId = String(booking.provider_id?._id || booking.provider_id);

  safeEmit(ROOMS.user(customerId), EVENTS.RESCHEDULE_REJECTED, { booking });
  safeEmit(ROOMS.user(providerId), EVENTS.RESCHEDULE_REJECTED, { booking });
}

// =======================================================
// PAYMENT EMITS
// =======================================================

export function emitPaymentSucceeded(payment, booking) {
  const customerId = String(payment.customer_id?._id || payment.customer_id);
  const providerId = String(payment.provider_id?._id || payment.provider_id);

  safeEmit(ROOMS.user(customerId), EVENTS.PAYMENT_SUCCEEDED, { payment, booking });
  safeEmit(ROOMS.user(providerId), EVENTS.PAYMENT_SUCCEEDED, { payment, booking });
  safeEmit(ROOMS.admin, EVENTS.ADMIN_NEW_PAYMENT, { payment, booking });
}

export function emitPaymentFailed(payment) {
  const customerId = String(payment.customer_id?._id || payment.customer_id);
  safeEmit(ROOMS.user(customerId), EVENTS.PAYMENT_FAILED, { payment });
}

export function emitPaymentRefunded(payment) {
  const customerId = String(payment.customer_id?._id || payment.customer_id);
  const providerId = String(payment.provider_id?._id || payment.provider_id);

  safeEmit(ROOMS.user(customerId), EVENTS.PAYMENT_REFUNDED, { payment });
  safeEmit(ROOMS.user(providerId), EVENTS.PAYMENT_REFUNDED, { payment });
  safeEmit(ROOMS.admin, EVENTS.PAYMENT_REFUNDED, { payment });
}

// =======================================================
// REVIEW EMITS
// =======================================================

export function emitReviewCreated(review) {
  const providerId = String(review.provider_id?._id || review.provider_id);
  safeEmit(ROOMS.user(providerId), EVENTS.REVIEW_CREATED, { review });
  safeEmit(ROOMS.admin, EVENTS.ADMIN_NEW_REVIEW, { review });
}

export function emitReviewUpdated(review) {
  const providerId = String(review.provider_id?._id || review.provider_id);
  safeEmit(ROOMS.user(providerId), EVENTS.REVIEW_UPDATED, { review });
  safeEmit(ROOMS.admin, EVENTS.ADMIN_REVIEW_UPDATED, { review });
}

export function emitReviewDeleted(reviewId, providerId) {
  const pid = String(providerId);
  safeEmit(ROOMS.user(pid), EVENTS.REVIEW_DELETED, { reviewId });
  safeEmit(ROOMS.admin, EVENTS.ADMIN_REVIEW_DELETED, { reviewId });
}

export function emitReviewToggled(review) {
  const providerId = String(review.provider_id?._id || review.provider_id);
  safeEmit(ROOMS.user(providerId), EVENTS.REVIEW_TOGGLED, { review });
  safeEmit(ROOMS.admin, EVENTS.ADMIN_REVIEW_TOGGLED, { review });
}

// =======================================================
// ISSUE EMITS
// =======================================================

export function emitIssueCreated(issue) {
  const providerId = String(issue.provider_id?._id || issue.provider_id);
  safeEmit(ROOMS.user(providerId), EVENTS.ISSUE_CREATED, { issue });
  safeEmit(ROOMS.admin, EVENTS.ADMIN_NEW_ISSUE, { issue });
}

export function emitIssueResolved(issue) {
  const customerId = String(issue.customer_id?._id || issue.customer_id);
  const providerId = String(issue.provider_id?._id || issue.provider_id);
  safeEmit(ROOMS.user(customerId), EVENTS.ISSUE_RESOLVED, { issue });
  safeEmit(ROOMS.user(providerId), EVENTS.ISSUE_RESOLVED, { issue });
}

// =======================================================
// ADMIN EMITS
// =======================================================

export function emitNewUser(user) {
  // Strip sensitive fields before broadcasting
  const safe = {
    _id: user._id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
  safeEmit(ROOMS.admin, EVENTS.ADMIN_NEW_USER, { user: safe });
}

// =======================================================
// 🚨 URGENT MODE EMITS
// =======================================================

/** Broadcast urgent job to top N providers — they race to accept */
export function emitUrgentBroadcast(booking, providerIds) {
  providerIds.forEach((pid) => {
    safeEmit(ROOMS.user(String(pid)), EVENTS.URGENT_BROADCAST, { booking });
  });
}

/** Tell other providers that someone already accepted */
export function emitUrgentTaken(booking, providerIds, acceptedById) {
  providerIds.forEach((pid) => {
    if (String(pid) === String(acceptedById)) return; // skip winner
    safeEmit(ROOMS.user(String(pid)), EVENTS.URGENT_TAKEN, {
      bookingId: String(booking._id),
      acceptedBy: String(acceptedById),
    });
  });
}

/** Tell customer that a provider accepted their urgent booking */
export function emitUrgentAccepted(booking) {
  const customerId = String(booking.customer_id?._id || booking.customer_id);
  safeEmit(ROOMS.user(customerId), EVENTS.URGENT_ACCEPTED, { booking });
}
