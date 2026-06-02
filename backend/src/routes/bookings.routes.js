import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
    createBooking,
    myBookings,
    cancelBooking,
    cancellationPreview,
    payCashBooking,
    providerBookings,
    providerUpdateBookingStatus,
    requestReschedule,
    customerRescheduleDecision,
    providerCompleteBooking,
    providerCompleteWork,
    approveReschedule,
    rejectReschedule,
    getBookingById,
    requestTravelFee,
    respondTravelFee,
    getCustomerHistory,
    createUrgentBooking,
    acceptUrgentBooking,
    passUrgentBooking,
} from "../controllers/bookings.controller.js";

const router = express.Router();

router.post("/", requireAuth, requireRole("customer", "provider", "admin"), createBooking);
router.get("/my", requireAuth, requireRole("customer", "provider", "admin"), myBookings);
router.patch("/:id/cancel", requireAuth, requireRole("customer", "provider", "admin"), cancelBooking);
router.get("/:id/cancellation-preview", requireAuth, requireRole("customer", "provider", "admin"), cancellationPreview);
router.post("/:id/pay-cash", requireAuth, requireRole("customer", "admin"), payCashBooking);
router.get("/provider", requireAuth, requireRole("provider", "admin"), providerBookings);
router.patch("/:id/status", requireAuth, requireRole("provider", "admin"), providerUpdateBookingStatus);
router.patch("/:id/reschedule", requireAuth, requestReschedule);
router.patch("/:id/reschedule/decision", requireAuth, requireRole("customer", "admin"), customerRescheduleDecision);
router.patch("/:id/reschedule/approve", requireAuth, approveReschedule);
router.patch("/:id/reschedule/reject", requireAuth, rejectReschedule);
router.patch("/:id/complete", requireAuth, requireRole("provider", "admin"), providerCompleteBooking, providerCompleteWork);
router.get("/:id", requireAuth, getBookingById);
router.post("/:id/travel-fee", requireAuth, requireRole("provider", "admin"), requestTravelFee);
router.patch("/:id/travel-fee", requireAuth, requireRole("customer", "admin"), respondTravelFee);
router.get("/:id", requireAuth, getBookingById);
router.get("/customer-history/:customerId", requireAuth, requireRole("provider", "admin"), getCustomerHistory);
router.post("/urgent", requireAuth, requireRole("customer", "provider", "admin"), createUrgentBooking);
router.post("/:id/urgent-accept", requireAuth, requireRole("provider", "admin"), acceptUrgentBooking);
router.post("/:id/urgent-pass", requireAuth, requireRole("provider", "admin"), passUrgentBooking);

export default router;