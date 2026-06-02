// src/models/AuditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor_email: { type: String, required: true },
    actor_role: { type: String, required: true, default: "admin" },

    action: { type: String, required: true, index: true },

    target_type: { type: String, default: null },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip_address: { type: String, default: null },
    user_agent: { type: String, default: null },
  },
  { timestamps: true },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor_id: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
