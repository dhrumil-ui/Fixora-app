import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createIssue, getAllIssues, updateIssueStatus, myIssues } from "../controllers/issues.controller.js";
import { providerIssues } from "../controllers/issues.controller.js";
import { providerRespondToIssue } from "../controllers/issues.controller.js";
import { requestRefund } from "../controllers/issues.controller.js";

const router = express.Router();

router.post("/", requireAuth, createIssue);
router.get("/my", requireAuth, myIssues);
router.get("/", requireAuth, requireRole("admin"), getAllIssues);
router.get("/provider", requireAuth, requireRole("provider"), providerIssues);
router.patch("/:id", requireAuth, requireRole("admin"), updateIssueStatus);
router.patch("/:id/respond", requireAuth, requireRole("provider"), providerRespondToIssue);
router.patch("/:id/refund-request", requireAuth, requestRefund);

export default router;