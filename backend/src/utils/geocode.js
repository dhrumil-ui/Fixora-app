const GOOGLE_API_KEY =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_KEY;

if (!GOOGLE_API_KEY) {
    console.warn("⚠️  No Google Maps API key found — geocoding will fail");
}

/**
 * Convert address string to coordinates.
 * Returns { lng, lat, formatted_address } or null if not found.
 *
 * Example:
 *   await geocodeAddress("123 Main St, Edison NJ")
 *   → { lng: -74.4, lat: 40.52, formatted_address: "123 Main St, Edison, NJ 08817, USA" }
 */
export async function geocodeAddress(address) {
    if (!address || !String(address).trim()) return null;
    if (!GOOGLE_API_KEY) {
        throw new Error("Google Maps API key not configured");
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            address
        )}&key=${GOOGLE_API_KEY}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== "OK" || !data.results?.length) {
            console.warn(`[geocode] no result for "${address}" — status: ${data.status}`);
            return null;
        }

        const top = data.results[0];
        return {
            lng: top.geometry.location.lng,
            lat: top.geometry.location.lat,
            formatted_address: top.formatted_address,
        };
    } catch (err) {
        console.error("[geocode] error:", err.message);
        return null;
    }
}

/**
 * Calculate distance in MILES between two [lng, lat] points using haversine formula.
 *
 * Example:
 *   haversineMiles([-74.4, 40.52], [-74.74, 40.22])
 *   → ~25.1 (miles between Edison and Trenton)
 */
export function haversineMiles(point1, point2) {
    if (!point1 || !point2) return Infinity;
    const [lng1, lat1] = point1;
    const [lng2, lat2] = point2;

    const R = 3959; // Earth radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate shortest distance from a point to a line segment (in miles).
 * Used for "is customer near provider's route?" queries.
 *
 * Example: How far is Sayreville from the Trenton ↔ Edison route?
 *   distanceFromSegmentMiles(
 *     sayrevilleGeo,
 *     trentonGeo,    // segment start
 *     edisonGeo      // segment end
 *   )
 *   → ~3.5 miles
 */
export function distanceFromSegmentMiles(point, segmentStart, segmentEnd) {
    if (!point || !segmentStart || !segmentEnd) return Infinity;

    const [px, py] = point;
    const [ax, ay] = segmentStart;
    const [bx, by] = segmentEnd;

    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        // Start == End → just measure to that point
        return haversineMiles(point, segmentStart);
    }

    // Project point onto segment, clamp to [0, 1]
    let t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const closestPoint = [ax + t * dx, ay + t * dy];
    return haversineMiles(point, closestPoint);
}