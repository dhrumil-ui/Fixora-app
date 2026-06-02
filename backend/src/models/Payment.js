import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
            index: true,
        },
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        provider_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        amount: { type: Number, required: true },
        currency: { type: String, default: "USD" },

        // method: {
        //     type: String,
        //     enum: ["card_demo", "apple_pay_demo", "zelle_demo"],
        //     required: true,
        // },

        method: { type: String, enum: ["card", "cash", "card_demo", "apple_pay_demo", "zelle_demo"], required: true, index: true },

        status: {
            type: String,
            enum: ["initiated", "paid", "failed", "refunded"],
            default: "initiated",
            index: true,
        },

        transaction_ref: {
            type: String,
            unique: true,
            // Only index docs that actually have a string value (not null, not missing).
            // Prevents E11000 dup-key on multiple "initiated" payments.
            partialFilterExpression: { transaction_ref: { $type: "string" } },
        },

        paid_at: { type: Date, default: null },
        refunded_at: { type: Date, default: null },

        stripe_payment_intent_id: { type: String, default: null, index: true },
        cashback_applied: { type: Number, default: 0, min: 0 },
    },
    { timestamps: true }
);



export const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);