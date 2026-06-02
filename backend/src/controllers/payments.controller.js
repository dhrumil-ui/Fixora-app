// backend/src/controllers/payments.controller.js
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Payment } from "../models/Payment.js";
import { Service } from "../models/Services.js";
import { User } from "../models/Users.js";
import {
  stripe,
  createPaymentIntent,
  retrievePaymentIntent,
  refundPayment,
  verifyWebhookSignature,
} from "../services/stripe.service.js";
import {
  emitPaymentSucceeded,
  emitPaymentFailed,
  emitPaymentRefunded,
} from "../socket/emitters.js";
import { sendPaymentReceipt } from "../utils/mailer.js";
import { logAction } from "../services/audit.service.js";
import { awardCashback, spendCashback } from "../utils/cashback.js";

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function createDemoPaymentIntent(req, res) {
  try {
    if (!stripe) {
      return res.status(503).json({
        message: "Payment service not configured. Please contact support.",
      });
    }

    const userId = req.user.id;
    const { booking_id, method, apply_cashback } = req.body;

    if (!booking_id) {
      return res.status(400).json({ message: "booking_id is required" });
    }
    if (!isValidObjectId(booking_id)) {
      return res.status(400).json({ message: "Invalid booking_id" });
    }

    const user = await User.findById(userId).select(
      "_id role email full_name cashback_balance",
    );
    if (!user || user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can pay" });
    }

    const booking = await Booking.findOne({ _id: booking_id, customer_id: userId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.status !== "work_completed") {
      return res.status(400).json({
        message: "Payment available only after provider completes work",
        code: "PAYMENT_NOT_ALLOWED_YET",
        booking_status: booking.status,
      });
    }

    if (booking.payment_status === "paid") {
      return res.status(400).json({ message: "Already paid" });
    }

    // Ensure amount exists
    let amount = Number(booking.total_amount || 0);
    if (!amount || amount <= 0) {
      const svc = await Service.findById(booking.service_id).select("price");
      amount = Number(svc?.price || 0);
      booking.total_amount = amount;
      await booking.save();
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Service amount not set" });
    }

    // Apply cashback (cap at user balance, leave min $0.50 for Stripe)
    let cashbackToApply = 0;
    const requested = Math.max(0, Number(apply_cashback || 0));
    if (requested > 0) {
      const available = Number(user.cashback_balance || 0);
      const maxAllowed = Math.max(0, amount - 0.5); // stripe minimum
      cashbackToApply = Math.min(requested, available, maxAllowed);
      cashbackToApply = Math.round(cashbackToApply * 100) / 100;
    }
    const chargedAmount = Math.round((amount - cashbackToApply) * 100) / 100;

    // Reuse initiated payment ONLY if amount + cashback match (no stale price)
    const existing = await Payment.findOne({
      booking_id: booking._id,
      status: "initiated",
    });

    const sameAmount =
      existing &&
      Number(existing.amount).toFixed(2) === chargedAmount.toFixed(2) &&
      Number(existing.cashback_applied || 0).toFixed(2) === cashbackToApply.toFixed(2);

    if (existing && existing.stripe_payment_intent_id && sameAmount) {
      // Verify the intent is still valid in Stripe
      try {
        const intent = await retrievePaymentIntent(existing.stripe_payment_intent_id);
        if (intent.status !== "canceled" && intent.status !== "succeeded") {
          return res.json({
            payment_id: existing._id,
            client_secret: intent.client_secret,
            amount: existing.amount,
            original_amount: amount,
            cashback_applied: Number(existing.cashback_applied || 0),
            currency: existing.currency,
            stripe_intent_id: intent.id,
          });
        }
      } catch (e) {
        // Intent doesn't exist anymore, create new one
      }
    }

    // Cashback toggled or amount changed → invalidate the old initiated payment
    if (existing && !sameAmount) {
      try {
        if (existing.stripe_payment_intent_id) {
          // Best-effort cancel old Stripe intent so it can't be charged later
          const { stripe } = await import("../services/stripe.service.js");
          if (stripe) {
            await stripe.paymentIntents
              .cancel(existing.stripe_payment_intent_id)
              .catch(() => { });
          }
        }
        await Payment.deleteOne({ _id: existing._id });
      } catch (e) {
        // Even if cancel fails, just create a new payment record below
      }
    }

    // Create new Stripe Payment Intent
    const intent = await createPaymentIntent({
      amount: chargedAmount,
      currency: booking.currency || "usd",
      metadata: {
        booking_id: String(booking._id),
        customer_id: String(booking.customer_id),
        provider_id: String(booking.provider_id),
        cashback_applied: String(cashbackToApply),
      },
      description: `Fixora booking ${booking._id}`,
    });

    // Save payment record (amount = chargedAmount, full_amount preserved on booking)
    const payment = await Payment.create({
      booking_id: booking._id,
      customer_id: booking.customer_id,
      provider_id: booking.provider_id,
      amount: chargedAmount,
      currency: booking.currency || "USD",
      method: method || "card",
      status: "initiated",
      stripe_payment_intent_id: intent.id,
      // transaction_ref stays unset until payment succeeds (avoids E11000 on null dups)
      cashback_applied: cashbackToApply,
    });

    return res.json({
      payment_id: payment._id,
      client_secret: intent.client_secret,
      amount: payment.amount,
      original_amount: amount,
      cashback_applied: cashbackToApply,
      currency: payment.currency,
      stripe_intent_id: intent.id,
    });
  } catch (e) {
    console.error("createPaymentIntent error:", e);
    return res.status(500).json({ message: e.message });
  }
}

/**
 * POST /api/payments/confirm
 * Frontend calls this AFTER stripe.confirmCardPayment() succeeds in browser
 * We verify status with Stripe servers, then mark booking paid
 * NOTE: Webhook is the SOURCE OF TRUTH - this is just for fast UI update
 */
export async function confirmDemoPayment(req, res) {
  try {
    const userId = req.user.id;
    const { payment_id, stripe_intent_id } = req.body;

    if (!payment_id) {
      return res.status(400).json({ message: "payment_id is required" });
    }
    if (!isValidObjectId(payment_id)) {
      return res.status(400).json({ message: "Invalid payment_id" });
    }

    const user = await User.findById(userId).select("_id role");
    if (!user || user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can confirm payment" });
    }

    const payment = await Payment.findOne({ _id: payment_id, customer_id: userId });
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    if (payment.status === "paid") {
      return res.json({ message: "Already paid", payment });
    }

    // Verify with Stripe
    const intentId = stripe_intent_id || payment.stripe_payment_intent_id;
    if (!intentId) {
      return res.status(400).json({ message: "No Stripe intent linked" });
    }

    const intent = await retrievePaymentIntent(intentId);

    if (intent.status === "succeeded") {
      payment.status = "paid";
      payment.transaction_ref = intent.id;
      payment.paid_at = new Date();
      await payment.save();

      const booking = await Booking.findById(payment.booking_id)
        .populate("customer_id", "full_name email")
        .populate("service_id", "service_name")
        .populate("provider_id", "full_name");

      if (booking) {
        booking.payment_status = "paid";
        booking.status = "completed";
        // Mirror cashback_applied onto booking for receipt UX
        booking.cashback_applied = Number(payment.cashback_applied || 0);
        await booking.save();
        emitPaymentSucceeded(payment, booking);

        // Spend cashback (deduct from user balance)
        try {
          if (payment.cashback_applied > 0) {
            await spendCashback(
              booking.customer_id?._id || booking.customer_id,
              Number(payment.cashback_applied),
            );
          }
        } catch (err) {
          console.error("[cashback] spend failed:", err.message);
        }

        // Award cashback (tier-based, on actually-paid amount)
        try {
          await awardCashback(
            booking.customer_id?._id || booking.customer_id,
            Number(payment.amount || 0),
            booking._id,
          );
        } catch (err) {
          console.error("[cashback] award failed:", err.message);
        }

        // Send receipt email
        const customer = booking.customer_id;
        if (customer && customer.email) {
          await sendPaymentReceipt({
            to: customer.email,
            customerName: customer.full_name,
            serviceName: booking.service_id?.service_name,
            providerName: booking.provider_id?.full_name,
            amount: payment.amount,
            bookingDate: booking.date,
            bookingTime: booking.time,
            paymentId: String(payment._id).slice(-8).toUpperCase(),
            bookingId: String(booking._id).slice(-8).toUpperCase(),
          });
        }
      }

      return res.json({
        message: "Payment success",
        payment,
        booking,
        booking_id: booking?._id,
        service_name: booking?.service_id?.service_name || "",
        provider_name: booking?.provider_id?.full_name || "",
        customer_email: booking?.customer_id?.email || "",
        booking_date: booking?.date || "",
        booking_time: booking?.time || "",
      });
    }

    if (intent.status === "requires_payment_method" || intent.status === "canceled") {
      payment.status = "failed";
      await payment.save();

      const booking = await Booking.findById(payment.booking_id);
      if (booking) {
        booking.payment_status = "failed";
        await booking.save();
        emitPaymentFailed(payment);
      }

      return res.status(400).json({ message: "Payment failed", payment });
    }

    // Still processing
    return res.json({
      message: "Payment processing",
      payment,
      stripe_status: intent.status,
    });
  } catch (e) {
    console.error("confirmPayment error:", e);
    return res.status(500).json({ message: e.message });
  }
}

/**
 * POST /api/payments/webhook
 * Stripe sends events here when payments succeed/fail
 * MUST verify signature - CRITICAL for security
 * MUST use raw body (not parsed JSON) - configured in routes
 */
export async function stripeWebhook(req, res) {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res.status(400).json({ message: "Missing stripe-signature header" });
  }

  let event;
  try {
    // req.body is raw Buffer here (express.raw middleware)
    event = verifyWebhookSignature(req.body, signature);
  } catch (err) {
    console.error("⚠️  Webhook signature verification failed:", err.message);
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  console.log(`✅ Stripe webhook: ${event.type}`);

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        const payment = await Payment.findOne({
          stripe_payment_intent_id: intent.id,
        });

        if (!payment) {
          console.warn(`Payment not found for intent: ${intent.id}`);
          break;
        }

        if (payment.status === "paid") {
          break;
        }

        payment.status = "paid";
        payment.transaction_ref = intent.id;
        payment.paid_at = new Date();
        await payment.save();

        const booking = await Booking.findById(payment.booking_id)
          .populate("customer_id", "full_name email")
          .populate("service_id", "service_name")
          .populate("provider_id", "full_name");

        if (booking) {
          booking.payment_status = "paid";
          booking.status = "completed";
          booking.cashback_applied = Number(payment.cashback_applied || 0);
          await booking.save();
          emitPaymentSucceeded(payment, booking);

          // Spend cashback (deduct from user balance)
          try {
            if (payment.cashback_applied > 0) {
              await spendCashback(
                booking.customer_id?._id || booking.customer_id,
                Number(payment.cashback_applied),
              );
            }
          } catch (err) {
            console.error("[cashback] spend failed:", err.message);
          }

          // Award cashback (tier-based)
          try {
            await awardCashback(
              booking.customer_id?._id || booking.customer_id,
              Number(payment.amount || 0),
              booking._id,
            );
          } catch (err) {
            console.error("[cashback] award failed:", err.message);
          }

          // Send receipt email
          const customer = booking.customer_id;
          if (customer && customer.email) {
            await sendPaymentReceipt({
              to: customer.email,
              customerName: customer.full_name,
              serviceName: booking.service_id?.service_name,
              providerName: booking.provider_id?.full_name,
              amount: payment.amount,
              bookingDate: booking.date,
              bookingTime: booking.time,
              paymentId: String(payment._id).slice(-8).toUpperCase(),
              bookingId: String(booking._id).slice(-8).toUpperCase(),
            });
          }
        }

        console.log(`💰 Payment succeeded: ${payment._id}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        const payment = await Payment.findOne({
          stripe_payment_intent_id: intent.id,
        });

        if (!payment) break;

        payment.status = "failed";
        await payment.save();

        const booking = await Booking.findById(payment.booking_id);
        if (booking) {
          booking.payment_status = "failed";
          await booking.save();
          emitPaymentFailed(payment);
        }

        console.log(`❌ Payment failed: ${payment._id}`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const intentId = charge.payment_intent;
        const payment = await Payment.findOne({
          stripe_payment_intent_id: intentId,
        });

        if (!payment) break;
        if (payment.status === "refunded") break;

        payment.status = "refunded";
        payment.refunded_at = new Date();
        await payment.save();

        await Booking.updateOne(
          { _id: payment.booking_id },
          { $set: { payment_status: "refunded", status: "cancelled" } }
        );

        emitPaymentRefunded(payment);

        // 🔍 Audit log — refund happened
        await logAction(req, "PAYMENT_REFUND", "payment", payment._id, {
          amount: payment.amount,
          intentId: intentId,
          via: "stripe_webhook",
        });

        console.log(`↩️  Payment refunded: ${payment._id}`);
        break;
      }

      default:
        // Unhandled event type - this is fine, just log
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ message: err.message });
  }
}

export async function myPayments(req, res) {
  try {
    const userId = req.user.id;
    const payments = await Payment.find({ customer_id: userId })
      .sort({ createdAt: -1 })
      .populate("booking_id", "date time status payment_status total_amount currency")
      .populate("provider_id", "full_name email")
      .lean();

    return res.json({ payments });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

/**
 * Admin refund - calls Stripe API to refund the charge
 * Webhook will fire `charge.refunded` and update DB
 */
export async function adminRefundDemoPayment(req, res) {
  try {
    if (!stripe) {
      return res.status(503).json({ message: "Payment service not configured" });
    }
    const adminId = req.user.id;
    const { payment_id } = req.params;
    if (!isValidObjectId(payment_id)) {
      return res.status(400).json({ message: "Invalid payment_id" });
    }
    const admin = await User.findById(adminId).select("_id role");
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Only admin can refund" });
    }
    const payment = await Payment.findById(payment_id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.status !== "paid") {
      return res.status(400).json({ message: "Only paid payments can be refunded" });
    }
    if (!payment.stripe_payment_intent_id) {
      return res.status(400).json({ message: "Payment has no Stripe intent" });
    }
    // Issue refund through Stripe
    const refund = await refundPayment(payment.stripe_payment_intent_id);
    // Webhook will fire `charge.refunded` and update DB.
    // We optimistically update here too for immediate response.
    payment.status = "refunded";
    payment.refunded_at = new Date();
    await payment.save();
    await Booking.updateOne(
      { _id: payment.booking_id },
      { $set: { payment_status: "refunded", status: "cancelled" } }
    );
    emitPaymentRefunded(payment);

    // 🔍 Audit log — admin manually issued refund
    await logAction(req, "PAYMENT_REFUND", "payment", payment._id, {
      amount: payment.amount,
      currency: payment.currency || "USD",
      stripe_refund_id: refund.id,
      booking_id: payment.booking_id,
    });

    return res.json({
      message: "Refund issued via Stripe",
      payment,
      stripe_refund_id: refund.id,
    });
  } catch (e) {
    console.error("refund error:", e);
    return res.status(500).json({ message: e.message });
  }
}