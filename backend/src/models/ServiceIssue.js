import mongoose from "mongoose";

const serviceIssueSchema = new mongoose.Schema(
    {
        booking_id: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
        customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        provider_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        service_id: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
        issue_type: {
            type: String,
            enum: ["no_show", "poor_quality", "damage", "overcharge", "rude_behavior", "incomplete_work", "other"],
            required: true,
        },
        description: { type: String, required: true, maxlength: 2000 },
        status: { type: String, enum: ["open", "in_review", "resolved", "closed"], default: "open" },
        admin_notes: { type: String, default: "" },
        provider_response: { type: String, default: "" },
        provider_responded_at: { type: Date },
        refund_requested: { type: Boolean, default: false },
        refund_reason: { type: String, default: "" },
    },
    { timestamps: true }
);

export const ServiceIssue = mongoose.model("ServiceIssue", serviceIssueSchema);