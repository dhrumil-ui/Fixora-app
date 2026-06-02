import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
    generateBio,
    chatSupport,
    analyzeIssueEndpoint,
} from "../controllers/ai.controller.js";
import { smartSearchEndpoint } from "../controllers/ai.controller.js";

const router = express.Router();
router.post("/provider/bio", requireAuth, requireRole("provider"), generateBio);
router.post("/chat", chatSupport);
router.post("/smart-search", smartSearchEndpoint);
router.post(
    "/admin/analyze-issue",
    requireAuth,
    requireRole("admin"),
    analyzeIssueEndpoint
);

export default router;