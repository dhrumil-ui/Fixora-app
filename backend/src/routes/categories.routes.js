import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategory,
} from "../controllers/categories.controller.js";

const router = express.Router();

router.get("/", listCategories);
router.post("/", requireAuth, requireRole("admin"), createCategory);
router.patch("/:id", requireAuth, requireRole("admin"), updateCategory);
router.delete("/:id", requireAuth, requireRole("admin"), deleteCategory);
router.patch("/:id/toggle", requireAuth, requireRole("admin"), toggleCategory);

export default router;