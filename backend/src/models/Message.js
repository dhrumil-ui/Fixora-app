import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
            index: true,
        },

        // Who sent it (customer or provider)
        sender_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // Convenience: who should receive (for unread queries)
        recipient_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        body: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000,
        },

        // Read receipts
        read_at: { type: Date, default: null }, // null = unread
    },
    { timestamps: true },
);

// Compound index for fast unread lookups per recipient + booking
messageSchema.index({ recipient_id: 1, read_at: 1 });
messageSchema.index({ booking_id: 1, createdAt: 1 });

export const Message =
    mongoose.models.Message || mongoose.model("Message", messageSchema);