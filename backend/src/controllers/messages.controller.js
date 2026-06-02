import mongoose from "mongoose";
import { Message } from "../models/Message.js";
import { Booking } from "../models/Booking.js";
import { User } from "../models/Users.js";
import { getIO, ROOMS, EVENTS } from "../socket/index.js";

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Verify that user is allowed to chat for a booking.
 * Returns { booking, role, peerId } where role is "customer" or "provider",
 * and peerId is the other party's id.
 */
async function authorizeBookingChat(userId, bookingId) {
    if (!isValidId(bookingId)) {
        return { error: "Invalid booking id", code: 400 };
    }
    const booking = await Booking.findById(bookingId).select(
        "customer_id provider_id status",
    );
    if (!booking) return { error: "Booking not found", code: 404 };

    const uid = String(userId);
    const cid = String(booking.customer_id);
    const pid = String(booking.provider_id);

    if (uid !== cid && uid !== pid) {
        return { error: "Not authorized for this booking", code: 403 };
    }

    return {
        booking,
        role: uid === cid ? "customer" : "provider",
        peerId: uid === cid ? booking.provider_id : booking.customer_id,
    };
}

/**
 * GET /api/messages/:bookingId
 * Returns all messages for a booking, oldest first.
 */
export async function listMessages(req, res) {
    try {
        const { bookingId } = req.params;
        const auth = await authorizeBookingChat(req.user.id, bookingId);
        if (auth.error) return res.status(auth.code).json({ message: auth.error });

        const messages = await Message.find({ booking_id: bookingId })
            .sort({ createdAt: 1 })
            .populate("sender_id", "full_name role")
            .lean();

        return res.json({ messages });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

/**
 * POST /api/messages/:bookingId
 * Body: { body: string }
 * Creates a message and emits real-time events.
 */
export async function sendMessage(req, res) {
    try {
        const { bookingId } = req.params;
        const { body } = req.body;

        if (!body || typeof body !== "string" || !body.trim()) {
            return res.status(400).json({ message: "Message body is required" });
        }
        if (body.length > 2000) {
            return res
                .status(400)
                .json({ message: "Message too long (max 2000 chars)" });
        }

        const auth = await authorizeBookingChat(req.user.id, bookingId);
        if (auth.error) return res.status(auth.code).json({ message: auth.error });

        const message = await Message.create({
            booking_id: bookingId,
            sender_id: req.user.id,
            recipient_id: auth.peerId,
            body: body.trim(),
        });

        // Populate sender for socket payload
        await message.populate("sender_id", "full_name role");

        // Emit to both parties' booking room
        try {
            const io = getIO();
            io.to(ROOMS.booking(bookingId)).emit(EVENTS.CHAT_MESSAGE_NEW, {
                bookingId,
                message,
            });
            // Tell the recipient their unread count likely changed
            io.to(ROOMS.user(String(auth.peerId))).emit(EVENTS.CHAT_UNREAD_UPDATE, {
                bookingId,
            });
        } catch (err) {
            console.error("[chat] socket emit failed:", err.message);
        }

        return res.status(201).json({ message });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

/**
 * PATCH /api/messages/:bookingId/read
 * Marks all messages in this booking sent TO the current user as read.
 */
export async function markRead(req, res) {
    try {
        const { bookingId } = req.params;
        const auth = await authorizeBookingChat(req.user.id, bookingId);
        if (auth.error) return res.status(auth.code).json({ message: auth.error });

        const result = await Message.updateMany(
            {
                booking_id: bookingId,
                recipient_id: req.user.id,
                read_at: null,
            },
            { $set: { read_at: new Date() } },
        );

        // Notify the OTHER party that their sent messages are now read
        try {
            const io = getIO();
            io.to(ROOMS.user(String(auth.peerId))).emit(EVENTS.CHAT_MESSAGE_READ, {
                bookingId,
                readerId: req.user.id,
            });
            // Update unread badge for current user
            io.to(ROOMS.user(String(req.user.id))).emit(EVENTS.CHAT_UNREAD_UPDATE, {
                bookingId,
            });
        } catch (err) {
            console.error("[chat] socket emit failed:", err.message);
        }

        return res.json({ updated: result.modifiedCount });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

/**
 * GET /api/messages/unread-counts
 * Returns { [bookingId]: count } map for badges.
 */
export async function unreadCounts(req, res) {
    try {
        const counts = await Message.aggregate([
            {
                $match: {
                    recipient_id: new mongoose.Types.ObjectId(req.user.id),
                    read_at: null,
                },
            },
            {
                $group: {
                    _id: "$booking_id",
                    count: { $sum: 1 },
                },
            },
        ]);

        const map = {};
        let total = 0;
        counts.forEach((c) => {
            map[String(c._id)] = c.count;
            total += c.count;
        });

        return res.json({ counts: map, total });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

/**
 * Admin: GET /api/admin/conversations
 * Lists all booking chats with metadata (for moderation tab).
 */
export async function adminListConversations(req, res) {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Number(req.query.limit) || 10);
        const skip = (page - 1) * limit;

        // Aggregate: one entry per booking_id with last message + count
        const pipeline = [
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$booking_id",
                    last_message: { $first: "$body" },
                    last_at: { $first: "$createdAt" },
                    message_count: { $sum: 1 },
                },
            },
            { $sort: { last_at: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "bookings",
                    localField: "_id",
                    foreignField: "_id",
                    as: "booking",
                },
            },
            { $unwind: "$booking" },
            {
                $lookup: {
                    from: "users",
                    localField: "booking.customer_id",
                    foreignField: "_id",
                    as: "customer",
                },
            },
            { $unwind: "$customer" },
            {
                $lookup: {
                    from: "users",
                    localField: "booking.provider_id",
                    foreignField: "_id",
                    as: "provider",
                },
            },
            { $unwind: "$provider" },
            {
                $project: {
                    booking_id: "$_id",
                    last_message: 1,
                    last_at: 1,
                    message_count: 1,
                    "customer.full_name": 1,
                    "customer.email": 1,
                    "provider.full_name": 1,
                    "provider.email": 1,
                    "booking.status": 1,
                    "booking.date": 1,
                },
            },
        ];

        const conversations = await Message.aggregate(pipeline);

        // Total count of distinct booking chats
        const totalGroups = await Message.aggregate([
            { $group: { _id: "$booking_id" } },
            { $count: "total" },
        ]);
        const total = totalGroups[0]?.total || 0;

        return res.json({
            conversations,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

/**
 * Admin: GET /api/admin/conversations/:bookingId
 * Read-only view of a single conversation's full message thread.
 */
export async function adminViewConversation(req, res) {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }
        const { bookingId } = req.params;
        if (!isValidId(bookingId)) {
            return res.status(400).json({ message: "Invalid booking id" });
        }

        const messages = await Message.find({ booking_id: bookingId })
            .sort({ createdAt: 1 })
            .populate("sender_id", "full_name email role")
            .lean();

        return res.json({ messages });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}