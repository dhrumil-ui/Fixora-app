import { Router } from "express";
import {
    register,
    login,
    verifyEmailLink,
    logout,
    me,
    deactivateAccount,
    forgotPassword,
    resetPassword,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.post("/register", strictLimiter, register);
router.post("/login", strictLimiter, login);
router.get("/verify-link", verifyEmailLink);
router.get("/me", requireAuth, me);
router.post("/logout", logout);
router.post("/deactivate", requireAuth, deactivateAccount);
router.post("/forgot-password", strictLimiter, forgotPassword);
router.post("/reset-password", strictLimiter, resetPassword);

export default router;