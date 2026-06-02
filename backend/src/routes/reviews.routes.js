import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
    createReview,
    getProviderReviews,
    checkReview,
    getAllReviews,
    toggleReview,
    deleteReview,
    updateReview,
} from "../controllers/reviews.controller.js";

const router = express.Router();

router.post("/", requireAuth, createReview);
router.get("/provider/:providerId", getProviderReviews);
router.get("/check/:bookingId", requireAuth, checkReview);
// router.get("/", requireAuth, requireRole("admin"), getAllReviews);
router.get("/", getAllReviews);
router.patch("/:id/toggle", requireAuth, requireRole("admin"), toggleReview);
router.delete("/:id", requireAuth, requireRole("admin"), deleteReview);
router.put("/:id", requireAuth, updateReview);

export default router;