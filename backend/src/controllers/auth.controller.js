import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { User } from "../models/Users.js";
import { sendEmail } from "../utils/mailer.js";
import * as userService from "../services/user.service.js";
import { emitNewUser } from "../socket/emitters.js";

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

function makeVerifyToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

function buildVerifyUrl(email, token) {
  const base = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  return `${base}/verify-email?token=${encodeURIComponent(
    token,
  )}&email=${encodeURIComponent(email)}`;
}

async function sendVerifyLinkEmail({ to, verifyUrl, minutes, isResend }) {
  const subject = isResend
    ? "Verify your Fixora account (link resent)"
    : "Verify your Fixora account";

  const html = `
    <h2>Verify your Fixora email</h2>
    <p>Please click this link to verify your email:</p>
    <p><a href="${verifyUrl}">Verify Email</a></p>
    <p>This link expires in ${minutes} minutes.</p>
  `;

  const text = `Verify Email: ${verifyUrl} (expires in ${minutes} minutes)`;

  await sendEmail({ to, subject, html, text });
}

// -------------------------
// controllers
// -------------------------

// Signup (email verification ONLY by link)
export async function register(req, res) {
  try {
    const { full_name, email, phone, password, role } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const emailLower = String(email).toLowerCase();

    // If user exists
    const exists = await userService.getUserByEmail(emailLower);
    if (exists) {
      // already verified => normal error
      if (exists.is_email_verified) {
        return res
          .status(409)
          .json({ message: "Email already registered. Please login." });
      }

      // not verified => resend new link (do NOT create new user)
      const mins = Number(process.env.VERIFY_LINK_EXPIRES_MIN || 60);
      const { token, tokenHash } = makeVerifyToken();
      const expiresAt = new Date(Date.now() + mins * 60 * 1000);

      await userService.setVerifyLink(exists._id, tokenHash, expiresAt);

      const verifyUrl = buildVerifyUrl(exists.email, token);
      await sendVerifyLinkEmail({
        to: exists.email,
        verifyUrl,
        minutes: mins,
        isResend: true,
      });

      return res.status(200).json({
        message:
          "Account already created but not verified. New verification link sent to your email.",
        user: {
          id: exists._id,
          email: exists.email,
          role: exists.role,
          is_email_verified: false,
        },
      });
    }

    // Create new user (service layer)
    const user = await userService.createUser({
      full_name,
      email: emailLower,
      phone,
      password,
      role,
    });

    // Emit new user event for admin live feed
    emitNewUser(user);

    // Create verify link
    const mins = Number(process.env.VERIFY_LINK_EXPIRES_MIN || 60);
    const { token, tokenHash } = makeVerifyToken();
    const expiresAt = new Date(Date.now() + mins * 60 * 1000);

    await userService.setVerifyLink(user._id, tokenHash, expiresAt);

    const verifyUrl = buildVerifyUrl(user.email, token);

    await sendVerifyLinkEmail({
      to: user.email,
      verifyUrl,
      minutes: mins,
      isResend: false,
    });

    return res.status(201).json({
      message: "Registered. Verification link sent to your email.",
      user: {
        id: user._id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_email_verified: user.is_email_verified,
      },
    });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return res.status(500).json({ message: e.message });
  }
}

export async function deactivateAccount(req, res) {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required to deactivate account" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: "Incorrect password" });

    user.is_active = false;
    user.deactivated_at = new Date();
    await user.save();

    res.clearCookie("fixora_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    return res.json({ message: "Account deactivated successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// Verify email by link (GET /api/auth/verify-link?email=...&token=...)
export async function verifyEmailLink(req, res) {
  try {
    const { token, email } = req.query;
    if (!token || !email) {
      return res.status(400).json({ message: "Missing token/email" });
    }

    const user = await userService.getUserByEmail(String(email));
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.is_email_verified) {
      return res.json({ message: "Email already verified ✅ You can login now." });
    }

    if (!user.email_verify_expires_at || user.email_verify_expires_at < new Date()) {
      return res
        .status(400)
        .json({ message: "Verification link expired. Please signup again (it will resend a new link)." });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");

    if (!user.email_verify_token_hash || tokenHash !== user.email_verify_token_hash) {
      return res.status(400).json({ message: "Invalid verification link" });
    }

    await userService.markEmailVerified(user._id);

    return res.json({ message: "Email verified ✅ You can login now." });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await userService.getUserByEmail(String(email));
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (role && user.role !== role) {
      return res.status(401).json({ message: "Role mismatch" });
    }

    if (user.is_active === false) {
      return res.status(403).json({
        message: "Your account has been deactivated. Please contact admin to reactivate your account.",
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    const ok = await userService.comparePassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.is_email_verified) {
      return res.status(403).json({
        message: "Email not verified. Please check your email and click the verification link.",
      });
    }

    const token = signToken(user);

    res.cookie("fixora_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
      message: "Login success",
      user: {
        id: user._id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function me(req, res) {
  const user = await User.findById(req.user.id).select(
    "full_name email role provider_status is_profile_complete cashback_balance cashback_total_earned cashback_total_spent",
  );
  if (!user) return res.status(401).json({ message: "Not logged in" });
  return res.json({ user });
}

export async function logout(req, res) {
  res.clearCookie("fixora_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
  return res.json({ message: "Logged out" });
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await userService.getUserByEmail(String(email).toLowerCase());
    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: "If that email exists, a reset link has been sent." });

    const mins = 30;
    const { token, tokenHash } = makeVerifyToken();
    const expiresAt = new Date(Date.now() + mins * 60 * 1000);

    user.reset_password_token_hash = tokenHash;
    user.reset_password_expires_at = expiresAt;
    await user.save();

    const base = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;

    await sendEmail({
      to: user.email,
      subject: "Fixora: Reset your password",
      html: `
        <h2>Reset your Fixora password</h2>
        <p>Click the link below to reset your password. This link expires in ${mins} minutes.</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>If you didn't request this, ignore this email.</p>
      `,
      text: `Reset your password: ${resetUrl} (expires in ${mins} minutes)`,
    });

    return res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, email, password } = req.body;
    if (!token || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const user = await userService.getUserByEmail(String(email).toLowerCase());
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.reset_password_expires_at || user.reset_password_expires_at < new Date()) {
      return res.status(400).json({ message: "Reset link expired. Please request a new one." });
    }

    const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
    if (tokenHash !== user.reset_password_token_hash) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    const bcrypt = await import("bcrypt");
    user.password_hash = await bcrypt.hash(password, 10);
    user.reset_password_token_hash = null;
    user.reset_password_expires_at = null;
    await user.save();

    return res.json({ message: "Password reset successfully. You can now login." });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}