import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/Users.js";

export async function logAction(
  req,
  action,
  targetType = null,
  targetId = null,
  details = {},
) {
  try {
    const actorId = req?.user?._id || req?.user?.id;
    if (!actorId) {
      console.warn("[audit] no user.id — skipping:", action);
      return;
    }

    // ✅ Fetch email from DB if not in JWT
    let actorEmail = req.user.email;
    let actorRole = req.user.role || "admin";
    if (!actorEmail) {
      const u = await User.findById(actorId).select("email role").lean();
      if (u) {
        actorEmail = u.email;
        actorRole = u.role || actorRole;
      }
    }

    await AuditLog.create({
      actor_id: actorId,
      actor_email: actorEmail || "unknown",
      actor_role: actorRole,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details || {},
      ip_address: req.ip || req.headers["x-forwarded-for"] || null,
      user_agent: req.headers["user-agent"] || null,
    });

    console.log(`📋 Audit logged: ${action} by ${actorEmail || "unknown"}`);
  } catch (err) {
    console.error("Audit log error:", err.message);
  }
}