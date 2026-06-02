export const POLICY_TIERS = {
    FULL_REFUND: "full_refund",
    PARTIAL_REFUND: "partial_refund",
    NO_REFUND: "no_refund",
    PROVIDER_CANCELLED: "provider_cancelled",
    ADMIN_CANCELLED: "admin_cancelled",
};

export const POLICY_RULES = {
    FULL_REFUND_HOURS: 24,
    PARTIAL_REFUND_HOURS: 12,
    PARTIAL_REFUND_PCT: 50,
};

export function hoursUntilBooking(date, time) {
    if (!date || !time) return 0;
    const dt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(dt.getTime())) return 0;
    const diffMs = dt.getTime() - Date.now();
    return diffMs / (1000 * 60 * 60);
}

export function computeCancellationOutcome(booking, role) {
    const total = Number(booking.total_amount || 0);
    const isPaid = booking.payment_status === "paid";
    const hours = hoursUntilBooking(booking.date, booking.time);

    // Provider or admin cancellation -> always full refund
    if (role === "provider") {
        return {
            policy_applied: POLICY_TIERS.PROVIDER_CANCELLED,
            refund_pct: 100,
            refund_amount: isPaid ? total : 0,
            hours_remaining: hours,
            reason_label: "Provider cancelled — full refund issued",
        };
    }
    if (role === "admin") {
        return {
            policy_applied: POLICY_TIERS.ADMIN_CANCELLED,
            refund_pct: 100,
            refund_amount: isPaid ? total : 0,
            hours_remaining: hours,
            reason_label: "Admin cancelled — full refund issued",
        };
    }

    if (hours >= POLICY_RULES.FULL_REFUND_HOURS) {
        return {
            policy_applied: POLICY_TIERS.FULL_REFUND,
            refund_pct: 100,
            refund_amount: isPaid ? total : 0,
            hours_remaining: hours,
            reason_label: `Cancelled ${POLICY_RULES.FULL_REFUND_HOURS}+ hours in advance — full refund`,
        };
    }
    if (hours >= POLICY_RULES.PARTIAL_REFUND_HOURS) {
        const refund = Math.round((total * POLICY_RULES.PARTIAL_REFUND_PCT) / 100 * 100) / 100;
        return {
            policy_applied: POLICY_TIERS.PARTIAL_REFUND,
            refund_pct: POLICY_RULES.PARTIAL_REFUND_PCT,
            refund_amount: isPaid ? refund : 0,
            hours_remaining: hours,
            reason_label: `Cancelled within ${POLICY_RULES.FULL_REFUND_HOURS} hours — ${POLICY_RULES.PARTIAL_REFUND_PCT}% refund`,
        };
    }
    return {
        policy_applied: POLICY_TIERS.NO_REFUND,
        refund_pct: 0,
        refund_amount: 0,
        hours_remaining: hours,
        reason_label: `Cancelled within ${POLICY_RULES.PARTIAL_REFUND_HOURS} hours — no refund`,
    };
}

export function getPolicyDescription() {
    return {
        tiers: [
            {
                label: `${POLICY_RULES.FULL_REFUND_HOURS}+ hours before`,
                refund: "100% refund",
                tier: POLICY_TIERS.FULL_REFUND,
            },
            {
                label: `${POLICY_RULES.PARTIAL_REFUND_HOURS}-${POLICY_RULES.FULL_REFUND_HOURS} hours before`,
                refund: `${POLICY_RULES.PARTIAL_REFUND_PCT}% refund`,
                tier: POLICY_TIERS.PARTIAL_REFUND,
            },
            {
                label: `Less than ${POLICY_RULES.PARTIAL_REFUND_HOURS} hours`,
                refund: "No refund",
                tier: POLICY_TIERS.NO_REFUND,
            },
        ],
        notes: [
            "If the provider cancels, you receive a full refund regardless of timing.",
            "Refunds are processed back to your original payment method within 3-5 business days.",
        ],
    };
}
