import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
    listSavedAddresses,
    addSavedAddress,
    deleteSavedAddress,
    setPrimaryAddress,
    listFavorites,
    addFavorite,
    removeFavorite,
} from "../controllers/customer.controller.js";

const router = express.Router();

router.get("/saved-addresses", requireAuth, requireRole("customer", "admin"), listSavedAddresses);
router.post("/saved-addresses", requireAuth, requireRole("customer", "admin"), addSavedAddress);
router.delete("/saved-addresses/:addressId", requireAuth, requireRole("customer", "admin"), deleteSavedAddress);
router.patch("/saved-addresses/:addressId/primary", requireAuth, requireRole("customer", "admin"), setPrimaryAddress);
router.get("/favorites", requireAuth, requireRole("customer", "admin"), listFavorites);
router.post("/favorites/:providerId", requireAuth, requireRole("customer", "admin"), addFavorite);
router.delete("/favorites/:providerId", requireAuth, requireRole("customer", "admin"), removeFavorite);

export default router;