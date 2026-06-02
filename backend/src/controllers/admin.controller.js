import { User } from "../models/Users.js";
import { Service } from "../models/Services.js";
import { Booking } from "../models/Booking.js";
import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { logAction } from "../services/audit.service.js";

const PAGE_SIZE = 5;

// Allow callers to pass ?limit=N to override page size (capped at 10000 for export)
function getPageSize(req) {
    const n = Number(req.query?.limit);
    if (!n || n < 1) return PAGE_SIZE;
    return Math.min(n, 10000);
}

// Commission rates config
const SEASONAL_RATES = {
    peak: { months: [5, 6, 7], rate: 0.18 },      // Jun-Aug
    normal: { months: [2, 3, 4, 8, 9, 10], rate: 0.15 }, // Mar-May, Sep-Nov
    offpeak: { months: [11, 0, 1], rate: 0.12 },   // Dec-Feb
};

const CATEGORY_RATES = {
    "plumbing": 0.12,
    "electrical": 0.12,
    "cleaning": 0.18,
    "handyman": 0.18,
    "appliance": 0.15,
    "carpentry": 0.15,
    "painting": 0.16,
    "landscaping": 0.16,
};

function getSeasonalRate(date) {
    const month = new Date(date).getMonth();
    if (SEASONAL_RATES.peak.months.includes(month)) return SEASONAL_RATES.peak.rate;
    if (SEASONAL_RATES.offpeak.months.includes(month)) return SEASONAL_RATES.offpeak.rate;
    return SEASONAL_RATES.normal.rate;
}

function getCategoryRate(categoryName = "") {
    const lower = categoryName.toLowerCase();
    for (const [key, rate] of Object.entries(CATEGORY_RATES)) {
        if (lower.includes(key)) return rate;
    }
    return 0.15; // default
}

function getCustomerTier(bookingCount, totalSpent) {
    if (totalSpent >= 2000) return { tier: "Champion 💎", discount: 0.08, cashback: true };
    if (totalSpent >= 500) return { tier: "VIP 🥇", discount: 0.05, cashback: true };
    if (bookingCount >= 5) return { tier: "Regular 🥈", discount: 0.07, cashback: false };
    if (bookingCount === 1) return { tier: "New 🥉", discount: 0.10, cashback: false };
    return { tier: "Member", discount: 0.03, cashback: false };
}

// Smart seasonal + category demand matching
function getSmartCommissionRate(categoryName = "", date) {
    const month = new Date(date).getMonth();
    const cat = categoryName.toLowerCase();

    const isWinter = [11, 0, 1].includes(month);  // Dec, Jan, Feb
    const isSummer = [5, 6, 7].includes(month);   // Jun, Jul, Aug

    // Winter-demand services
    const winterServices = ["heater", "heating", "furnace", "snow", "pipe", "gas", "insulation", "carpet cleaning", "deep cleaning"];
    const isWinterService = winterServices.some(s => cat.includes(s));

    // Summer-demand services
    const summerServices = ["ac", "cooling", "landscaping", "lawn", "garden", "painting", "pool", "roofing"];
    const isSummerService = summerServices.some(s => cat.includes(s));

    // Year-round services
    const coreServices = ["plumbing", "electrical", "cleaning", "handyman", "appliance", "carpentry"];
    const isCoreService = coreServices.some(s => cat.includes(s));

    // Logic: Peak demand = platform takes more
    if (isWinter && isWinterService) return 0.20;   // 🔥 Peak winter demand
    if (isSummer && isSummerService) return 0.20;   // 🔥 Peak summer demand
    if (isWinter && isSummerService) return 0.10;   // ❄️ Off-season summer service — help provider
    if (isSummer && isWinterService) return 0.10;   // ☀️ Off-season winter service — help provider
    if (isCoreService) return 0.15;                 // Year-round standard rate

    return 0.15; // default
}

// commission nu logic 
async function getProviderWorkloadRate(providerId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentJobs = await Booking.countDocuments({
        provider_id: providerId,
        status: "completed",
        updatedAt: { $gte: thirtyDaysAgo }
    });

    if (recentJobs >= 20) return { rate: 0.22, tier: "🔥 Hot", jobs: recentJobs };
    if (recentJobs >= 10) return { rate: 0.18, tier: "⚡ Active", jobs: recentJobs };
    if (recentJobs >= 5) return { rate: 0.15, tier: "✅ Regular", jobs: recentJobs };
    if (recentJobs >= 1) return { rate: 0.10, tier: "🌱 Slow", jobs: recentJobs };
    return { rate: 0.08, tier: "🆕 New", jobs: recentJobs };
}

// GET /api/admin/commission-report
export async function getCommissionReport(req, res) {
    try {
        const { from, to } = req.query;
        const dateFilter = {};
        if (from) dateFilter.$gte = new Date(from);
        if (to) dateFilter.$lte = new Date(to);

        const query = { payment_status: "paid" };
        if (from || to) query.updatedAt = dateFilter;

        const paidBookings = await Booking.find(query)
            .populate({
                path: "service_id",
                select: "service_name price category_id",
                populate: { path: "category_id", select: "category_name" }
            })
            .populate({ path: "customer_id", select: "full_name email" })
            .populate({ path: "provider_id", select: "full_name email" })
            .lean();

        let grossRevenue = 0;
        let totalPlatformCommission = 0;
        let totalProviderPayout = 0;
        let totalCashback = 0;

        const monthlyBreakdown = {};
        const categoryBreakdown = {};
        const providerBreakdown = {};
        const tierDistribution = {
            "🔥 Hot": 0,
            "⚡ Active": 0,
            "✅ Regular": 0,
            "🌱 Slow": 0,
            "🆕 New": 0
        };

        // Get unique providers and their workload-based rates
        const providerIds = [...new Set(
            paidBookings.map(b => String(b.provider_id?._id)).filter(Boolean)
        )];

        const providerRates = {};
        for (const pid of providerIds) {
            providerRates[pid] = await getProviderWorkloadRate(pid);
        }

        // Process each booking
        for (const booking of paidBookings) {
            const amount = Number(booking.total_amount || 0);
            if (!amount) continue;

            const pid = String(booking.provider_id?._id);
            const { rate, tier } = providerRates[pid] || { rate: 0.15, tier: "Unknown" };

            const commission = amount * rate;
            const payout = amount - commission;

            grossRevenue += amount;
            totalPlatformCommission += commission;
            totalProviderPayout += payout;

            // Monthly breakdown
            const month = new Date(booking.date || booking.createdAt)
                .toLocaleString("default", { month: "short", year: "numeric" });
            if (!monthlyBreakdown[month]) {
                monthlyBreakdown[month] = { gross: 0, commission: 0, payout: 0, bookings: 0 };
            }
            monthlyBreakdown[month].gross += amount;
            monthlyBreakdown[month].commission += commission;
            monthlyBreakdown[month].payout += payout;
            monthlyBreakdown[month].bookings += 1;

            // Category breakdown
            const catName = booking.service_id?.category_id?.category_name || "Other";
            if (!categoryBreakdown[catName]) {
                categoryBreakdown[catName] = { gross: 0, commission: 0, bookings: 0 };
            }
            categoryBreakdown[catName].gross += amount;
            categoryBreakdown[catName].commission += commission;
            categoryBreakdown[catName].bookings += 1;

            // Provider breakdown
            const provName = booking.provider_id?.full_name || "Unknown";
            if (!providerBreakdown[provName]) {
                providerBreakdown[provName] = {
                    gross: 0,
                    payout: 0,
                    commission: 0,
                    bookings: 0,
                    tier,
                    rate: `${(rate * 100).toFixed(0)}%`
                };
            }
            providerBreakdown[provName].gross += amount;
            providerBreakdown[provName].payout += payout;
            providerBreakdown[provName].commission += commission;
            providerBreakdown[provName].bookings += 1;
        }

        // Count unique providers per tier
        for (const pid of providerIds) {
            const t = providerRates[pid]?.tier;
            if (t && tierDistribution[t] !== undefined) tierDistribution[t]++;
        }

        // Customer loyalty report
        const customers = await User.find({ role: "customer" })
            .select("_id full_name email")
            .lean();

        const customerReport = [];

        for (const customer of customers) {
            const allBookings = await Booking.find({
                customer_id: customer._id,
                payment_status: "paid"
            }).lean();

            const totalSpent = allBookings.reduce((s, b) => s + Number(b.total_amount || 0), 0);
            const { tier, discount, cashback } = getCustomerTier(allBookings.length, totalSpent);

            // Only count cashback on bookings within the report period
            const periodBookings = allBookings.filter(b => {
                if (!from && !to) return true;
                const date = new Date(b.updatedAt);
                if (from && date < new Date(from)) return false;
                if (to && date > new Date(to)) return false;
                return true;
            });
            const periodSpent = periodBookings.reduce((s, b) => s + Number(b.total_amount || 0), 0);
            const cashbackAmount = cashback ? periodSpent * discount : 0;
            totalCashback += cashbackAmount;

            if (allBookings.length > 0) {
                customerReport.push({
                    name: customer.full_name,
                    email: customer.email,
                    bookings: allBookings.length,
                    totalSpent,
                    tier,
                    discount: `${(discount * 100).toFixed(0)}%`,
                    cashbackEarned: cashbackAmount.toFixed(2),
                });
            }
        }

        const netRevenue = totalPlatformCommission - totalCashback;

        return res.json({
            summary: {
                grossRevenue: grossRevenue.toFixed(2),
                totalPlatformCommission: totalPlatformCommission.toFixed(2),
                totalProviderPayout: totalProviderPayout.toFixed(2),
                totalCashback: totalCashback.toFixed(2),
                netRevenue: netRevenue.toFixed(2),
                avgCommissionRate: grossRevenue > 0
                    ? ((totalPlatformCommission / grossRevenue) * 100).toFixed(1)
                    : 0,
                totalBookings: paidBookings.length,
            },
            monthlyBreakdown: Object.entries(monthlyBreakdown)
                .map(([month, data]) => ({ month, ...data })),
            categoryBreakdown: Object.entries(categoryBreakdown)
                .map(([category, data]) => ({ category, ...data })),
            providerBreakdown: Object.entries(providerBreakdown)
                .sort((a, b) => b[1].gross - a[1].gross)
                .slice(0, 10)
                .map(([provider, data]) => ({ provider, ...data })),
            tierDistribution,
            customerReport: customerReport.sort((a, b) => b.totalSpent - a.totalSpent),
        });
    } catch (err) {
        console.error("getCommissionReport error:", err);
        return res.status(500).json({ message: err.message });
    }
}


// GET /api/admin/providers
export async function listProviders(req, res) {
    try {
        const { status, page = 1, search = "" } = req.query;
        const query = { role: "provider" };
        if (status && status !== "all") {
            if (status === "pending") {
                query.provider_status = { $in: ["pending", "pending_verification"] };
            } else {
                query.provider_status = status;
            }
        }
        if (search) {
            query.$or = [
                { full_name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { "provider_profile.phone": { $regex: search, $options: "i" } },
            ];
        }
        const pageSize = getPageSize(req);
        const skip = (Number(page) - 1) * pageSize;
        const total = await User.countDocuments(query);
        const providers = await User.find(query)
            .select("-password_hash")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .lean();
        return res.json({ success: true, providers, total, page: Number(page), totalPages: Math.ceil(total / pageSize) });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// PATCH /api/admin/providers/:id/status
export async function updateProviderStatus(req, res) {
    try {
        const { status } = req.body;
        if (!["verified", "rejected", "pending", "pending_verification", "draft"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }
        const user = await User.findByIdAndUpdate(req.params.id, { provider_status: status }, { new: true }).select("-password_hash");
        if (!user) return res.status(404).json({ success: false, message: "Provider not found" });
        if (status === "verified") await Service.updateMany({ provider_id: user._id }, { $set: { is_active: true } });
        if (status === "rejected") await Service.updateMany({ provider_id: user._id }, { $set: { is_active: false } });
        return res.json({ success: true, user });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// PATCH /api/admin/providers/:id/approve
export async function approveProvider(req, res) {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { provider_status: "verified", is_active: true }, { new: true }).select("-password_hash");
        if (!user) return res.status(404).json({ success: false, message: "Provider not found" });
        await Service.updateMany({ provider_id: user._id }, { $set: { is_active: true } });
        await logAction(req, "PROVIDER_APPROVE", "user", user._id, { name: user.full_name });
        return res.json({ success: true, user });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// PATCH /api/admin/providers/:id/reject
export async function rejectProvider(req, res) {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { provider_status: "rejected", is_active: false }, { new: true }).select("-password_hash");
        if (!user) return res.status(404).json({ success: false, message: "Provider not found" });
        await Service.updateMany({ provider_id: user._id }, { $set: { is_active: false } });
        await logAction(req, "PROVIDER_REJECT", "user", user._id, { name: user.full_name });
        return res.json({ success: true, user });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// GET /api/admin/users
export async function listUsers(req, res) {
    try {
        const { is_active, page = 1, search = "" } = req.query;
        const query = {};
        if (is_active === "false") query.is_active = false;
        if (search) {
            query.$or = [
                { full_name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }
        const pageSize = getPageSize(req);
        const skip = (Number(page) - 1) * pageSize;
        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select("_id full_name email role is_active deactivated_at")
            .sort({ deactivated_at: -1 })
            .skip(skip)
            .limit(pageSize);
        return res.json({ users, total, page: Number(page), totalPages: Math.ceil(total / pageSize) });
    } catch (err) {
        return res.status(500).json({ message: "Server error" });
    }
}

// GET /api/admin/all-users — all customers + providers combined
export async function listAllUsers(req, res) {
    try {
        const { role, page = 1, search = "" } = req.query;
        const query = { role: { $in: ["customer", "provider"] } };
        if (role && role !== "all") query.role = role;
        if (search) {
            query.$or = [
                { full_name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }
        const pageSize = getPageSize(req);
        const skip = (Number(page) - 1) * pageSize;
        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select("_id full_name email role is_active createdAt provider_status provider_profile")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .lean();
        return res.json({ users, total, page: Number(page), totalPages: Math.ceil(total / pageSize) });
    } catch (err) {
        return res.status(500).json({ message: "Server error" });
    }
}

// PATCH /api/admin/users/:id/reactivate
export async function reactivateUser(req, res) {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { is_active: true, deactivated_at: null }, { new: true });
        if (!user) return res.status(404).json({ message: "User not found" });
        await logAction(req, "USER_REACTIVATE", "user", user._id, { email: user.email });
        return res.json({ message: "Account reactivated successfully", user });
    } catch (err) {
        return res.status(500).json({ message: "Server error" });
    }
}

// GET /api/admin/services
export async function listServices(req, res) {
    try {
        const { page = 1, search = "" } = req.query;
        const query = {};
        if (search) query.service_name = { $regex: search, $options: "i" };
        const pageSize = getPageSize(req);
        const skip = (Number(page) - 1) * pageSize;
        const total = await Service.countDocuments(query);
        const services = await Service.find(query)
            .populate({ path: "provider_id", select: "full_name email provider_profile" })
            .populate({ path: "category_id", select: "category_name" })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize);
        return res.json({ services, total, page: Number(page), totalPages: Math.ceil(total / pageSize) });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// PATCH /api/admin/services/:id/toggle
export async function toggleService(req, res) {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ message: "Service not found" });
        service.is_active = !service.is_active;
        await service.save();
        await logAction(req, "SERVICE_TOGGLE", "service", service._id, { is_active: service.is_active, name: service.service_name });
        return res.json({ message: `Service ${service.is_active ? "enabled" : "disabled"} successfully`, service });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// GET /api/admin/bookings — all bookings on platform
export async function listAllBookings(req, res) {
    try {
        const { page = 1, search = "", status = "" } = req.query;
        const query = {};
        if (status && status !== "all") query.status = status;
        const pageSize = getPageSize(req);
        const skip = (Number(page) - 1) * pageSize;
        const total = await Booking.countDocuments(query);
        let bookings = await Booking.find(query)
            .populate({ path: "customer_id", select: "full_name email" })
            .populate({ path: "provider_id", select: "full_name email" })
            .populate({ path: "service_id", select: "service_name price pricing_type" })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .lean();

        if (search) {
            const q = search.toLowerCase();
            bookings = bookings.filter(b =>
                b.customer_id?.full_name?.toLowerCase().includes(q) ||
                b.customer_id?.email?.toLowerCase().includes(q) ||
                b.provider_id?.full_name?.toLowerCase().includes(q) ||
                b.service_id?.service_name?.toLowerCase().includes(q)
            );
        }

        return res.json({ bookings, total, page: Number(page), totalPages: Math.ceil(total / pageSize) });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// PATCH /api/admin/bookings/:id/status — admin can change any booking status
export async function updateBookingStatus(req, res) {
    try {
        const { status } = req.body;
        const allowed = ["pending", "confirmed", "completed", "cancelled", "rejected"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        // Fetch first to capture old status
        const existing = await Booking.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Booking not found" });
        const oldStatus = existing.status;

        existing.status = status;
        await existing.save();

        await logAction(req, "BOOKING_UPDATE", "booking", existing._id, {
            from: oldStatus,
            to: existing.status,
        });

        return res.json({ message: "Booking status updated", booking: existing });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// GET /api/admin/payments — all payments
export async function listAllPayments(req, res) {
    try {
        const { page = 1, payment_status = "" } = req.query;
        const query = {};
        if (payment_status && payment_status !== "all") query.payment_status = payment_status;
        const pageSize = getPageSize(req);
        const skip = (Number(page) - 1) * pageSize;
        const total = await Booking.countDocuments({ payment_status: { $exists: true }, ...query });
        const payments = await Booking.find({ payment_status: { $exists: true }, ...query })
            .populate({ path: "customer_id", select: "full_name email" })
            .populate({ path: "provider_id", select: "full_name email" })
            .populate({ path: "service_id", select: "service_name price" })
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .lean();
        return res.json({ payments, total, page: Number(page), totalPages: Math.ceil(total / pageSize) });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// GET /api/admin/stats — real platform stats
export async function getAdminStats(req, res) {
    try {
        const totalUsers = await User.countDocuments({ role: { $in: ["customer", "provider"] } });
        const totalCustomers = await User.countDocuments({ role: "customer" });
        const totalProviders = await User.countDocuments({ role: "provider" });
        const activeProviders = await User.countDocuments({ role: "provider", provider_status: "verified" });
        const totalBookings = await Booking.countDocuments();
        const completedBookings = await Booking.countDocuments({ status: "completed" });
        const pendingBookings = await Booking.countDocuments({ status: "pending" });
        const cancelledBookings = await Booking.countDocuments({ status: "cancelled" });

        // Real revenue from paid bookings
        const revenueResult = await Booking.aggregate([
            { $match: { payment_status: "paid" } },
            { $group: { _id: null, total: { $sum: "$total_amount" } } }
        ]);
        const totalRevenue = revenueResult[0]?.total || 0;

        // Monthly bookings for chart (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyData = await Booking.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
                    bookings: { $sum: 1 },
                    revenue: { $sum: { $cond: [{ $eq: ["$payment_status", "paid"] }, "$total_amount", 0] } }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // Build rolling 6-month bucket (oldest -> current). Fill 0 where no data.
        const dataMap = new Map();
        monthlyData.forEach(d => {
            dataMap.set(`${d._id.year}-${d._id.month}`, {
                bookings: d.bookings,
                revenue: d.revenue,
            });
        });

        const today = new Date();
        const monthlyChart = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
            const entry = dataMap.get(key) || { bookings: 0, revenue: 0 };
            monthlyChart.push({
                month: monthNames[d.getMonth()],
                bookings: entry.bookings,
                revenue: entry.revenue,
            });
        }

        // Provider growth: this month new providers vs last month new providers
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const newThisMonth = await User.countDocuments({
            role: "provider",
            createdAt: { $gte: startOfThisMonth },
        });
        const newLastMonth = await User.countDocuments({
            role: "provider",
            createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth },
        });
        const providersGrowth = newLastMonth === 0
            ? (newThisMonth > 0 ? 100 : 0)
            : Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 1000) / 10;

        // ── 4 KPI metrics ──
        // 1. Cancellation rate
        const cancellationRate = totalBookings > 0
            ? Math.round((cancelledBookings / totalBookings) * 1000) / 10
            : 0;

        // 2. Avg booking value (revenue per paid booking)
        const paidBookingsCount = await Booking.countDocuments({ payment_status: "paid" });
        const avgBookingValue = paidBookingsCount > 0
            ? Math.round((totalRevenue / paidBookingsCount) * 100) / 100
            : 0;

        // 3. Refund rate (refunded / paid)
        const refundedCount = await Booking.countDocuments({ payment_status: "refunded" });
        const refundRate = paidBookingsCount > 0
            ? Math.round((refundedCount / (paidBookingsCount + refundedCount)) * 1000) / 10
            : 0;

        // 4. Retention rate — customers with 2+ bookings
        const repeatCustomersAgg = await Booking.aggregate([
            { $group: { _id: "$customer_id", count: { $sum: 1 } } },
            { $match: { count: { $gte: 2 } } },
            { $count: "repeat" }
        ]);
        const repeatCustomers = repeatCustomersAgg[0]?.repeat || 0;
        const retentionRate = totalCustomers > 0
            ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10
            : 0;

        return res.json({
            totalUsers, totalCustomers, totalProviders, activeProviders,
            totalBookings, completedBookings, pendingBookings, cancelledBookings,
            totalRevenue, monthlyChart, providersGrowth,
            cancellationRate, avgBookingValue, refundRate, retentionRate,
            paidBookingsCount, refundedCount, repeatCustomers
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// GET /api/admin/dashboard-insights
export async function getDashboardInsights(req, res) {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        // ── Live Activity Feed (last 10 events) ──
        const recentBookings = await Booking.find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("customer_id", "full_name")
            .populate("provider_id", "full_name")
            .populate("service_id", "service_name")
            .lean();

        const recentPaidBookings = await Booking.find({ payment_status: "paid" })
            .sort({ updatedAt: -1 })
            .limit(3)
            .populate("customer_id", "full_name")
            .populate("provider_id", "full_name")
            .lean();

        let recentReviews = [];
        try {
            const ReviewModel = mongoose.models.Review || mongoose.models.Reviews;
            if (ReviewModel) {
                recentReviews = await ReviewModel.find({})
                    .sort({ createdAt: -1 })
                    .limit(3)
                    .populate("customer_id", "full_name")
                    .populate("provider_id", "full_name")
                    .lean();
            }
        } catch (e) {
            recentReviews = [];
        }

        const recentCustomers = await User.find({ role: "customer" })
            .sort({ createdAt: -1 })
            .limit(3)
            .select("full_name createdAt")
            .lean();

        const recentCompletedBookings = await Booking.find({ status: "completed" })
            .sort({ updatedAt: -1 })
            .limit(3)
            .populate("provider_id", "full_name")
            .lean();

        const activities = [];

        recentBookings.forEach(b => {
            activities.push({
                icon: "✅",
                text: "New booking created",
                user: b.customer_id?.full_name || "Customer",
                time: b.createdAt,
                color: "bg-green-50",
                type: "booking"
            });
        });

        recentPaidBookings.forEach(b => {
            activities.push({
                icon: "💰",
                text: "Payment received",
                user: `$${b.total_amount} from ${b.customer_id?.full_name || "Customer"}`,
                time: b.updatedAt,
                color: "bg-blue-50",
                type: "payment"
            });
        });

        recentReviews.forEach(r => {
            activities.push({
                icon: "⭐",
                text: `${r.rating}-star review`,
                user: `for ${r.provider_id?.full_name || "Provider"}`,
                time: r.createdAt,
                color: "bg-yellow-50",
                type: "review"
            });
        });

        recentCustomers.forEach(c => {
            activities.push({
                icon: "👋",
                text: "New customer joined",
                user: c.full_name || "Customer",
                time: c.createdAt,
                color: "bg-purple-50",
                type: "user"
            });
        });

        recentCompletedBookings.forEach(b => {
            activities.push({
                icon: "🔧",
                text: "Service completed",
                user: `by ${b.provider_id?.full_name || "Provider"}`,
                time: b.updatedAt,
                color: "bg-pink-50",
                type: "completed"
            });
        });

        // Sort by time, take latest 8
        activities.sort((a, b) => new Date(b.time) - new Date(a.time));
        const liveFeed = activities.slice(0, 8);

        // ── Top Providers (by completed bookings + earnings) ──
        const topProvidersAgg = await Booking.aggregate([
            { $match: { status: "completed", payment_status: "paid" } },
            {
                $group: {
                    _id: "$provider_id",
                    earnings: { $sum: "$total_amount" },
                    jobs: { $sum: 1 }
                }
            },
            { $sort: { earnings: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "provider"
                }
            },
            { $unwind: "$provider" },
            {
                $project: {
                    name: "$provider.full_name",
                    email: "$provider.email",
                    earnings: 1,
                    jobs: 1
                }
            }
        ]);

        const topProviders = topProvidersAgg.map((p, i) => ({
            rank: i + 1,
            name: p.name || "Provider",
            earnings: Math.round(p.earnings * 0.85), // after platform commission
            jobs: p.jobs,
            badge: i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1),
            gradient: i === 0 ? "from-yellow-100 to-amber-100"
                : i === 1 ? "from-gray-100 to-slate-100"
                    : i === 2 ? "from-orange-100 to-amber-100"
                        : i === 3 ? "from-blue-50 to-indigo-50"
                            : "from-purple-50 to-pink-50"
        }));

        // ── Trending Service Category (last 30 days) ──
        const trendingAgg = await Booking.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $lookup: {
                    from: "services",
                    localField: "service_id",
                    foreignField: "_id",
                    as: "service"
                }
            },
            { $unwind: "$service" },
            {
                $lookup: {
                    from: "categories",
                    localField: "service.category_id",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            {
                $group: {
                    _id: "$category.category_name",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        const trending = trendingAgg[0] || { _id: "Plumbing", count: 0 };

        // Calculate trend % (compare last 30 days vs previous 30 days)
        const previousPeriodCount = await Booking.countDocuments({
            createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
        });
        const currentPeriodCount = await Booking.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        const trendPercent = previousPeriodCount > 0
            ? Math.round(((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100)
            : currentPeriodCount > 0 ? 100 : 0;

        // ── Real Category Distribution ──
        const categoryDistAgg = await Booking.aggregate([
            { $match: { payment_status: "paid" } },
            {
                $lookup: {
                    from: "services",
                    localField: "service_id",
                    foreignField: "_id",
                    as: "service"
                }
            },
            { $unwind: "$service" },
            {
                $lookup: {
                    from: "categories",
                    localField: "service.category_id",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            {
                $group: {
                    _id: "$category.category_name",
                    revenue: { $sum: "$total_amount" }
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: 5 }
        ]);

        const totalRevenue = categoryDistAgg.reduce((s, c) => s + c.revenue, 0);
        const colors = ["#6366f1", "#a855f7", "#ec4899", "#f97316", "#10b981"];
        const categoryDistribution = categoryDistAgg.map((c, i) => ({
            name: c._id,
            value: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0,
            color: colors[i % colors.length]
        }));

        // ── Sparkline data (last 6 months for each metric) ──
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - i);
            last6Months.push({
                start: new Date(date.getFullYear(), date.getMonth(), 1),
                end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
            });
        }

        const revenueSparkline = await Promise.all(last6Months.map(async (m) => {
            const result = await Booking.aggregate([
                { $match: { payment_status: "paid", updatedAt: { $gte: m.start, $lte: m.end } } },
                { $group: { _id: null, total: { $sum: "$total_amount" } } }
            ]);
            return result[0]?.total || 0;
        }));

        const bookingsSparkline = await Promise.all(last6Months.map(async (m) => {
            return await Booking.countDocuments({ createdAt: { $gte: m.start, $lte: m.end } });
        }));

        const providersSparkline = await Promise.all(last6Months.map(async (m) => {
            return await User.countDocuments({
                role: "provider",
                provider_status: "verified",
                createdAt: { $lte: m.end }
            });
        }));

        const commissionSparkline = revenueSparkline.map(r => Math.round(r * 0.15));

        // ── Goal Progress: last month's bookings × 1.2 (grow 20%), min 10 ──
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthBookings = await Booking.countDocuments({ createdAt: { $gte: monthStart } });
        const lastMonthBookings = await Booking.countDocuments({
            createdAt: { $gte: lastMonthStart, $lt: monthStart },
        });
        const monthlyGoal = Math.max(10, Math.round(lastMonthBookings * 1.2));
        const goalProgress = Math.min(100, Math.round((monthBookings / monthlyGoal) * 100));

        // ── Platform Health Score (0-100) ──
        const totalProviders = await User.countDocuments({ role: "provider", provider_status: "verified" });
        const totalCustomers = await User.countDocuments({ role: "customer" });
        const totalCompletedBookings = await Booking.countDocuments({ status: "completed" });

        let healthScore = 50;
        if (totalProviders >= 5) healthScore += 15;
        if (totalCustomers >= 10) healthScore += 15;
        if (totalCompletedBookings >= 10) healthScore += 10;
        if (currentPeriodCount > previousPeriodCount) healthScore += 10;
        healthScore = Math.min(100, healthScore);

        const healthLabel = healthScore >= 80 ? "EXCELLENT"
            : healthScore >= 60 ? "GOOD"
                : healthScore >= 40 ? "FAIR"
                    : "NEEDS ATTENTION";

        return res.json({
            liveFeed,
            topProviders,
            trending: { name: trending._id, percent: trendPercent },
            categoryDistribution,
            sparklines: {
                revenue: revenueSparkline,
                bookings: bookingsSparkline,
                providers: providersSparkline,
                commission: commissionSparkline,
            },
            goalProgress,
            healthScore,
            healthLabel,
            monthlyBookings: monthBookings,
            monthlyGoal,
        });
    } catch (err) {
        console.error("getDashboardInsights error:", err);
        return res.status(500).json({ message: err.message });
    }
}

export async function getAuditLogs(req, res) {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = 20;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.action) filter.action = req.query.action;
        if (req.query.actor_id) filter.actor_id = req.query.actor_id;

        if (req.query.search) {
            const q = req.query.search;
            filter.$or = [
                { actor_email: { $regex: q, $options: "i" } },
                { action: { $regex: q, $options: "i" } },
            ];
        }

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AuditLog.countDocuments(filter),
        ]);

        res.json({
            logs,
            page,
            totalPages: Math.ceil(total / limit) || 1,
            total,
        });
    } catch (err) {
        console.error("getAuditLogs error:", err);
        res.status(500).json({ message: err.message || "Failed to load logs" });
    }
}

export async function getAuditLogActions(req, res) {
    try {
        const actions = await AuditLog.distinct("action");
        res.json({ actions: actions.sort() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}