import { Review } from "../models/Reviews.js";
import { Booking } from "../models/Booking.js";
import { User } from "../models/Users.js";
import { Service } from "../models/Services.js";
import {
    emitReviewCreated,
    emitReviewUpdated,
    emitReviewDeleted,
    emitReviewToggled,
} from "../socket/emitters.js";

const PAGE_SIZE = 5;

function getPageSize(req) {
    const n = Number(req.query?.limit);
    if (!n || n < 1) return PAGE_SIZE;
    return Math.min(n, 10000);
}

export async function createReview(req, res) {
    try {
        const customer_id = req.user.id;
        const { booking_id, rating, comment } = req.body;

        if (!booking_id || !rating) {
            return res.status(400).json({ message: "booking_id and rating are required" });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 1 and 5" });
        }

        const booking = await Booking.findById(booking_id);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (booking.customer_id.toString() !== customer_id) {
            return res.status(403).json({ message: "Not your booking" });
        }

        if (booking.status !== "completed" && booking.status !== "work_completed") {
            return res.status(400).json({ message: "Can only review completed bookings" });
        }

        const existing = await Review.findOne({ booking_id });
        if (existing) {
            return res.status(400).json({ message: "You already reviewed this booking" });
        }

        const review = await Review.create({
            booking_id,
            customer_id,
            provider_id: booking.provider_id,
            service_id: booking.service_id,
            rating: Number(rating),
            comment: comment?.trim() || "",
        });

        const allReviews = await Review.find({
            provider_id: booking.provider_id,
            is_visible: true,
        });

        const serviceReviews = await Review.find({
            service_id: booking.service_id,
            is_visible: true,
        });
        const serviceAvg = serviceReviews.reduce((sum, r) => sum + r.rating, 0) / serviceReviews.length;

        await Service.findByIdAndUpdate(booking.service_id, {
            $set: {
                rating_avg: Math.round(serviceAvg * 10) / 10,
                rating_count: serviceReviews.length,
            },
        });

        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

        await User.findByIdAndUpdate(
            booking.provider_id,
            {
                $set: {
                    "provider_profile.rating_avg": Math.round(avgRating * 10) / 10,
                    "provider_profile.rating_count": allReviews.length,
                },
            },
            { new: true }
        );

        emitReviewCreated(review);

        return res.status(201).json({ message: "Review submitted", review });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

export async function getProviderReviews(req, res) {
    try {
        const reviews = await Review.find({
            provider_id: req.params.providerId,
            is_visible: true,
        })
            .populate({ path: "customer_id", select: "full_name" })
            .populate({ path: "service_id", select: "service_name" })
            .sort({ createdAt: -1 });

        const avg = reviews.length
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

        return res.json({
            reviews,
            avg_rating: Math.round(avg * 10) / 10,
            total: reviews.length,
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

export async function checkReview(req, res) {
    try {
        const review = await Review.findOne({ booking_id: req.params.bookingId });
        return res.json({ reviewed: !!review, review });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// GET - All reviews (admin) with pagination + search
export async function getAllReviews(req, res) {
    try {
        const { page = 1, search = "" } = req.query;
        const pageSize = getPageSize(req);
        const skip = (Number(page) - 1) * pageSize;

        const total = await Review.countDocuments();
        const reviews = await Review.find()
            .populate({ path: "customer_id", select: "full_name email" })
            .populate({ path: "provider_id", select: "full_name email" })
            .populate({ path: "service_id", select: "service_name" })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize);

        const filtered = search
            ? reviews.filter(r =>
                (r.customer_id?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
                (r.provider_id?.full_name || "").toLowerCase().includes(search.toLowerCase())
            )
            : reviews;

        return res.json({
            reviews: filtered,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

export async function toggleReview(req, res) {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ message: "Review not found" });
        review.is_visible = !review.is_visible;
        await review.save();
        emitReviewToggled(review);
        return res.json({ message: "Review updated", review });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

export async function deleteReview(req, res) {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ message: "Review not found" });
        const reviewId = review._id;
        const providerId = review.provider_id;
        await Review.findByIdAndDelete(req.params.id);
        emitReviewDeleted(reviewId, providerId);
        return res.json({ message: "Review deleted" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

export async function updateReview(req, res) {
    try {
        const { rating, comment } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 1 and 5" });
        }

        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ message: "Review not found" });

        if (review.customer_id.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not your review" });
        }

        review.rating = Number(rating);
        review.comment = comment?.trim() || "";
        await review.save();

        const allReviews = await Review.find({
            provider_id: review.provider_id,
            is_visible: true,
        });
        const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        await User.findByIdAndUpdate(review.provider_id, {
            $set: {
                "provider_profile.rating_avg": Math.round(avg * 10) / 10,
                "provider_profile.rating_count": allReviews.length,
            },
        });

        const serviceReviews = await Review.find({
            service_id: review.service_id,
            is_visible: true,
        });
        const serviceAvg = serviceReviews.reduce((sum, r) => sum + r.rating, 0) / serviceReviews.length;
        await Service.findByIdAndUpdate(review.service_id, {
            $set: {
                rating_avg: Math.round(serviceAvg * 10) / 10,
                rating_count: serviceReviews.length,
            },
        });
        emitReviewUpdated(review);
        return res.json({ message: "Review updated", review });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}