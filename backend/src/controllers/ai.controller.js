import { generateProviderBio, chatbotReply, analyzeIssue } from "../services/ai.service.js";
import { User } from "../models/Users.js";
import { Booking } from "../models/Booking.js";
import { Service } from "../models/Services.js";
import { geocodeAddress, haversineMiles } from "../utils/geocode.js";
import { smartSearch } from "../services/ai.service.js";

export async function generateBio(req, res) {
    try {
        if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

        const provider = await User.findById(req.user.id).lean();
        if (!provider) return res.status(404).json({ message: "User not found" });

        if (provider.role !== "provider") {
            return res.status(403).json({ message: "Only providers can generate bios" });
        }

        const services = await Service.find({ provider_id: provider._id })
            .populate("category_id", "category_name")
            .lean();

        const serviceNames = [
            ...new Set(
                services.flatMap((s) =>
                    [s.service_name, s.category_id?.category_name].filter(Boolean)
                )
            ),
        ];

        const completedJobs = await Booking.countDocuments({
            provider_id: provider._id,
            status: "completed",
        });

        const result = await generateProviderBio({
            full_name: provider.full_name,
            experience_years: provider.provider_profile?.experience_years,
            services: serviceNames,
            rating_avg: provider.provider_profile?.rating_avg,
            rating_count: provider.provider_profile?.rating_count,
            completed_jobs: completedJobs,
            city: provider.provider_profile?.city,
            bio_keywords: req.body?.keywords || "",
            tone: req.body?.tone || "professional",
        });

        return res.json({
            bio: result.text,
            stats: {
                services_count: serviceNames.length,
                completed_jobs: completedJobs,
                rating: provider.provider_profile?.rating_avg,
            },
            ai: {
                model: result.model,
                input_tokens: result.input_tokens,
                output_tokens: result.output_tokens,
            },
        });
    } catch (err) {
        console.error("generateBio error:", err);
        return res.status(500).json({ message: err.message });
    }
}

export async function smartSearchEndpoint(req, res) {
    try {
        const { query, location, lat, lng } = req.body || {};
        if (!query || !String(query).trim()) {
            return res.status(400).json({ message: "Query is required" });
        }

        // Resolve customer location
        let customerGeo = null;
        let locationLabel = location || "";
        if (lat && lng) {
            customerGeo = [Number(lng), Number(lat)];
            locationLabel = `${lat},${lng}`;
        } else if (location) {
            const geo = await geocodeAddress(String(location));
            if (geo) customerGeo = [geo.lng, geo.lat];
        }

        // Fetch services (same as listServices)
        const services = await Service.find({ is_active: true })
            .populate({
                path: "provider_id",
                match: {
                    provider_status: "verified",
                    is_profile_complete: true,
                    is_active: true,
                    "provider_profile.is_available": true,
                },
                select: "full_name provider_profile provider_status is_profile_complete",
            })
            .populate({
                path: "category_id",
                select: "category_name icon",
            })
            .lean();

        let visible = services.filter((s) => s.provider_id);

        // Score by distance if customer location known
        if (customerGeo) {
            visible = visible
                .map((s) => {
                    const provGeo = s.provider_id?.provider_profile?.home_geo?.coordinates;
                    const maxTravel = s.provider_id?.provider_profile?.max_travel_miles || 25;
                    if (!provGeo || provGeo.length !== 2) {
                        return { ...s, _distance_miles: null, _location_score: -50 };
                    }
                    const distance = haversineMiles(customerGeo, provGeo);
                    let score;
                    if (distance <= maxTravel * 0.5) score = 30;
                    else if (distance <= maxTravel) score = 20;
                    else if (distance <= maxTravel * 1.5) score = 5;
                    else score = -50;
                    return {
                        ...s,
                        _distance_miles: Math.round(distance * 10) / 10,
                        _location_score: score,
                        _within_range: distance <= maxTravel,
                    };
                })
                .filter((s) => s._location_score > -50)
                .sort((a, b) => b._location_score - a._location_score);
        }

        if (!visible.length) {
            return res.json({ picks: [], message: "No services in your area" });
        }

        // Send top candidates to AI for rerank + reasoning
        const candidates = visible.slice(0, 20);
        const { picks, error } = await smartSearch({
            query,
            services: candidates,
            customerLocation: locationLabel,
        });

        return res.json({
            picks,
            query,
            customer_location: customerGeo,
            candidates_count: candidates.length,
            ai_error: error || null,
        });
    } catch (e) {
        console.error("smartSearchEndpoint:", e);
        return res.status(500).json({ message: e.message });
    }
}

/**
 * POST /api/ai/chat
 * Customer support chatbot.
 *
 * Body: { message, history }
 */
export async function chatSupport(req, res) {
    try {
        const { message, history = [] } = req.body || {};
        if (!message?.trim()) return res.status(400).json({ message: "Empty message" });

        const recentHistory = history.slice(-10);

        const result = await chatbotReply({
            userMessage: message.trim(),
            conversationHistory: recentHistory,
        });

        return res.json({ reply: result.text, model: result.model });
    } catch (err) {
        console.error("chatSupport error:", err);
        return res.status(500).json({ message: err.message });
    }
}

/**
 * POST /api/ai/admin/analyze-issue
 * Analyze a customer complaint and suggest admin action.
 *
 * Body: { description, booking_id }
 */
export async function analyzeIssueEndpoint(req, res) {
    try {
        if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const { description, booking_id } = req.body || {};

        let booking = null;
        if (booking_id) {
            booking = await Booking.findById(booking_id)
                .populate("customer_id", "email full_name")
                .lean();
        }

        const result = await analyzeIssue({
            issueDescription: description || "No description",
            bookingStatus: booking?.status || "unknown",
            paymentStatus: booking?.payment_status || "unknown",
            amount: booking?.total_amount || 0,
            customerHistory: "first complaint",
        });

        return res.json(result);
    } catch (err) {
        console.error("analyzeIssue error:", err);
        return res.status(500).json({ message: err.message });
    }
}