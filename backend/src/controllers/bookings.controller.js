import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { User } from "../models/Users.js";
import { Service } from "../models/Services.js";
import { Payment } from "../models/Payment.js";
import { sendEmail, sendPaymentReceipt } from "../utils/mailer.js";
import { ServiceIssue } from "../models/ServiceIssue.js";
import {
    emitBookingCreated,
    emitBookingAccepted,
    emitBookingRejected,
    emitBookingConfirmed,
    emitBookingCancelled,
    emitBookingWorkCompleted,
    emitBookingCompleted,
    emitRescheduleRequested,
    emitRescheduleApproved,
    emitRescheduleRejected,
    emitUrgentBroadcast,
    emitUrgentTaken,
    emitUrgentAccepted,
    emitPaymentSucceeded,
} from "../socket/emitters.js";
import { geocodeAddress, haversineMiles } from "../utils/geocode.js";
import { getIO, ROOMS } from "../socket/index.js";
import { awardCashback, spendCashback } from "../utils/cashback.js";
import {
    computeCancellationOutcome,
    getPolicyDescription,
} from "../utils/cancellationPolicy.js";

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function toFutureDateTimeOrNull(date, time) {
    const dt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(dt.getTime())) return null;
    if (dt.getTime() <= Date.now()) return null;
    return dt;
}

export const requestReschedule = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        const userId = String(req.user.id);
        const role = req.user.role;

        const customerId =
            typeof booking.customer_id === "object" && booking.customer_id?._id
                ? String(booking.customer_id._id)
                : String(booking.customer_id);

        const providerId =
            typeof booking.provider_id === "object" && booking.provider_id?._id
                ? String(booking.provider_id._id)
                : String(booking.provider_id);

        const isCustomerOwner = role === "customer" && customerId === userId;
        const isProviderOwner = role === "provider" && providerId === userId;

        if (!isCustomerOwner && !isProviderOwner) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const { date, time, reason } = req.body;

        if (!date || !time) {
            return res.status(400).json({ message: "Date and time are required" });
        }

        booking.reschedule = {
            requested: true,
            proposed_date: date,
            proposed_time: time,
            reason: reason || "",
            requested_by: role,
            previous_status: booking.status,
            decision: "pending",
        };

        booking.status = "reschedule_requested";

        await booking.save();
        emitRescheduleRequested(booking, role);

        return res.json({
            message: "Reschedule request submitted successfully",
            booking,
        });
    } catch (error) {
        console.error("requestReschedule error:", error);
        return res.status(500).json({ message: "Failed to reschedule booking" });
    }
};

export async function customerRescheduleDecision(req, res) {
    try {
        const customerId = req.user.id;
        const { id } = req.params;
        const { decision, message } = req.body;

        if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid booking id" });
        if (!["approve", "reject"].includes(String(decision))) return res.status(400).json({ message: "Invalid decision" });

        const customer = await User.findById(customerId).select("_id role");
        if (!customer || !["customer", "provider", "admin"].includes(customer.role)) {
            return res.status(403).json({ message: "Invalid user role" });
        }

        const booking = await Booking.findOne({ _id: id, customer_id: customerId })
            .populate("provider_id", "full_name email")
            .populate("service_id", "service_name");

        if (!booking) return res.status(404).json({ message: "Booking not found" });
        if (booking.status !== "reschedule_requested" || !booking.reschedule?.requested) {
            return res.status(400).json({ message: "No reschedule request for this booking" });
        }

        const provider =
            booking.provider_id && typeof booking.provider_id === "object" ? booking.provider_id : null;
        const service =
            booking.service_id && typeof booking.service_id === "object" ? booking.service_id : null;

        booking.reschedule.decided_at = new Date();
        booking.reschedule.customer_message = String(message || "");

        if (decision === "approve") {
            booking.date = booking.reschedule.proposed_date;
            booking.time = booking.reschedule.proposed_time;
            booking.status = "pending";
            booking.reschedule.requested = false;
            booking.reschedule.proposed_date = "";
            booking.reschedule.proposed_time = "";
        } else {
            const prev = booking.reschedule.previous_status || "confirmed";
            booking.status = prev;
            booking.reschedule.requested = false;
            booking.reschedule.proposed_date = "";
            booking.reschedule.proposed_time = "";
        }

        await booking.save();

        if (decision === "approve") {
            emitRescheduleApproved(booking);
        } else {
            emitRescheduleRejected(booking);
        }

        if (provider?.email) {
            const subject = `Fixora: Customer ${decision}d reschedule`;
            const body = `
Hi ${provider.full_name || "Provider"},

Customer has ${decision}d your reschedule request.

Service: ${service?.service_name || "Service"}
Booking: ${booking.date} ${booking.time}
Customer message: ${booking.reschedule.customer_message || "-"}

Fixora
`.trim();

            try {
                await sendEmail({ to: provider.email, subject, text: body });
            } catch (err) {
                return res.status(500).json({ message: err.message });
            }
        }

        return res.json({ message: "Decision saved", booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function createBooking(req, res) {
    try {
        const customerId = req.user.id;
        const { provider_id, service_id, date, time, address, notes } = req.body;

        if (!provider_id || !service_id || !date || !time || !address) {
            return res.status(400).json({ message: "Missing fields" });
        }

        if (!isValidObjectId(provider_id) || !isValidObjectId(service_id)) {
            return res.status(400).json({ message: "Invalid provider/service id" });
        }

        if (String(customerId) === String(provider_id)) {
            return res.status(400).json({ message: "You cannot book yourself" });
        }

        const dt = toFutureDateTimeOrNull(date, time);
        if (!dt) {
            return res.status(400).json({ message: "Invalid or past date/time" });
        }

        const customer = await User.findById(customerId).select("_id role");
        if (!customer || !["customer", "provider", "admin"].includes(customer.role)) {
            return res.status(403).json({ message: "Invalid user role" });
        }
        if (String(customerId) === String(provider_id)) {
            return res.status(400).json({ message: "You cannot book yourself" });
        }

        const provider = await User.findById(provider_id).select(
            "_id role is_profile_complete provider_status provider_profile",
        );

        if (!provider || provider.role !== "provider") {
            return res.status(404).json({ message: "Provider not found" });
        }

        if (!provider.is_profile_complete) {
            return res.status(400).json({ message: "Provider profile not completed" });
        }

        if (provider.provider_status !== "verified") {
            return res.status(403).json({ message: "Provider not verified" });
        }

        if (!provider.provider_profile?.is_available) {
            return res.status(403).json({ message: "Provider is not available" });
        }

        const service = await Service.findOne({
            _id: service_id,
            provider_id: provider_id,
            is_active: true,
        }).select("_id service_name category_id price");

        if (!service) {
            return res.status(404).json({ message: "Service not found or inactive" });
        }

        // 📍 Geocode service address (Signal 2 + 11 foundation)
        let service_geo = undefined;
        let formatted_address = undefined;
        let distance_miles = null;
        try {
            const geo = await geocodeAddress(address);
            if (geo) {
                service_geo = {
                    type: "Point",
                    coordinates: [geo.lng, geo.lat],
                };
                formatted_address = geo.formatted_address;

                // Calculate distance from provider's home (used for travel fee logic later)
                const providerGeo = provider.provider_profile?.home_geo?.coordinates;
                if (providerGeo && providerGeo.length === 2) {
                    distance_miles = Math.round(
                        haversineMiles([geo.lng, geo.lat], providerGeo) * 10
                    ) / 10;
                }
            }
        } catch (err) {
            console.warn("[booking geocode] failed (non-fatal):", err.message);
        }

        const booking = await Booking.create({
            customer_id: customerId,
            provider_id,
            service_id,
            date,
            time,
            address,
            notes,
            status: "pending",
            payment_status: "pending",
            total_amount: service.price,
            currency: "USD",
            service_geo,
            formatted_address,
            distance_miles,
        });

        emitBookingCreated(booking);

        return res.status(201).json({ message: "Booking created", booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function myBookings(req, res) {
    try {
        const userId = req.user.id;
        const { tab, page, search = "" } = req.query;

        const user = await User.findById(userId).select("_id role");
        if (!user || !["customer", "provider", "admin"].includes(user.role)) {
            return res.status(403).json({ message: "Invalid user role" });
        }

        if (!tab && !page) {
            const bookings = await Booking.find({ customer_id: userId })
                .sort({ createdAt: -1 })
                .populate("service_id", "service_name description price")
                .populate("provider_id", "full_name email phone provider_profile");
            return res.json({ bookings });
        }

        const PAGE_SIZE = 5;
        const skip = (Number(page || 1) - 1) * PAGE_SIZE;
        const activeStatuses = ["pending", "confirmed", "work_completed", "reschedule_requested"];
        const pastStatuses = ["completed", "cancelled"];

        const baseQuery = {
            customer_id: new mongoose.Types.ObjectId(String(userId)),
            status: { $in: tab === "active" ? activeStatuses : pastStatuses }
        };

        if (tab === "resolved" || tab === "past") {
            const resolvedIssues = await ServiceIssue.find({
                customer_id: userId, status: "resolved"
            }).select("booking_id").lean();
            const resolvedIds = resolvedIssues.map(i => new mongoose.Types.ObjectId(String(i.booking_id)));
            if (tab === "resolved") {
                baseQuery._id = { $in: resolvedIds };
            } else if (resolvedIds.length > 0) {
                baseQuery._id = { $nin: resolvedIds };
            }
        }

        const pipeline = [
            { $match: baseQuery },
            { $lookup: { from: "users", localField: "provider_id", foreignField: "_id", as: "provider_id", pipeline: [{ $project: { full_name: 1, email: 1, phone: 1, provider_profile: 1 } }] } },
            { $unwind: { path: "$provider_id", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$service_id", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$customer_id", preserveNullAndEmptyArrays: true } },
        ];

        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { "provider_id.full_name": { $regex: search, $options: "i" } },
                        { "service_id.service_name": { $regex: search, $options: "i" } },
                        { date: { $regex: search, $options: "i" } },
                        { address: { $regex: search, $options: "i" } },
                    ]
                }
            });
        }

        const countResult = await Booking.aggregate([...pipeline, { $count: "total" }]);
        const total = countResult[0]?.total || 0;
        pipeline.push({ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: PAGE_SIZE });
        const bookings = await Booking.aggregate(pipeline);

        return res.json({ bookings, total, page: Number(page || 1), totalPages: Math.ceil(total / PAGE_SIZE) });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function cancelBooking(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { reason = "" } = req.body || {};

        const user = await User.findById(userId).select("_id role");
        if (!user || !["customer", "provider", "admin"].includes(user.role)) {
            return res.status(403).json({ message: "Invalid user role" });
        }

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        // Authorization: customer can only cancel own; provider must be assigned; admin can cancel any
        const query = { _id: id };
        if (user.role === "customer") query.customer_id = userId;
        if (user.role === "provider") query.provider_id = userId;

        const booking = await Booking.findOne(query);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (booking.status === "cancelled") {
            return res.json({ message: "Already cancelled", booking });
        }

        if (booking.status === "completed") {
            return res.status(400).json({ message: "Completed booking cannot be cancelled" });
        }

        // Compute refund outcome based on policy
        const outcome = computeCancellationOutcome(booking, user.role);

        // Apply cancellation
        booking.status = "cancelled";
        booking.cancellation = {
            cancelled_by: user.role,
            cancelled_at: new Date(),
            reason: String(reason || "").trim().slice(0, 500),
            policy_applied: outcome.policy_applied,
            refund_pct: outcome.refund_pct,
            refund_amount: outcome.refund_amount,
            refund_status:
                outcome.refund_amount > 0
                    ? "pending"
                    : booking.payment_status === "paid"
                        ? "not_required"
                        : "not_required",
            hours_remaining_at_cancel: Number(outcome.hours_remaining.toFixed(2)),
        };

        // If refund is owed, mark payment_status accordingly so payments service can pick it up
        if (outcome.refund_amount > 0 && booking.payment_status === "paid") {
            booking.payment_status = "refunded";
        }

        await booking.save();
        emitBookingCancelled(booking);

        // Notify the other party by email (best-effort; do not block on failure)
        try {
            const otherPartyId =
                user.role === "customer" ? booking.provider_id : booking.customer_id;
            const otherParty = await User.findById(otherPartyId).select("email full_name");
            if (otherParty?.email) {
                const cancellerLabel =
                    user.role === "customer"
                        ? "The customer"
                        : user.role === "provider"
                            ? "The provider"
                            : "An administrator";
                const subject = `Fixora: Booking cancelled`;
                const body =
                    `${cancellerLabel} cancelled the booking scheduled for ${booking.date} at ${booking.time}.\n\n` +
                    (reason ? `Reason: ${reason}\n\n` : "") +
                    `Policy applied: ${outcome.reason_label}\n` +
                    (outcome.refund_amount > 0
                        ? `Refund amount: $${outcome.refund_amount.toFixed(2)}\n`
                        : "");
                await sendEmail({ to: otherParty.email, subject, text: body });
            }
        } catch {
            // Email failure should not fail the cancel itself
        }

        return res.json({
            message: "Booking cancelled",
            booking,
            cancellation: booking.cancellation,
        });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

/**
 * Returns a refund preview for a booking based on the current time and policy.
 * Used by the frontend before the user confirms cancellation.
 * GET /api/bookings/:id/cancellation-preview
 */
export async function cancellationPreview(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        const user = await User.findById(userId).select("_id role");
        if (!user) return res.status(403).json({ message: "Invalid user" });

        const query = { _id: id };
        if (user.role === "customer") query.customer_id = userId;
        if (user.role === "provider") query.provider_id = userId;

        const booking = await Booking.findOne(query);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (booking.status === "cancelled") {
            return res.status(400).json({
                message: "Already cancelled",
                cancellation: booking.cancellation,
            });
        }
        if (booking.status === "completed") {
            return res.status(400).json({ message: "Completed booking cannot be cancelled" });
        }

        const outcome = computeCancellationOutcome(booking, user.role);
        return res.json({
            booking_id: id,
            total_amount: Number(booking.total_amount || 0),
            payment_status: booking.payment_status,
            policy: getPolicyDescription(),
            preview: {
                policy_applied: outcome.policy_applied,
                refund_pct: outcome.refund_pct,
                refund_amount: outcome.refund_amount,
                hours_remaining: Number(outcome.hours_remaining.toFixed(2)),
                reason_label: outcome.reason_label,
            },
        });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

/**
 * Mark a booking as paid by cash. Creates Payment record, marks booking
 * paid+completed, emits socket, sends receipt email — same pipeline as card.
 * POST /api/bookings/:id/pay-cash
 */
export async function payCashBooking(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { apply_cashback } = req.body || {};

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        const booking = await Booking.findOne({ _id: id, customer_id: userId })
            .populate("customer_id", "full_name email cashback_balance")
            .populate("service_id", "service_name")
            .populate("provider_id", "full_name");

        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (booking.payment_status === "paid") {
            return res.status(400).json({ message: "Already paid" });
        }
        if (booking.status === "cancelled") {
            return res.status(400).json({ message: "Booking is cancelled" });
        }

        // Apply cashback (cap at user balance + booking total)
        const fullAmount = Number(booking.total_amount || 0);
        let cashbackToApply = 0;
        const requested = Math.max(0, Number(apply_cashback || 0));
        if (requested > 0) {
            const available = Number(booking.customer_id?.cashback_balance || 0);
            cashbackToApply = Math.min(requested, available, fullAmount);
            cashbackToApply = Math.round(cashbackToApply * 100) / 100;
        }
        const chargedAmount = Math.round((fullAmount - cashbackToApply) * 100) / 100;

        // Create Payment record (cash, paid)
        const payment = await Payment.create({
            booking_id: booking._id,
            customer_id: booking.customer_id?._id || booking.customer_id,
            provider_id: booking.provider_id?._id || booking.provider_id,
            amount: chargedAmount,
            currency: "USD",
            method: "cash",
            status: "paid",
            transaction_ref: `CASH-${Date.now()}`,
            paid_at: new Date(),
            cashback_applied: cashbackToApply,
        });

        // Update booking like card flow
        booking.payment_method = "cash";
        booking.payment_status = "paid";
        booking.status = "completed";
        booking.cashback_applied = cashbackToApply;
        await booking.save();

        // Spend cashback
        try {
            if (cashbackToApply > 0) {
                await spendCashback(
                    booking.customer_id?._id || booking.customer_id,
                    cashbackToApply,
                );
            }
        } catch (err) {
            console.error("[cashback] spend failed:", err.message);
        }

        // Award cashback to customer (tier-based, on charged amount)
        try {
            await awardCashback(
                booking.customer_id?._id || booking.customer_id,
                chargedAmount,
                booking._id,
            );
        } catch (err) {
            console.error("[cashback] award failed:", err.message);
        }

        // Emit socket
        try {
            emitPaymentSucceeded(payment, booking);
        } catch {
            /* ignore socket failures */
        }

        // Send receipt email
        try {
            const customer = booking.customer_id;
            if (customer && customer.email) {
                await sendPaymentReceipt({
                    to: customer.email,
                    customerName: customer.full_name,
                    serviceName: booking.service_id?.service_name,
                    providerName: booking.provider_id?.full_name,
                    amount: payment.amount,
                    bookingDate: booking.date,
                    bookingTime: booking.time,
                    paymentId: String(payment._id).slice(-8).toUpperCase(),
                    bookingId: String(booking._id).slice(-8).toUpperCase(),
                });
            }
        } catch {
            /* email failure non-fatal */
        }

        return res.json({
            message: "Cash payment recorded",
            payment,
            booking,
        });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function providerRequests(req, res) {
    try {
        const providerId = req.user.id;

        const user = await User.findById(providerId).select("_id role provider_status is_profile_complete");
        if (!user || user.role !== "provider") {
            return res.status(403).json({ message: "Only providers can view requests" });
        }

        const status = String(req.query.status || "pending");

        const allowed = ["pending", "accepted", "rejected", "cancelled", "completed", "all"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: "Invalid status filter" });
        }

        const query = { provider_id: providerId };
        if (status !== "all") query.status = status;

        const bookings = await Booking.find(query)
            .sort({ createdAt: -1 })
            .populate("service_id", "service_name description price")
            .populate("customer_id", "full_name email");

        return res.json({ bookings });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function acceptBooking(req, res) {
    try {
        const providerId = req.user.id;
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        const booking = await Booking.findOne({ _id: id, provider_id: providerId });
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (booking.status !== "pending") {
            return res.status(400).json({ message: `Cannot accept booking in status: ${booking.status}` });
        }

        booking.status = "accepted";
        await booking.save();
        emitBookingAccepted(booking);

        return res.json({ message: "Booking accepted", booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function rejectBooking(req, res) {
    try {
        const providerId = req.user.id;
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        const booking = await Booking.findOne({ _id: id, provider_id: providerId });
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (booking.status !== "pending") {
            return res.status(400).json({ message: `Cannot reject booking in status: ${booking.status}` });
        }

        booking.status = "rejected";
        await booking.save();
        emitBookingRejected(booking);

        return res.json({ message: "Booking rejected", booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function providerBookings(req, res) {
    try {
        const providerId = req.user.id;
        const { page, search = "", status = "" } = req.query;

        const provider = await User.findById(providerId).select("_id role");
        if (!provider || !["provider", "admin"].includes(provider.role)) {
            return res.status(403).json({ message: "Only providers can view bookings" });
        }

        const baseQuery = { provider_id: new mongoose.Types.ObjectId(String(providerId)) };
        if (status) baseQuery.status = status;

        // No page = return all (for dashboard stats)
        if (!page && !search) {
            const bookings = await Booking.find(baseQuery)
                .sort({ createdAt: -1 })
                .populate("customer_id", "full_name email")
                .populate("service_id", "service_name price");
            return res.json({ bookings });
        }

        const PAGE_SIZE = 5;
        const skip = (Number(page || 1) - 1) * PAGE_SIZE;

        const pipeline = [
            { $match: baseQuery },
            { $lookup: { from: "users", localField: "customer_id", foreignField: "_id", as: "customer_id", pipeline: [{ $project: { full_name: 1, email: 1 } }] } },
            { $unwind: { path: "$customer_id", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "services", localField: "service_id", foreignField: "_id", as: "service_id", pipeline: [{ $project: { service_name: 1, price: 1 } }] } },
            { $unwind: { path: "$service_id", preserveNullAndEmptyArrays: true } },
        ];

        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { "customer_id.full_name": { $regex: search, $options: "i" } },
                        { "customer_id.email": { $regex: search, $options: "i" } },
                        { "service_id.service_name": { $regex: search, $options: "i" } },
                        { date: { $regex: search, $options: "i" } },
                    ]
                }
            });
        }

        const countResult = await Booking.aggregate([...pipeline, { $count: "total" }]);
        const total = countResult[0]?.total || 0;
        pipeline.push({ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: PAGE_SIZE });
        const bookings = await Booking.aggregate(pipeline);

        return res.json({ bookings, total, page: Number(page || 1), totalPages: Math.ceil(total / PAGE_SIZE) });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function providerUpdateBookingStatus(req, res) {
    try {
        const providerId = req.user.id;
        const { id } = req.params;
        const { status } = req.body;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        if (!["confirmed", "rejected", "completed", "cancelled"].includes(String(status))) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const provider = await User.findById(providerId).select("_id role");
        if (!provider || !["provider", "admin"].includes(provider.role)) {
            return res.status(403).json({ message: "Only providers can update booking status" });
        }
        const booking = await Booking.findOne(
            provider.role === "admin" ? { _id: id } : { _id: id, provider_id: providerId }
        )
            .populate("customer_id", "full_name email")
            .populate("service_id", "service_name price");

        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (booking.status === "completed" || booking.status === "cancelled") {
            return res.status(400).json({ message: "Booking cannot be updated" });
        }

        if (booking.status !== "pending" && (status === "confirmed" || status === "rejected")) {
            return res.status(400).json({ message: "Only pending bookings can be confirmed/rejected" });
        }

        booking.status = status;
        await booking.save();

        // Emit correct event based on new status
        switch (status) {
            case "confirmed":
                emitBookingConfirmed(booking);
                break;
            case "rejected":
                emitBookingRejected(booking);
                break;
            case "completed":
                emitBookingCompleted(booking);
                break;
            case "cancelled":
                emitBookingCancelled(booking);
                break;
        }

        const customer =
            booking.customer_id && typeof booking.customer_id === "object" ? booking.customer_id : null;
        const service =
            booking.service_id && typeof booking.service_id === "object" ? booking.service_id : null;

        if (customer?.email) {
            const subject =
                status === "confirmed"
                    ? "Fixora: Booking Confirmed"
                    : status === "rejected"
                        ? "Fixora: Booking Rejected"
                        : status === "completed"
                            ? "Fixora: Job Completed"
                            : "Fixora: Booking Updated";
            const body = ` Hi ${customer.full_name || "Customer"},

                            Your booking status is now: ${status}

                            Service: ${service?.service_name || "Service"}
                            Date: ${booking.date || "-"}
                            Time: ${booking.time || "-"}
                            Address: ${booking.address || "-"}

                            Thank you,
                            Fixora
                            `.trim();

            try {
                await sendEmail({ to: customer.email, subject, text: body });
            } catch (err) {
                return res.status(500).json({ message: err.message });
            }
        }

        return res.json({ message: "Booking updated", booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function getBookingById(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        const booking = await Booking.findById(id)
            .populate("provider_id", "full_name email provider_profile")
            .populate("service_id", "service_name price")
            .populate("customer_id", "full_name email");

        if (!booking) return res.status(404).json({ message: "Booking not found" });

        // ✅ Only customer or provider of this booking can view
        const customerId = booking.customer_id?._id?.toString() || booking.customer_id?.toString();
        const providerId = booking.provider_id?._id?.toString() || booking.provider_id?.toString();

        if (req.user.role !== "admin" && customerId !== userId && providerId !== userId) {
            return res.status(403).json({ message: "Not authorized" });
        }

        return res.json({ booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function providerCompleteBooking(req, res) {
    try {
        const providerId = req.user.id;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        const provider = await User.findById(providerId).select("_id role");
        if (!provider || !["provider", "admin"].includes(provider.role)) {
            return res.status(403).json({ message: "Only providers can complete bookings" });
        }
        const booking = await Booking.findOne(
            provider.role === "admin" ? { _id: id } : { _id: id, provider_id: providerId }
        );

        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (booking.status !== "confirmed") {
            return res.status(400).json({ message: "Only confirmed bookings can be completed" });
        }

        booking.status = "work_completed";
        await booking.save();
        emitBookingWorkCompleted(booking);

        return res.json({ message: "Booking marked as completed", booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export const approveReschedule = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        const userId = String(req.user.id);
        const role = req.user.role;

        const customerId =
            typeof booking.customer_id === "object" && booking.customer_id?._id
                ? String(booking.customer_id._id)
                : String(booking.customer_id);

        const providerId =
            typeof booking.provider_id === "object" && booking.provider_id?._id
                ? String(booking.provider_id._id)
                : String(booking.provider_id);

        if (
            (role === "customer" && customerId !== userId) ||
            (role === "provider" && providerId !== userId)
        ) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (!booking.reschedule?.requested) {
            return res.status(400).json({ message: "No reschedule request found" });
        }

        const requestedBy = booking.reschedule.requested_by;

        if (requestedBy === role) {
            return res.status(403).json({
                message: "You cannot approve your own reschedule request",
            });
        }

        booking.date = booking.reschedule.proposed_date || booking.date;
        booking.time = booking.reschedule.proposed_time || booking.time;
        booking.status = "confirmed";

        booking.reschedule = {
            requested: false,
            proposed_date: null,
            proposed_time: null,
            reason: "",
            requested_by: null,
            previous_status: null,
            decision: "accepted",
        };

        await booking.save();
        emitRescheduleApproved(booking);

        return res.json({
            message: "Reschedule approved successfully",
            booking,
        });
    } catch (error) {
        console.error("approveReschedule error:", error);
        return res.status(500).json({ message: "Failed to approve reschedule" });
    }
};

export async function rejectReschedule(req, res) {
    try {
        const userId = String(req.user.id);
        const role = req.user.role;

        const { rejection_reason, rejection_message } = req.body || {};

        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        // Only CUSTOMER can reject provider reschedule
        const customerId =
            typeof booking.customer_id === "object" && booking.customer_id
                ? String(booking.customer_id._id)
                : String(booking.customer_id);

        if (!["customer", "admin"].includes(role) || (role === "customer" && customerId !== userId)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        // Must have pending reschedule request
        if (!booking.reschedule?.requested) {
            return res.status(400).json({ message: "No reschedule request found" });
        }

        if (booking.reschedule.requested_by !== "provider") {
            return res.status(400).json({ message: "This request is not from provider" });
        }

        // Keep original booking active
        const prev = booking.reschedule.previous_status || booking.status;
        booking.reschedule = {
            ...booking.reschedule,
            decision: "rejected",
            rejection_reason,
            rejection_message,
            decided_at: new Date(),
            requested: false,
        };

        booking.status = prev;

        await booking.save();
        emitRescheduleRejected(booking);

        return res.json({
            message: "Reschedule rejected. Original booking remains active.",
            booking,
        });
    } catch (err) {
        console.error("rejectReschedule error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function providerCompleteWork(req, res) {
    try {
        const providerId = req.user.id;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        const booking = await Booking.findOne({ _id: id, provider_id: providerId });
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        // only confirmed bookings can be completed
        if (booking.status !== "confirmed") {
            return res.status(400).json({ message: "Only confirmed bookings can be completed" });
        }

        booking.status = "work_completed";
        await booking.save();
        emitBookingWorkCompleted(booking);

        return res.json({ message: "Work marked as completed. Customer can pay now.", booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function rescheduleBooking(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { date, time } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        if (!date || !time) {
            return res.status(400).json({ message: "date and time are required" });
        }

        const dt = new Date(`${date}T${time}:00`);
        if (Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
            return res.status(400).json({ message: "Invalid or past date/time" });
        }

        const booking = await Booking.findOne({ _id: id, customer_id: userId });
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (booking.status === "cancelled") {
            return res.status(400).json({ message: "Cancelled booking cannot be rescheduled" });
        }
        if (booking.status === "completed") {
            return res.status(400).json({ message: "Completed booking cannot be rescheduled" });
        }

        booking.date = date;
        booking.time = time;
        booking.status = "pending";
        await booking.save();
        emitBookingCreated(booking);

        return res.json({ message: "Booking rescheduled", booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

/**
 * 💰 Signal 13 — Provider requests travel fee
 * POST /api/bookings/:id/travel-fee
 * Body: { amount, note? }
 */
export async function requestTravelFee(req, res) {
    try {
        const providerId = req.user.id;
        const { id } = req.params;
        const { amount, note } = req.body || {};

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }
        const fee = Number(amount);
        if (!fee || fee <= 0 || fee > 5000) {
            return res.status(400).json({ message: "Travel fee must be between $1 and $5000" });
        }

        const booking = await Booking.findById(id);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (String(booking.provider_id) !== String(providerId)) {
            return res.status(403).json({ message: "Only the assigned provider can request travel fee" });
        }
        if (booking.status !== "pending") {
            return res.status(400).json({ message: "Travel fee can only be requested while booking is pending" });
        }
        if (booking.travel_fee_status === "pending") {
            return res.status(400).json({ message: "Travel fee already requested" });
        }

        booking.travel_fee_requested = fee;
        booking.travel_fee_note = String(note || "").trim().slice(0, 200);
        booking.travel_fee_status = "pending";
        booking.travel_fee_requested_at = new Date();
        await booking.save();

        // Notify customer via email
        try {
            const customer = await User.findById(booking.customer_id).select("email full_name");
            const provider = await User.findById(booking.provider_id).select("full_name");
            if (customer?.email) {
                await sendEmail({
                    to: customer.email,
                    subject: `Travel fee request from ${provider?.full_name || "your provider"}`,
                    text: `Hi ${customer.full_name || "Customer"},

${provider?.full_name || "Your provider"} has accepted your booking but requested a travel fee of $${fee}.

Reason: ${booking.travel_fee_note || "Extra distance"}

Service: $${booking.total_amount}
Travel fee: $${fee}
New total: $${booking.total_amount + fee}

Login to Fixora to accept or decline this fee.`,
                });
            }
        } catch (err) {
            console.warn("[travel-fee email] failed:", err.message);
        }

        return res.json({ message: "Travel fee requested", booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function respondTravelFee(req, res) {
    try {
        const customerId = req.user.id;
        const { id } = req.params;
        const { decision } = req.body || {};

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }
        if (!["accepted", "rejected"].includes(decision)) {
            return res.status(400).json({ message: "Decision must be 'accepted' or 'rejected'" });
        }

        const booking = await Booking.findById(id);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (String(booking.customer_id) !== String(customerId)) {
            return res.status(403).json({ message: "Only the booking customer can respond" });
        }
        if (booking.travel_fee_status !== "pending") {
            return res.status(400).json({ message: "No pending travel fee on this booking" });
        }

        booking.travel_fee_status = decision;
        booking.travel_fee_responded_at = new Date();

        if (decision === "accepted") {
            // Add fee to total + confirm booking
            // booking.total_amount = (booking.total_amount || 0) + (booking.travel_fee_requested || 0);
            booking.status = "confirmed";
            booking.decision = "accepted";
        } else {
            // Customer rejected — cancel booking
            booking.status = "cancelled";
            booking.decision = "rejected";
        }

        await booking.save();

        // Notify provider
        try {
            const provider = await User.findById(booking.provider_id).select("email full_name");
            if (provider?.email) {
                await sendEmail({
                    to: provider.email,
                    subject: `Travel fee ${decision} by customer`,
                    text: `Hi ${provider.full_name || "Provider"},

The customer has ${decision} your travel fee request of $${booking.travel_fee_requested}.

${decision === "accepted"
                            ? `Booking is now confirmed. New total: $${booking.total_amount}.`
                            : "Booking has been cancelled."}

Login to Fixora for details.`,
                });
            }
        } catch (err) {
            console.warn("[travel-fee response email] failed:", err.message);
        }

        return res.json({ message: `Travel fee ${decision}`, booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function getCustomerHistory(req, res) {
    try {
        const providerId = req.user.id;
        const { customerId } = req.params;

        if (!isValidObjectId(customerId)) {
            return res.status(400).json({ message: "Invalid customer id" });
        }

        // Past bookings between this provider and this customer
        const bookings = await Booking.find({
            provider_id: providerId,
            customer_id: customerId,
        })
            .sort({ createdAt: -1 })
            .lean();

        const total = bookings.length;
        const completed = bookings.filter((b) => b.status === "completed").length;
        const cancelled = bookings.filter((b) => b.status === "cancelled").length;
        const paid = bookings.filter((b) => b.payment_status === "paid").length;
        const lastBooking = bookings[0] || null;

        // Total revenue from this customer (lifetime)
        const totalRevenue = bookings
            .filter((b) => b.payment_status === "paid")
            .reduce((sum, b) => sum + (b.total_amount || 0), 0);

        return res.json({
            total_bookings: total,
            completed_bookings: completed,
            cancelled_bookings: cancelled,
            paid_bookings: paid,
            last_booking_date: lastBooking?.date || null,
            last_booking_status: lastBooking?.status || null,
            total_revenue: totalRevenue,
            // Trust badges
            is_repeat_customer: total >= 2,
            is_loyal_customer: total >= 5,
            is_reliable_payer: total > 0 && paid / total >= 0.8,
        });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

/**
 * 🚨 Urgent Mode — Customer broadcasts to top N providers
 * POST /api/bookings/urgent
 * Body: { service_id, address, notes?, premium_pct? }
 */
export async function createUrgentBooking(req, res) {
    try {
        const customerId = req.user.id;
        const { service_id, address, notes, premium_pct, target_provider_id } = req.body || {};

        if (!service_id || !address) {
            return res.status(400).json({ message: "service_id and address required" });
        }
        if (!isValidObjectId(service_id)) {
            return res.status(400).json({ message: "Invalid service id" });
        }

        const service = await Service.findById(service_id).select("_id service_name category_id price provider_id");
        if (!service) return res.status(404).json({ message: "Service not found" });

        // Geocode customer address
        const geo = await geocodeAddress(address);
        if (!geo) {
            return res.status(400).json({ message: "Could not find address" });
        }
        const customerGeo = [geo.lng, geo.lat];

        // Find top 5 providers offering this service category, sorted by location
        const candidateServices = await Service.find({
            category_id: service.category_id,
            is_active: true,
        })
            .populate({
                path: "provider_id",
                match: {
                    provider_status: "verified",
                    is_active: true,
                    "provider_profile.is_available": true,
                },
                select: "_id full_name provider_profile",
            })
            .lean();

        const candidates = candidateServices
            .filter((s) => s.provider_id && s.provider_id.provider_profile?.home_geo?.coordinates)
            .map((s) => {
                const provGeo = s.provider_id.provider_profile.home_geo.coordinates;
                const isLive = s.provider_id.provider_profile.is_live_now;
                const liveGeo = s.provider_id.provider_profile.live_geo?.coordinates;
                // Use live position if available, else home
                const effectiveGeo = isLive && liveGeo ? liveGeo : provGeo;
                const distance = haversineMiles(customerGeo, effectiveGeo);
                return {
                    provider_id: s.provider_id._id,
                    service_id: s._id,
                    distance,
                    is_live: !!isLive,
                };
            })
            .sort((a, b) => a.distance - b.distance);

        // De-dup by provider, take top 5
        const seen = new Set();
        const top5 = [];
        for (const c of candidates) {
            const pid = String(c.provider_id);
            if (seen.has(pid)) continue;
            seen.add(pid);
            top5.push(c);
            if (top5.length >= 5) break;
        }

        // If customer was on a specific provider's profile, ALWAYS include that
        // provider in the broadcast (even if not in geographic top 5).
        if (target_provider_id && isValidObjectId(target_provider_id)) {
            const tid = String(target_provider_id);
            const alreadyIn = top5.some((c) => String(c.provider_id) === tid);
            if (!alreadyIn) {
                console.log(`[urgent] forcing target provider ${tid} into broadcast list`);
                top5.unshift({ provider_id: target_provider_id, distance: 0, is_live: false });
                if (top5.length > 6) top5.length = 6; // cap at 6
            }
        }

        if (top5.length === 0) {
            return res.status(404).json({ message: "No nearby providers found right now" });
        }

        // Calculate premium pricing
        const pct = Math.min(Math.max(Number(premium_pct) || 30, 0), 100);
        const basePrice = service.price || 0;
        const premiumPrice = Math.round(basePrice * (1 + pct / 100));

        // Create booking in "broadcasting" status
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const timeStr = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;

        const booking = await Booking.create({
            customer_id: customerId,
            provider_id: top5[0].provider_id, // placeholder — winner gets it
            service_id: service._id,
            date: dateStr,
            time: timeStr,
            address,
            notes: notes || "",
            status: "broadcasting",
            payment_status: "pending",
            total_amount: premiumPrice,
            currency: "USD",
            service_geo: { type: "Point", coordinates: customerGeo },
            formatted_address: geo.formatted_address,
            is_urgent: true,
            urgent_premium_pct: pct,
            urgent_broadcast_to: top5.map((c) => c.provider_id),
            urgent_broadcast_at: new Date(),
        });

        // Emit to all 5 providers
        console.log(`[urgent] broadcasting booking ${booking._id} to ${top5.length} providers:`, top5.map((c) => String(c.provider_id)));
        emitUrgentBroadcast(booking, top5.map((c) => c.provider_id));

        return res.status(201).json({
            message: `Broadcast to ${top5.length} providers. First to accept wins.`,
            booking,
            broadcast_count: top5.length,
        });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

export async function acceptUrgentBooking(req, res) {
    try {
        const providerId = req.user.id;
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        // Atomic update: only succeeds if status is still "broadcasting" and provider was in the list
        const booking = await Booking.findOneAndUpdate(
            {
                _id: id,
                status: "broadcasting",
                urgent_broadcast_to: providerId,
                urgent_accepted_by: null,
            },
            {
                $set: {
                    status: "confirmed",
                    provider_id: providerId,
                    urgent_accepted_by: providerId,
                    urgent_accepted_at: new Date(),
                    decision: "accepted",
                },
            },
            { new: true }
        ).populate("customer_id", "full_name email").populate("service_id", "service_name");

        if (!booking) {
            return res.status(409).json({ message: "Already taken by another provider" });
        }

        // Notify others that it's taken
        emitUrgentTaken(booking, booking.urgent_broadcast_to, providerId);
        // Notify customer
        emitUrgentAccepted(booking);

        return res.json({ message: "Urgent booking accepted!", booking });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

/**
 * 🚨 Provider passes on urgent booking
 * POST /api/bookings/:id/urgent-pass
 */
export async function passUrgentBooking(req, res) {
    try {
        const providerId = req.user.id;
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        const booking = await Booking.findOne({
            _id: id,
            status: "broadcasting",
            urgent_broadcast_to: providerId,
        });

        if (!booking) {
            return res.json({ message: "Booking no longer available" });
        }

        // Add to passed list (avoid duplicates)
        const alreadyPassed = booking.urgent_passed_by?.some(
            (id) => String(id) === String(providerId)
        );
        if (!alreadyPassed) {
            booking.urgent_passed_by = [...(booking.urgent_passed_by || []), providerId];
            await booking.save();
        }

        // If everyone passed → cancel + notify customer
        const totalBroadcast = booking.urgent_broadcast_to.length;
        const totalPassed = booking.urgent_passed_by.length;

        if (totalPassed >= totalBroadcast) {
            booking.status = "cancelled";
            await booking.save();

            // Notify customer
            const customerId = String(booking.customer_id);
            try {
                getIO().to(ROOMS.user(customerId)).emit("urgent:all_passed", {
                    bookingId: String(booking._id),
                    message: "All providers passed. Try regular booking or increase premium.",
                });
            } catch (err) {
                console.warn("urgent:all_passed emit failed:", err.message);
            }
        }

        return res.json({
            message: "Passed",
            passed_count: totalPassed,
            broadcast_count: totalBroadcast,
            all_passed: totalPassed >= totalBroadcast,
        });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}