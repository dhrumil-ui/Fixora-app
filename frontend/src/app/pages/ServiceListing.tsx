import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";
import { useSocketEvent } from "../hooks/useSocket";
import { EVENTS } from "../lib/socketEvents";

type Service = {
  _id: string;
  service_name: string;
  description?: string;
  price?: number;
  pricing_type?: string;
  rating_avg?: number;
  rating_count?: number;
  category_id?: { _id: string; category_name?: string; name?: string } | string;
  provider_id?: {
    _id: string;
    full_name?: string;
    email?: string;
    provider_profile?: { rating_avg?: number; rating_count?: number };
  };
  _distance_miles?: number | null;
  _location_score?: number;
  _within_range?: boolean;
  _route_bonus?: number;
  _route_reason?: string | null;
  _future_bookings?: number;
  _seasonal_bonus?: number;
  _seasonal_reason?: string | null;
  _time_bonus?: number;
  _time_reason?: string | null;
  _capacity_bonus?: number;
  _capacity_reason?: string | null;
  _quality_bonus?: number;
  _quality_reason?: string | null;
};

export function ServiceListing() {
  const navigate = useNavigate();
  const { category: categoryParam } = useParams();
  const [searchParams] = useSearchParams();
  const categoryQuery = searchParams.get("category"); // from ?category=Plumbing
  const searchQuery = searchParams.get("search") || "";
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(999999);
  const [search, setSearch] = useState(searchQuery);
  const [locationInput, setLocationInput] = useState(
    searchParams.get("location") || "",
  );
  const [activeLocation, setActiveLocation] = useState(
    searchParams.get("location") || "",
  );
  const [gpsLoading, setGpsLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiPicks, setAiPicks] = useState<Service[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadServices = useCallback(
    async (locationOverride?: string) => {
      setLoading(true);
      setError(null);
      try {
        const loc =
          locationOverride !== undefined ? locationOverride : activeLocation;
        const url = loc
          ? `/api/services?location=${encodeURIComponent(loc)}`
          : `/api/services`;
        const data = await apiGet<{ services: Service[] } | Service[]>(url);
        const list = Array.isArray(data)
          ? data
          : Array.isArray((data as any).services)
            ? (data as any).services
            : [];
        setServices(list);
      } catch (e: any) {
        setServices([]);
        setError(e?.message || "Failed to load services");
      } finally {
        setLoading(false);
      }
    },
    [activeLocation],
  );

  useSocketEvent(
    EVENTS.PROVIDER_AVAILABILITY_CHANGED,
    useCallback(() => {
      void loadServices();
    }, [loadServices]),
  );

  useEffect(() => {
    void loadServices();
  }, []);

  function useGpsLocation() {
    if (!navigator.geolocation) {
      alert("GPS not supported by your browser");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude},${pos.coords.longitude}`;
        setLocationInput("📍 Current Location");
        setActiveLocation(coords);
        setGpsLoading(false);
      },
      (err) => {
        alert("GPS error: " + err.message);
        setGpsLoading(false);
      },
      { timeout: 10000 },
    );
  }

  function applyLocationSearch() {
    const next = locationInput.trim();
    setActiveLocation(next);
    // Pass location directly to avoid stale closure
    void loadServices(next);
  }

  function clearLocation() {
    setLocationInput("");
    setActiveLocation("");
  }

  async function runAiSearch() {
    const q = aiQuery.trim();
    if (!q) return;
    setAiLoading(true);
    setAiError(null);
    setAiPicks(null);
    try {
      const body: any = { query: q };
      if (activeLocation.includes(",") && /^-?\d/.test(activeLocation)) {
        const [lat, lng] = activeLocation.split(",");
        body.lat = lat;
        body.lng = lng;
      } else if (activeLocation) {
        body.location = activeLocation;
      }
      const data = await apiPost<{ picks: Service[]; message?: string }>(
        "/api/ai/smart-search",
        body,
      );
      if (data.picks?.length) {
        setAiPicks(data.picks);
      } else {
        setAiError(data.message || "No matches found for: " + q);
      }
    } catch (e: any) {
      setAiError(e?.message || "AI search failed");
    } finally {
      setAiLoading(false);
    }
  }

  function clearAiSearch() {
    setAiQuery("");
    setAiPicks(null);
    setAiError(null);
  }

  // Active category filter — from URL param or query string
  const activeCategory = categoryParam || categoryQuery || "";

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const rating = Number((s as any).rating_avg || 0);
      const price = Number(s.price || 0);
      if (activeCategory) {
        const catName =
          typeof s.category_id === "object" && s.category_id
            ? (s.category_id as any).category_name ||
              (s.category_id as any).name ||
              ""
            : typeof s.category_id === "string"
              ? s.category_id
              : "";
        if (
          !catName ||
          !catName.toLowerCase().includes(activeCategory.toLowerCase())
        ) {
          return false;
        }
        console.log("category_id:", s.category_id);
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = s.service_name.toLowerCase().includes(q);
        const matchesProvider = (s.provider_id?.full_name || "")
          .toLowerCase()
          .includes(q);
        const matchesDesc = (s.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesProvider && !matchesDesc) return false;
      }

      return rating >= minRating && price <= maxPrice;
    });
  }, [services, minRating, maxPrice, search, activeCategory]);

  const initials = (name?: string) => {
    return (name || "P")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const pageTitle = activeCategory
    ? `${activeCategory} Services`
    : search
      ? `Results for "${search}"`
      : "All Services";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
            <p className="text-gray-600 mt-1">
              {loading
                ? "Loading services..."
                : `${filtered.length} service${filtered.length === 1 ? "" : "s"} available`}
            </p>
          </div>
          <button
            onClick={() => loadServices()}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
          {/* 📍 Location filter row */}
          <div className="mb-4 pb-4 border-b border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📍 Your Location
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter city, address, or zip (e.g. Edison NJ)"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyLocationSearch()}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <button
                onClick={applyLocationSearch}
                disabled={!locationInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                Search
              </button>
              <button
                onClick={useGpsLocation}
                disabled={gpsLoading}
                title="Use my current location"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50"
              >
                {gpsLoading ? "..." : "📍 GPS"}
              </button>
              {activeLocation && (
                <button
                  onClick={clearLocation}
                  title="Clear location"
                  className="px-3 py-2 text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              )}
            </div>
            {activeLocation && (
              <div className="mt-2 text-sm text-gray-600">
                Showing services near:{" "}
                <strong>
                  {activeLocation === locationInput
                    ? activeLocation
                    : "📍 your current location"}
                </strong>
              </div>
            )}

            {/* 🏷️ Category quick filters */}
            {services.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Filter by service:
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        "/services" +
                          (activeLocation
                            ? `?location=${encodeURIComponent(activeLocation)}`
                            : ""),
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      !activeCategory
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    All
                  </button>
                  {Array.from(
                    new Map(
                      services
                        .filter(
                          (s) =>
                            typeof s.category_id === "object" && s.category_id,
                        )
                        .map((s) => {
                          const c = s.category_id as any;
                          return [c.category_name, c.icon || "🔧"];
                        }),
                    ).entries(),
                  ).map(([cat, icon]) => (
                    <button
                      key={cat}
                      onClick={() => {
                        const params = new URLSearchParams();
                        params.set("category", cat);
                        if (activeLocation)
                          params.set("location", activeLocation);
                        navigate(`/services?${params.toString()}`);
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        activeCategory === cat
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {icon} {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* <div className="grid md:grid-cols-4 gap-4"> */}
          {/* Active category badge */}
          {activeCategory && (
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold">
                📂 {activeCategory}
                <button
                  onClick={() => navigate("/services")}
                  className="ml-1 text-blue-400 hover:text-blue-700 font-bold"
                >
                  ✕
                </button>
              </span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
              {error}
            </div>
          )}

          {/* Services Grid */}
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((k) => (
                <div
                  key={k}
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 animate-pulse h-48"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-gray-900 font-semibold text-lg">
                No services found
              </p>
              <p className="text-gray-500 mt-2">
                Try adjusting your filters or search term
              </p>
              <button
                onClick={() => {
                  setMinRating(0);
                  setMaxPrice(999999);
                  setSearch("");
                  navigate("/services");
                }}
                className="mt-4 px-6 py-2 rounded-xl bg-[#2563EB] text-white hover:bg-blue-700"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(aiPicks || filtered).map((s: any) => {
                const providerId = s.provider_id?._id;
                const providerName =
                  s.provider_id?.full_name ||
                  s.provider_id?.email ||
                  "Provider";
                const rating = Number((s as any).rating_avg || 0);
                const ratingCount = Number((s as any).rating_count || 0);
                const price = Number(s.price || 0);

                return (
                  <div
                    key={s._id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:border-[#2563EB] transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {s.service_name}
                        </h3>
                        {/* 📍 Distance badge */}
                        {typeof s._distance_miles === "number" && (
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                s._distance_miles <= 5
                                  ? "bg-green-100 text-green-700"
                                  : s._distance_miles <= 15
                                    ? "bg-blue-100 text-blue-700"
                                    : s._distance_miles <= 30
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-orange-100 text-orange-700"
                              }`}
                            >
                              📍 {s._distance_miles} mi away
                            </span>
                            {!s._within_range && (
                              <span className="text-xs text-orange-600 font-medium">
                                Travel fee may apply
                              </span>
                            )}
                            {/* 🛣️ Signal 2 — Route corridor bonus */}
                            {s._route_reason && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)",
                                  color: "#15803D",
                                  border: "1px solid #86EFAC",
                                }}
                                title={`Provider has ${s._future_bookings} future bookings — passing through your area`}
                              >
                                🛣️ {s._route_reason}
                              </span>
                            )}
                            {/* 🌤️ Signal 12 — Seasonal boost */}
                            {s._seasonal_reason && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
                                  color: "#92400E",
                                  border: "1px solid #F59E0B",
                                }}
                                title="This service is in season — boosted ranking"
                              >
                                🌤️ {s._seasonal_reason}
                              </span>
                            )}
                            {/* ⏰ Signal 7 — Available now */}
                            {s._time_reason && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{
                                  background: "#DCFCE7",
                                  color: "#166534",
                                  border: "1px solid #86EFAC",
                                }}
                                title="Provider is in working hours right now"
                              >
                                ⏰ {s._time_reason}
                              </span>
                            )}
                            {/* 📅 Signal 8 — Capacity */}
                            {s._capacity_reason && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{
                                  background:
                                    s._capacity_bonus && s._capacity_bonus > 3
                                      ? "#DBEAFE"
                                      : "#FEF3C7",
                                  color:
                                    s._capacity_bonus && s._capacity_bonus > 3
                                      ? "#1E40AF"
                                      : "#92400E",
                                  border: "1px solid #BFDBFE",
                                }}
                              >
                                📅 {s._capacity_reason}
                              </span>
                            )}
                            {/* ⭐ Signals 9-10 — Quality */}
                            {s._quality_reason && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{
                                  background: "#F3E8FF",
                                  color: "#6B21A8",
                                  border: "1px solid #D8B4FE",
                                }}
                                title="Trusted provider"
                              >
                                ⭐ {s._quality_reason}
                              </span>
                            )}
                          </div>
                        )}
                        {s.description && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {s.description}
                          </p>
                        )}
                        {/* ✨ AI reasoning */}
                        {s._ai_reason && (
                          <div
                            className="mt-2 p-2 rounded-lg text-xs"
                            style={{
                              background:
                                "linear-gradient(135deg, #F0F4FF 0%, #FAF5FF 100%)",
                              border: "1px solid #C7D2FE",
                              color: "#4338CA",
                            }}
                          >
                            <strong>✨ AI:</strong> {s._ai_reason}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={`text-sm ${star <= Math.round(rating) ? "text-yellow-400" : "text-gray-300"}`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500">
                          {rating > 0
                            ? `${rating.toFixed(1)} (${ratingCount})`
                            : "New"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold flex-shrink-0">
                          {initials(s.provider_id?.full_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {providerName}
                          </div>
                          <div className="text-xs text-gray-500 font-semibold">
                            ${price}
                            {(s as any).pricing_type === "hourly"
                              ? "/hr"
                              : " fixed"}
                          </div>
                        </div>
                      </div>
                      <Link
                        to={
                          providerId ? `/provider/${providerId}` : "/services"
                        }
                        className="text-[#2563EB] font-medium hover:underline text-sm"
                      >
                        View
                      </Link>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        className="flex-1 px-4 py-2 rounded-lg bg-[#2563EB] text-white hover:bg-blue-700 disabled:opacity-60 font-semibold"
                        disabled={!providerId}
                        onClick={() => {
                          if (providerId)
                            navigate(
                              `/provider/${providerId}?serviceId=${s._id}`,
                            );
                        }}
                      >
                        Book Now
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 font-semibold"
                        onClick={() => navigate("/customer/dashboard")}
                      >
                        My Bookings
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* </div> */}
        </div>
      </div>
    </div>
  );
}
