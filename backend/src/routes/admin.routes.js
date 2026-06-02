// src/routes/admin.routes.js — REPLACE entire file with this
import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
    listProviders, updateProviderStatus, approveProvider, rejectProvider,
    listUsers, listAllUsers, reactivateUser,
    listServices, toggleService,
    listAllBookings, updateBookingStatus,
    listAllPayments,
    getAdminStats,
    getCommissionReport,
    getDashboardInsights,
    getAuditLogs,
    getAuditLogActions,
} from "../controllers/admin.controller.js";

const router = express.Router();

router.get("/providers", requireAuth, requireRole("admin"), listProviders);
router.patch("/providers/:id/status", requireAuth, requireRole("admin"), updateProviderStatus);
router.patch("/providers/:id/approve", requireAuth, requireRole("admin"), approveProvider);
router.patch("/providers/:id/reject", requireAuth, requireRole("admin"), rejectProvider);
router.get("/users", requireAuth, requireRole("admin"), listUsers);
router.get("/all-users", requireAuth, requireRole("admin"), listAllUsers);
router.patch("/users/:id/reactivate", requireAuth, requireRole("admin"), reactivateUser);
router.get("/services", requireAuth, requireRole("admin"), listServices);
router.patch("/services/:id/toggle", requireAuth, requireRole("admin"), toggleService);
router.get("/bookings", requireAuth, requireRole("admin"), listAllBookings);
router.patch("/bookings/:id/status", requireAuth, requireRole("admin"), updateBookingStatus);
router.get("/payments", requireAuth, requireRole("admin"), listAllPayments);
router.get("/stats", requireAuth, requireRole("admin"), getAdminStats);
router.get("/commission-report", requireAuth, requireRole("admin"), getCommissionReport);
router.get("/dashboard-insights", requireAuth, requireRole("admin"), getDashboardInsights);

// NEW: Audit logs
router.get("/audit-logs", requireAuth, requireRole("admin"), getAuditLogs);
router.get("/audit-logs/actions", requireAuth, requireRole("admin"), getAuditLogActions);

export default router;
