// backend/src/routes/payments.routes.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createDemoPaymentIntent,
  confirmDemoPayment,
  myPayments,
  adminRefundDemoPayment,
  stripeWebhook,
} from "../controllers/payments.controller.js";

const router = express.Router();

// IMPORTANT: webhook MUST come BEFORE express.json() and use raw body
// This route is mounted as POST /api/payments/webhook in server.js
// The raw body middleware is applied directly here
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// All other routes need authentication and parse JSON normally
router.post("/intent", requireAuth, createDemoPaymentIntent);
router.post("/confirm", requireAuth, confirmDemoPayment);
router.get("/my", requireAuth, myPayments);
router.post("/:payment_id/refund", requireAuth, adminRefundDemoPayment);

export default router;
