// backend/src/routes/messages.routes.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
    listMessages,
    sendMessage,
    markRead,
    unreadCounts,
    adminListConversations,
    adminViewConversation,
} from "../controllers/messages.controller.js";

const router = express.Router();

// All routes require auth
router.use(requireAuth);

// Unread counts (badge data) — must come BEFORE :bookingId routes
router.get("/unread-counts", unreadCounts);

// Per-booking chat (customer or provider)
router.get("/:bookingId", listMessages);
router.post("/:bookingId", sendMessage);
router.patch("/:bookingId/read", markRead);

export default router;

// Admin moderation routes (mounted separately under /api/admin)
export const adminRouter = express.Router();
adminRouter.use(requireAuth);
adminRouter.get("/conversations", adminListConversations);
adminRouter.get("/conversations/:bookingId", adminViewConversation);