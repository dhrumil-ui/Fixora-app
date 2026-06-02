import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
    createService,
    listServices,
    myProviderServices,
    updateMyService,
    toggleMyService,
    deleteMyService,
} from "../controllers/services.controller.js";

const router = express.Router();

router.get("/", listServices);
router.post("/", requireAuth, requireRole("provider", "admin"), createService);
router.get("/my", requireAuth, requireRole("provider", "admin"), myProviderServices);
router.patch("/my/:id", requireAuth, requireRole("provider", "admin"), updateMyService);
router.patch("/my/:id/toggle", requireAuth, requireRole("provider", "admin"), toggleMyService);
router.delete("/my/:id", requireAuth, requireRole("provider", "admin"), deleteMyService);

export default router;