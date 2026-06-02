import mongoose from "mongoose";
import { Service } from "../models/Services.js";
import { User } from "../models/Users.js";
import { Category } from "../models/Categories.js";
import { Booking } from "../models/Booking.js";
import { geocodeAddress, haversineMiles, distanceFromSegmentMiles } from "../utils/geocode.js";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}
export async function createService(req, res) {
  try {
    const providerId = req.user.id;
    const { category_id, service_name, description, price, pricing_type, seasonal_months } = req.body;

    if (!category_id || !service_name || price === undefined || !pricing_type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const finalPricingType = pricing_type || "fixed";

    if (!["hourly", "fixed"].includes(finalPricingType)) {
      return res.status(400).json({ message: "pricing_type must be hourly or fixed" });
    }

    if (!["hourly", "fixed"].includes(pricing_type)) {
      return res.status(400).json({ message: "pricing_type must be hourly or fixed" });
    }

    if (!mongoose.Types.ObjectId.isValid(category_id)) {
      return res.status(400).json({ message: "Invalid category_id" });
    }

    const category = await Category.findById(category_id);
    if (!category) return res.status(400).json({ message: "Category not found" });

    // ✅ Validate pricing type allowed
    if (!category.allowed_pricing_types.includes(pricing_type)) {
      return res.status(400).json({
        message: `This category only allows: ${category.allowed_pricing_types.join(", ")} pricing`
      });
    }

    // ✅ Validate price range
    if (price < category.min_price) {
      return res.status(400).json({
        message: `Minimum price for this category is $${category.min_price}`
      });
    }
    if (price > category.max_price) {
      return res.status(400).json({
        message: `Maximum price for this category is $${category.max_price}`
      });
    }

    const provider = await User.findById(providerId).select(
      "_id role is_active is_profile_complete provider_status provider_profile"
    );

    if (!provider || !["provider", "admin"].includes(provider.role)) {
      return res.status(403).json({ message: "Only providers can create services" });
    }

    if (provider.is_active === false) {
      return res.status(403).json({ message: "Provider is not active" });
    }

    if (!provider.is_profile_complete) {
      return res.status(400).json({
        message: "Provider profile not completed",
        code: "PROFILE_INCOMPLETE",
      });
    }

    if (provider.provider_profile?.is_available === false) {
      return res.status(403).json({
        message: "Provider is not available",
        code: "PROVIDER_NOT_AVAILABLE",
      });
    }

    const isVerified = provider.provider_status === "verified";

    // Reject duplicates: same provider + category + service name (case-insensitive)
    const existing = await Service.findOne({
      provider_id: providerId,
      category_id,
      service_name: { $regex: `^${String(service_name).trim()}$`, $options: "i" },
    });
    if (existing) {
      return res.status(409).json({
        message: "Service already exists",
        code: "DUPLICATE_SERVICE",
      });
    }

    const doc = await Service.create({
      provider_id: providerId,
      category_id,
      service_name,
      description,
      pricing_type,
      price: Number(price),
      is_active: isVerified,
      seasonal_months: Array.isArray(seasonal_months) ? seasonal_months : [],
    });

    return res.status(201).json({ message: "Service created", service: doc });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function listServices(req, res) {
  try {
    const services = await Service.find({ is_active: true })
      .populate({
        path: "provider_id",
        match: {
          provider_status: "verified",
          is_profile_complete: true,
          is_active: true,
          "provider_profile.is_available": true,
        },
        select: "full_name provider_profile provider_status is_profile_complete availability",
      })
      .populate({
        path: "category_id",
        select: "category_name icon",
      })
      .lean();

    let visible = services.filter((s) => s.provider_id);

    // 📍 Optional location filter — Signal 1 (Home + Radius)
    let customerGeo = null;

    if (req.query.lat && req.query.lng) {
      // Customer provided coords directly (GPS)
      customerGeo = [Number(req.query.lng), Number(req.query.lat)];
    } else if (req.query.location) {
      // Customer provided a typed address — geocode it
      const geo = await geocodeAddress(String(req.query.location));
      if (geo) customerGeo = [geo.lng, geo.lat];
    }

    if (customerGeo) {
      // 🛣️ Signal 2 — Pre-fetch each provider's future bookings (route corridor)
      const providerIds = visible
        .map((s) => s.provider_id?._id)
        .filter(Boolean);

      // Get all future confirmed bookings for these providers, sorted by date+time
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const futureBookings = await Booking.find({
        provider_id: { $in: providerIds },
        status: "confirmed",
        date: { $gte: todayStr },
        "service_geo.coordinates": { $exists: true },
      })
        .select("provider_id date time service_geo")
        .lean();

      // Group by provider
      const bookingsByProvider = {};
      futureBookings.forEach((b) => {
        const pid = String(b.provider_id);
        if (!bookingsByProvider[pid]) bookingsByProvider[pid] = [];
        bookingsByProvider[pid].push(b);
      });

      // Sort each provider's bookings chronologically
      Object.keys(bookingsByProvider).forEach((pid) => {
        bookingsByProvider[pid].sort((a, b) => {
          const aKey = `${a.date} ${a.time || "00:00"}`;
          const bKey = `${b.date} ${b.time || "00:00"}`;
          return aKey.localeCompare(bKey);
        });
      });

      // Score each service by distance + route corridor
      const scored = visible
        .map((s) => {
          const provGeo = s.provider_id?.provider_profile?.home_geo?.coordinates;
          const maxTravel = s.provider_id?.provider_profile?.max_travel_miles || 25;

          if (!provGeo || provGeo.length !== 2) {
            return { ...s, _distance_miles: null, _location_score: -50 };
          }
          const homeDist = haversineMiles(customerGeo, provGeo);
          let locationScore;
          if (homeDist <= maxTravel * 0.5) locationScore = 30;
          else if (homeDist <= maxTravel) locationScore = 20;
          else if (homeDist <= maxTravel * 1.5) locationScore = 5;
          else locationScore = -50;
          let seasonalBonus = 0;
          let seasonalReason = null;
          const currentMonth = new Date().getMonth() + 1; // 1-12
          if (Array.isArray(s.seasonal_months) && s.seasonal_months.includes(currentMonth)) {
            seasonalBonus = 12;
            seasonalReason = "In season";
          }
          // === Signal 7 — Time of Day (working hours match) ===
          let timeBonus = 0;
          let timeReason = null;
          const now = new Date();
          const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
          const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
          const avail = s.provider_id?.availability;
          if (avail) {
            const isWorkingDay = avail.days?.includes(dayShort);
            const inHours = avail.start_time && avail.end_time &&
              currentTime >= avail.start_time && currentTime <= avail.end_time;
            if (isWorkingDay && inHours) {
              timeBonus = 8;
              timeReason = "Available now";
            }
          }

          // === Signal 8 — Capacity (free slots today) ===
          let capacityBonus;
          let capacityReason;
          const todayBookings = (bookingsByProvider[String(s.provider_id._id)] || [])
            .filter((b) => b.date === todayStr);
          if (todayBookings.length === 0) {
            capacityBonus = 6;
            capacityReason = "Free today";
          } else if (todayBookings.length <= 2) {
            capacityBonus = 3;
            capacityReason = `${todayBookings.length} jobs today`;
          } else {
            capacityBonus = 0;
            capacityReason = "Busy today";
          }

          // === Signals 9 & 10 — Response Speed + Reliability (from precomputed metrics) ===
          let qualityBonus = 0;
          let qualityReason = null;
          const reliability = s.provider_id?.provider_profile?.reliability_score; // 0-100
          const avgResponseMin = s.provider_id?.provider_profile?.avg_response_minutes;

          if (avgResponseMin && avgResponseMin <= 30) {
            qualityBonus += 5;
            qualityReason = `Fast responder`;
          }
          if (reliability && reliability >= 90) {
            qualityBonus += 5;
            qualityReason = qualityReason ? `${qualityReason} • Reliable` : `Reliable`;
          }
          let routeBonus = 0;
          let routeReason = null;
          const provBookings = bookingsByProvider[String(s.provider_id._id)] || [];
          const waypoints = [provGeo];
          provBookings.forEach((b) => {
            if (b.service_geo?.coordinates) {
              waypoints.push(b.service_geo.coordinates);
            }
          });
          waypoints.push(provGeo);
          let minRouteDist = Infinity;
          for (let i = 0; i < waypoints.length - 1; i++) {
            const segDist = distanceFromSegmentMiles(
              customerGeo,
              waypoints[i],
              waypoints[i + 1],
            );
            if (segDist < minRouteDist) minRouteDist = segDist;
          }

          // Within 10-mile corridor of any route → bonus
          if (minRouteDist <= 10 && provBookings.length > 0) {
            routeBonus = 15; // big bonus — provider is already passing through
            routeReason = `On route (${Math.round(minRouteDist * 10) / 10}mi from path)`;
          } else if (minRouteDist <= 15 && provBookings.length > 0) {
            routeBonus = 7; // small bonus — close to route
            routeReason = `Near route (${Math.round(minRouteDist * 10) / 10}mi from path)`;
          }

          return {
            ...s,
            _distance_miles: Math.round(homeDist * 10) / 10,
            _location_score: locationScore + routeBonus + seasonalBonus + timeBonus + capacityBonus + qualityBonus,
            _route_bonus: routeBonus,
            _route_reason: routeReason,
            _seasonal_bonus: seasonalBonus,
            _seasonal_reason: seasonalReason,
            _time_bonus: timeBonus,
            _time_reason: timeReason,
            _capacity_bonus: capacityBonus,
            _capacity_reason: capacityReason,
            _quality_bonus: qualityBonus,
            _quality_reason: qualityReason,
            _within_range: homeDist <= maxTravel,
            _future_bookings: provBookings.length,
          };
        })
        .filter((s) => s._location_score > -50)
        .sort((a, b) => b._location_score - a._location_score);

      return res.json({
        services: scored,
        customer_location: customerGeo,
        location_used: req.query.location || `${req.query.lat},${req.query.lng}`,
      });
    }

    // No location provided — return all (legacy behavior)
    return res.json({ services: visible });
  } catch (e) {
    console.error("listServices error:", e);
    return res.status(500).json({ message: e.message });
  }
}

export async function myProviderServices(req, res) {
  try {
    const providerId = req.user.id;
    const { page, search = "" } = req.query;
    const PAGE_SIZE = 5;

    const query = req.user.role === "admin" ? {} : { provider_id: providerId }; if (search) query.service_name = { $regex: search, $options: "i" };

    if (!page) {
      const services = await Service.find(query)
        .sort({ createdAt: -1 })
        .populate({ path: "category_id", select: "category_name icon" });
      return res.json({ services });
    }

    const skip = (Number(page) - 1) * PAGE_SIZE;
    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .populate({ path: "category_id", select: "category_name icon" });

    return res.json({ services, total, page: Number(page), totalPages: Math.ceil(total / PAGE_SIZE) });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function updateMyService(req, res) {
  try {
    const providerId = req.user.id;
    const { id } = req.params;
    const { service_name, description, price, category_id, seasonal_months } = req.body;

    if (!isValidId(id)) return res.status(400).json({ message: "Invalid service id" });

    const svc = await Service.findOne({ _id: id, provider_id: providerId });
    if (!svc) return res.status(404).json({ message: "Service not found" });

    if (category_id) {
      if (!isValidId(category_id)) return res.status(400).json({ message: "Invalid category_id" });
      const cat = await Category.findById(category_id).select("_id");
      if (!cat) return res.status(400).json({ message: "Category not found" });
      svc.category_id = category_id;
    }

    if (service_name !== undefined) svc.service_name = String(service_name).trim();
    if (description !== undefined) svc.description = String(description).trim();
    if (price !== undefined) svc.price = Number(price);
    if (Array.isArray(seasonal_months)) svc.seasonal_months = seasonal_months;

    // Reject duplicates: same provider + category + name (case-insensitive),
    // excluding the current service being edited.
    const dup = await Service.findOne({
      _id: { $ne: svc._id },
      provider_id: providerId,
      category_id: svc.category_id,
      service_name: { $regex: `^${String(svc.service_name).trim()}$`, $options: "i" },
    });
    if (dup) {
      return res.status(409).json({
        message: "Service already exists",
        code: "DUPLICATE_SERVICE",
      });
    }

    await svc.save();
    return res.json({ message: "Service updated", service: svc });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function toggleMyService(req, res) {
  try {
    const providerId = req.user.id;
    const { id } = req.params;

    if (!isValidId(id)) return res.status(400).json({ message: "Invalid service id" });

    const svc = await Service.findOne({ _id: id, provider_id: providerId });
    if (!svc) return res.status(404).json({ message: "Service not found" });

    svc.is_active = !svc.is_active;
    await svc.save();

    return res.json({ message: "Service status updated", service: svc });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function deleteMyService(req, res) {
  try {
    const providerId = req.user.id;
    const { id } = req.params;

    if (!isValidId(id)) return res.status(400).json({ message: "Invalid service id" });

    const svc = await Service.findOneAndDelete({ _id: id, provider_id: providerId });
    if (!svc) return res.status(404).json({ message: "Service not found" });

    return res.json({ message: "Service deleted" });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}