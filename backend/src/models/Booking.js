import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true, index: true },

    date: { type: String, required: true },
    time: { type: String, required: true },
    address: { type: String, required: true, trim: true },
    service_geo: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
    formatted_address: { type: String, trim: true },
    distance_miles: { type: Number, default: null }, // distance from provider home

    // 💰 Signal 13 — Negotiated Travel Fee
    travel_fee_requested: { type: Number, default: null },
    travel_fee_status: {
      type: String,
      enum: ["pending", "accepted", "rejected", null],
      default: null,
    },
    travel_fee_note: { type: String, default: "" },
    travel_fee_requested_at: { type: Date, default: null },
    is_urgent: { type: Boolean, default: false },
    urgent_premium_pct: { type: Number, default: 0 },
    urgent_broadcast_to: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    urgent_accepted_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    urgent_broadcast_at: { type: Date, default: null },
    urgent_accepted_at: { type: Date, default: null },
    urgent_passed_by: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    notes: { type: String, trim: true },
    total_amount: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "broadcasting",
        "rejected",
        "cancelled",
        "work_completed",
        "completed",
        "reschedule_requested",
      ],
      default: "pending",
      index: true,
    },

    payment_status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },

    payment_method: {
      type: String,
      enum: ["card", "cash", null],
      default: null,
    },

    cashback_earned: { type: Number, default: 0, min: 0 },
    cashback_applied: { type: Number, default: 0, min: 0 },

    decision: {
      type: String,
      enum: ["pending", "accepted", "rejected", null],
      default: null,
    },

    pricing_type: {
      type: String,
      enum: ["hourly", "fixed"],
      default: "fixed",
    },
    estimated_hours: { type: Number, default: 1, min: 1 },

    reschedule: {
      requested: { type: Boolean, default: false },
      proposed_date: { type: String, default: null },
      proposed_time: { type: String, default: null },
      reason: { type: String, default: "" },
      requested_by: {
        type: String,
        enum: ["provider", "customer", null],
        default: null,
      },
      rejection_reason: { type: String, default: "" },
      rejection_message: { type: String, default: "" },
      previous_status: { type: String, default: null },
      decision: {
        type: String,
        enum: ["pending", "accepted", "rejected", null],
        default: null,
      },
    },

    cancellation: {
      cancelled_by: {
        type: String,
        enum: ["customer", "provider", "admin", null],
        default: null,
      },
      cancelled_at: { type: Date, default: null },
      reason: { type: String, default: "", trim: true },
      policy_applied: {
        type: String,
        enum: [
          "full_refund",
          "partial_refund",
          "no_refund",
          "provider_cancelled",
          "admin_cancelled",
          null,
        ],
        default: null,
      },
      refund_pct: { type: Number, default: 0 },
      refund_amount: { type: Number, default: 0 },
      refund_status: {
        type: String,
        enum: ["not_required", "pending", "processed", "failed", null],
        default: null,
      },
      hours_remaining_at_cancel: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

bookingSchema.index({ service_geo: "2dsphere" });

export const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);