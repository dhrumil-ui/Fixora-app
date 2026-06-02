import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createDemoPaymentIntent, confirmDemoPayment, myPayments } from "../controllers/payments.controller.js";

const router = express.Router();

router.post("/intent", requireAuth, requireRole("customer"), createDemoPaymentIntent);
router.post("/confirm", requireAuth, requireRole("customer"), confirmDemoPayment);
router.get("/my", requireAuth, requireRole("customer"), myPayments);

export default router;