import { ServiceIssue } from "../models/ServiceIssue.js";
import { Booking } from "../models/Booking.js";
import { sendEmail } from "../utils/mailer.js";
import { emitIssueCreated, emitIssueResolved } from "../socket/emitters.js";

// POST - Customer reports issue
export async function createIssue(req, res) {
    try {
        const customer_id = req.user.id;
        const { booking_id, issue_type, description } = req.body;

        if (!booking_id || !issue_type || !description) {
            return res.status(400).json({ message: "booking_id, issue_type and description are required" });
        }

        const booking = await Booking.findById(booking_id);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (booking.customer_id.toString() !== customer_id) {
            return res.status(403).json({ message: "Not your booking" });
        }

        // Check if issue already reported for this booking
        const existing = await ServiceIssue.findOne({ booking_id });
        if (existing) {
            return res.status(400).json({ message: "Issue already reported for this booking" });
        }

        const issue = await ServiceIssue.create({
            booking_id,
            customer_id,
            provider_id: booking.provider_id,
            service_id: booking.service_id,
            issue_type,
            description: description.trim(),
        });
        emitIssueCreated(issue);
        return res.status(201).json({ message: "Issue reported successfully", issue });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// GET - All issues (admin)
export async function getAllIssues(req, res) {
    try {
        const issues = await ServiceIssue.find()
            .populate({ path: "customer_id", select: "full_name email" })
            .populate({ path: "provider_id", select: "full_name email" })
            .populate({ path: "service_id", select: "service_name" })
            .populate({ path: "booking_id", select: "date time" })
            .sort({ createdAt: -1 });
        return res.json({ issues });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// GET - Provider's own issues
export async function providerIssues(req, res) {
    try {
        const { page, tab = "open" } = req.query;
        const PAGE_SIZE = 5;
        const baseQuery = { provider_id: req.user.id };

        // No page = return all (for badge count)
        if (!page) {
            const issues = await ServiceIssue.find(baseQuery)
                .populate({ path: "customer_id", select: "full_name email" })
                .populate({ path: "service_id", select: "service_name" })
                .populate({ path: "booking_id", select: "date time" })
                .sort({ createdAt: -1 });
            return res.json({ issues });
        }

        const query = { ...baseQuery };
        query.status = tab === "resolved" ? "resolved" : { $ne: "resolved" };

        const skip = (Number(page) - 1) * PAGE_SIZE;
        const total = await ServiceIssue.countDocuments(query);
        const issues = await ServiceIssue.find(query)
            .populate({ path: "customer_id", select: "full_name email" })
            .populate({ path: "service_id", select: "service_name" })
            .populate({ path: "booking_id", select: "date time" })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(PAGE_SIZE);

        return res.json({ issues, total, page: Number(page), totalPages: Math.ceil(total / PAGE_SIZE) });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// PATCH - Admin updates issue status
export async function updateIssueStatus(req, res) {
    try {
        const { status, admin_notes, resolution_type, resolution_amount, resolution_note } = req.body;
        const issue = await ServiceIssue.findById(req.params.id);
        if (!issue) return res.status(404).json({ message: "Issue not found" });

        if (status) issue.status = status;
        if (admin_notes !== undefined) issue.admin_notes = admin_notes;
        if (resolution_type !== undefined) issue.resolution_type = resolution_type;
        if (resolution_amount !== undefined) issue.resolution_amount = Number(resolution_amount);
        if (resolution_note !== undefined) issue.resolution_note = resolution_note;
        await issue.save();
        if (status === "resolved") {
            emitIssueResolved(issue);
        }
        if (resolution_type === "refund" && resolution_amount && issue.booking_id) {
            const booking = await Booking.findById(issue.booking_id);
            if (booking) {
                const refundAmt = Number(resolution_amount);
                booking.total_amount = Math.max(0, Number(booking.total_amount) - refundAmt);
                booking.payment_status = "refunded";
                await booking.save();
                if (status === "resolved") {
                    emitIssueResolved(issue);
                }
            }
        }

        return res.json({ message: "Issue updated", issue });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// GET - Customer's own issues
export async function myIssues(req, res) {
    try {
        const issues = await ServiceIssue.find({ customer_id: req.user.id })
            .populate({ path: "service_id", select: "service_name" })
            .populate({ path: "booking_id", select: "_id date time" })
            .sort({ createdAt: -1 });
        return res.json({ issues });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

export async function requestRefund(req, res) {
    try {
        const { refund_reason } = req.body;
        const issue = await ServiceIssue.findById(req.params.id);
        if (!issue) return res.status(404).json({ message: "Issue not found" });

        if (issue.customer_id.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not your issue" });
        }

        issue.refund_requested = true;
        issue.refund_reason = refund_reason || "";
        await issue.save();

        return res.json({ message: "Refund requested", issue });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

export async function providerRespondToIssue(req, res) {
    try {
        const { response, status } = req.body;
        const issue = await ServiceIssue.findById(req.params.id)
            .populate("customer_id", "full_name email")
            .populate("service_id", "service_name");

        if (!issue) return res.status(404).json({ message: "Issue not found" });
        if (issue.provider_id.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not your issue" });
        }

        issue.provider_response = response.trim();
        issue.provider_responded_at = new Date();
        issue.status = status === "resolved" ? "resolved" : "in_review";
        await issue.save();
        if (status === "resolved") {
            emitIssueResolved(issue);
        }
        if (status === "resolved" && issue.customer_id?.email) {
            await sendEmail({
                to: issue.customer_id.email,
                subject: "Fixora: Your Issue Has Been Resolved",
                text: `
Hi ${issue.customer_id.full_name || "Customer"},

Your issue for "${issue.service_id?.service_name}" has been resolved by the provider.

Provider's response: "${response}"

If you are not satisfied, you can still request a refund from your dashboard.

Thank you,
Fixora
        `.trim()
            }).catch(() => { });
        }

        return res.json({ message: "Response submitted", issue });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}