import { Booking } from "../models/Booking.js";
import { User } from "../models/Users.js";

export function getCashbackRate(lifetimeSpent) {
    if (lifetimeSpent >= 2000) return 0.08;
    if (lifetimeSpent >= 500) return 0.05;
    return 0;
}

export function getCashbackTier(lifetimeSpent) {
    if (lifetimeSpent >= 2000) return "Champion 💎";
    if (lifetimeSpent >= 500) return "VIP 🥇";
    return "Member";
}

/**
 * Award cashback to a customer after a paid booking.
 * Uses lifetime paid spend (incl. this booking) to pick tier.
 * Returns the amount awarded (0 if no tier match).
 */
export async function awardCashback(customerId, paidAmount, bookingId) {
    if (!customerId || !paidAmount || paidAmount <= 0) return 0;

    // Lifetime spend including this booking (just-paid amount included via DB read)
    const agg = await Booking.aggregate([
        { $match: { customer_id: customerId, payment_status: "paid" } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
    ]);
    const lifetimeSpent = agg[0]?.total || 0;

    const rate = getCashbackRate(lifetimeSpent);
    if (rate === 0) return 0;

    const earned = Math.round(paidAmount * rate * 100) / 100;
    if (earned <= 0) return 0;

    await User.updateOne(
        { _id: customerId },
        {
            $inc: {
                cashback_balance: earned,
                cashback_total_earned: earned,
            },
        },
    );

    // Stamp the booking with how much cashback was earned (for receipt UX)
    if (bookingId) {
        await Booking.updateOne(
            { _id: bookingId },
            { $set: { cashback_earned: earned } },
        );
    }
    return earned;
}

/**
 * Deduct cashback from a customer's balance (called when applying at payment).
 * Caps at available balance. Returns the actual deducted amount.
 */
export async function spendCashback(customerId, requestedAmount) {
    if (!customerId || !requestedAmount || requestedAmount <= 0) return 0;
    const user = await User.findById(customerId).select("cashback_balance");
    if (!user) return 0;
    const available = Number(user.cashback_balance || 0);
    const toSpend = Math.min(available, Number(requestedAmount));
    if (toSpend <= 0) return 0;

    await User.updateOne(
        { _id: customerId },
        {
            $inc: {
                cashback_balance: -toSpend,
                cashback_total_spent: toSpend,
            },
        },
    );
    return toSpend;
}