import React, { JSX, useEffect, useMemo, useRef, useState } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";
import {
  BadgeCheck,
  Clock,
  ShieldCheck,
  Star,
  Award,
  Calendar,
} from "lucide-react";
import { io } from "socket.io-client";
import { useAuthStore } from "../auth.store";

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  "http://localhost:5001";

type ProviderStatus = "draft" | "pending" | "verified" | "rejected";

type ProviderProfile = {
  phone?: string;
  photo_url?: string;
  ssn_last4?: string;
  is_available?: boolean;
  title?: string;
  bio?: string;
  experience_years?: number;
  rating_avg?: number;
  rating_count?: number;
  total_reviews?: number;
  availability?: {
    days?: string[];
    start_time?: string;
    end_time?: string;
  };
};

type ProviderUser = {
  _id: string;
  full_name?: string;
  email?: string;
  role: "provider";
  provider_status?: ProviderStatus;
  is_profile_complete?: boolean;
  availability?: { days?: string[]; start_time?: string; end_time?: string };
  provider_profile?: ProviderProfile;
};

type Category = {
  _id: string;
  category_name?: string;
  name?: string;
  icon?: string;
};

type Service = {
  _id: string;
  service_name: string;
  description?: string;
  price?: number;
  is_active?: boolean;
  rating_avg?: number;
  rating_count?: number;
  pricing_type?: string;
  category_id?: Category | string;
  provider_id?: ProviderUser | string;
};

type Review = {
  _id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  customer_id?: { full_name?: string };
  service_id?: { _id?: string; service_name?: string };
};

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data as T;
}

function initials(name?: string) {
  const v = (name || "").trim();
  if (!v) return "PR";
  const parts = v.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

function formatMoney(n?: number) {
  const val = Number(n || 0);
  return `$${val.toFixed(0)}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const TIME_SLOTS = ["10:00", "13:00", "15:00", "17:00"];

export default function ProviderProfile(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.me);
  const [searchParams] = useSearchParams();
  const serviceIdFromUrl = searchParams.get("serviceId");
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ProviderUser | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState("");
  const [date, setDate] = useState<string>(addDaysISO(1));
  const [time, setTime] = useState<string>(TIME_SLOTS[0]);
  const [address, setAddress] = useState<string>("");
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [selectedAddrId, setSelectedAddrId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const verified = provider?.provider_status === "verified";
  const available = !!provider?.provider_profile?.is_available;
  const experience = Number(provider?.provider_profile?.experience_years || 0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [urgentMode, setUrgentMode] = useState(false);
  const [urgentLoading, setUrgentLoading] = useState(false);
  const [urgentResult, setUrgentResult] = useState<string | null>(null);
  const activeServices = useMemo(
    () => services.filter((s) => s.is_active !== false),
    [services],
  );

  const minPrice = useMemo(() => {
    const prices = activeServices.map((s) => Number(s.price || 0));
    if (!prices.length) return 0;
    return Math.min(...prices);
  }, [activeServices]);

  // ✅ Generate time slots based on provider availability
  const availableTimeSlots = useMemo(() => {
    if (!provider) return ["10:00", "13:00", "15:00", "17:00"];
    const start =
      provider.provider_profile?.availability?.start_time || "09:00";
    const end = provider.provider_profile?.availability?.end_time || "18:00";
    const slots = [
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
    ];

    const filtered = slots.filter((slot) => slot >= start && slot < end);

    if (date === todayISO()) {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      return filtered.filter((slot) => slot > currentHHMM);
    }

    return filtered;
  }, [provider, date]);

  const selectedDayName = useMemo(() => {
    if (!date) return "";
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[new Date(date).getDay()];
  }, [date]);

  const isDayAvailable = useMemo(() => {
    if (!provider) return true;
    const availDays = provider.provider_profile?.availability?.days || [
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
    ];
    return availDays.includes(selectedDayName);
  }, [selectedDayName, provider]);

  async function load(): Promise<void> {
    setError("");
    setLoading(true);
    try {
      if (!id) throw new Error("Provider id missing");

      const all = await apiFetch<{ services: Service[] }>("/api/services");
      const allServices = all.services || [];

      const providerServices = allServices.filter((s) => {
        const p = s.provider_id as any;
        const pid =
          typeof p === "object" && p ? String(p._id) : String(p || "");
        return pid === String(id);
      });

      if (!providerServices.length) {
        throw new Error("Provider not found or not visible yet.");
      }

      const pObj = providerServices[0].provider_id as any;
      if (typeof pObj !== "object" || !pObj) {
        throw new Error("Provider data missing");
      }

      setProvider(pObj as ProviderUser);
      setServices(providerServices);

      if (providerServices.length) {
        const requested = serviceIdFromUrl;
        if (
          requested &&
          providerServices.some((s) => String(s._id) === String(requested))
        ) {
          setSelectedServiceId(String(requested));
        } else {
          setSelectedServiceId((prev) => prev || providerServices[0]._id);
        }
      }

      // Load reviews
      try {
        setReviewsLoading(true);
        const reviewData = await apiFetch<{
          reviews: Review[];
          avg_rating: number;
          total: number;
        }>(`/api/reviews/provider/${id}`);
        setReviews(reviewData.reviews || []);
        setAvgRating(reviewData.avg_rating || 0);
        setTotalReviews(reviewData.total || 0);
      } catch {
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load provider");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    if (availableTimeSlots.length > 0 && !availableTimeSlots.includes(time)) {
      setTime(availableTimeSlots[0]);
    }
  }, [date]);

  useEffect(() => {
    // Check if this provider is already in customer's favorites
    if (!id) return;
    fetch(`${API_BASE}/api/customer/favorites`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const isFav = (data.favorites || []).some(
          (p: any) => String(p._id) === String(id),
        );
        setIsFavorite(isFav);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    fetch(`${API_BASE}/api/customer/saved-addresses`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        const addrs = data.saved_addresses || [];
        setSavedAddresses(addrs);
        const primary = addrs.find((a: any) => a.is_primary);
        if (primary) {
          setSelectedAddrId(primary._id);
          setAddress(primary.formatted_address || primary.address_text);
        }
      })
      .catch(() => {});
  }, []);

  // Google Places Autocomplete on the address input
  // The Maps script loads asynchronously, so we poll until it's ready
  useEffect(() => {
    let cancelled = false;
    let autocomplete: any = null;
    let listener: any = null;
    let pollId: number | null = null;

    const init = (): boolean => {
      if (cancelled) return true; // stop polling
      if (!addressInputRef.current) {
        console.log("[autocomplete] input ref not ready yet");
        return false;
      }
      const win = window as any;
      if (!win.google?.maps?.places) {
        console.log("[autocomplete] Google Maps places not loaded yet");
        return false;
      }

      console.log(
        "[autocomplete] ✅ initializing on input",
        addressInputRef.current,
      );
      autocomplete = new win.google.maps.places.Autocomplete(
        addressInputRef.current,
        {
          componentRestrictions: { country: "us" },
          types: ["address"],
          fields: ["formatted_address", "geometry"],
        },
      );

      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        console.log("[autocomplete] place_changed:", place);
        const formatted = place?.formatted_address || "";
        if (formatted) {
          setAddress(formatted);
          setSelectedAddrId(""); // picking from autocomplete = new address
        }
      });

      return true;
    };

    // Try immediately; if Maps isn't loaded, poll every 200ms (max 10s)
    if (!init()) {
      let attempts = 0;
      pollId = window.setInterval(() => {
        attempts++;
        if (init() || attempts > 50) {
          if (pollId !== null) {
            window.clearInterval(pollId);
            pollId = null;
            if (attempts > 50) {
              console.warn(
                "[autocomplete] gave up after 10s — Maps never loaded",
              );
            }
          }
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearInterval(pollId);
      if (listener?.remove) listener.remove();
    };
  }, []);

  async function toggleFavorite() {
    if (!id) return;
    setFavLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customer/favorites/${id}`, {
        method: isFavorite ? "DELETE" : "POST",
        credentials: "include",
      });
      if (res.ok) setIsFavorite(!isFavorite);
    } catch {
      /* empty */
    } finally {
      setFavLoading(false);
    }
  }

  async function submitUrgent() {
    if (!me) {
      navigate(
        "/login?redirect=" +
          encodeURIComponent(window.location.pathname + window.location.search),
      );
      return;
    }
    if (!selectedServiceId || !address.trim()) {
      alert("Please pick a service and enter address");
      return;
    }
    setUrgentLoading(true);
    setUrgentResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/bookings/urgent`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: selectedServiceId,
          address,
          notes,
          premium_pct: 30,
          target_provider_id: id, // always include the currently-viewed provider
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setUrgentResult(
        `✅ ${data.message} Waiting for first provider to accept...`,
      );
    } catch (e: any) {
      setUrgentResult("❌ " + (e.message || "Failed"));
    } finally {
      setUrgentLoading(false);
    }
  }

  async function bookNow(): Promise<void> {
    setError("");

    if (!me) {
      navigate(
        "/login?redirect=" +
          encodeURIComponent(window.location.pathname + window.location.search),
      );
      return;
    }

    if (!provider?._id) {
      setError("Provider not found");
      return;
    }
    if (!verified) {
      setError("This provider is not verified yet.");
      return;
    }
    if (!available) {
      setError("This provider is not available right now.");
      return;
    }
    if (!selectedServiceId) {
      setError("Please select a service.");
      return;
    }
    if (!address.trim()) {
      setError("Please enter your address.");
      return;
    }
    if (date <= todayISO()) {
      setError("Please select a future date.");
      return;
    }
    if (!isDayAvailable) {
      setError(`Provider is not available on ${selectedDayName}s.`);
      return;
    }

    setBookingLoading(true);
    try {
      await apiFetch<{ message: string; booking: any }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          provider_id: provider._id,
          service_id: selectedServiceId,
          date,
          time,
          address: address.trim(),
          notes: notes.trim(),
        }),
      });
      navigate("/customer/dashboard");
    } catch (e: any) {
      setError(e?.message || "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="h-40 bg-white border border-gray-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 h-80 bg-white border border-gray-200 rounded-2xl animate-pulse" />
          <div className="h-80 bg-white border border-gray-200 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          {error || "Provider not found"}
        </div>
      </div>
    );
  }

  const title = provider.provider_profile?.title || "Service Professional";
  const bio =
    provider.provider_profile?.bio ||
    "Professional service provider. Complete profile details will appear here.";
  const chips = activeServices.slice(0, 8);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error ? (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {error}
          </div>
        ) : null}
        {/* ── Provider Header ── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="w-28 h-28 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center text-4xl font-extrabold">
              {initials(provider.full_name)}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl font-extrabold text-gray-900">
                  {provider.full_name || "Provider"}
                </h1>
                {/* ❤️ Signal 5 — Favorite toggle */}
                <button
                  onClick={toggleFavorite}
                  disabled={favLoading}
                  title={
                    isFavorite ? "Remove from favorites" : "Save as favorite"
                  }
                  className="text-2xl hover:scale-110 transition-transform disabled:opacity-50"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {isFavorite ? "❤️" : "🤍"}
                </button>
                {verified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    <BadgeCheck size={14} />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-100">
                    Pending
                  </span>
                )}
              </div>

              <div className="text-gray-600 mt-1">{title}</div>

              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-700">
                <div className="inline-flex items-center gap-1">
                  <Star size={16} className="text-yellow-500" />
                  <span className="font-semibold">
                    {avgRating > 0 ? avgRating.toFixed(1) : "New"}
                  </span>
                  <span className="text-gray-500">
                    ({totalReviews} reviews)
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 text-gray-600">
                  <Award size={16} />
                  <span>{experience} years experience</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {totalReviews > 0 && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-100 text-sm">
                    <BadgeCheck size={16} />
                    {totalReviews}+ jobs completed
                  </span>
                )}
                {verified && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100 text-sm">
                    <ShieldCheck size={16} />
                    Background verified
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* ── LEFT COLUMN (2/3) ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-xl font-extrabold text-gray-900">About</h2>
              <p className="text-gray-700 mt-3 leading-7">{bio}</p>
            </div>

            {/* Skills & Services */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-xl font-extrabold text-gray-900 mb-5">
                Skills & Services
              </h2>
              {chips.length === 0 ? (
                <div className="text-gray-600">No services listed yet.</div>
              ) : (
                <div className="space-y-3">
                  {chips.map((s) => {
                    const sRating = Number(s.rating_avg || 0);
                    const sCount = Number(s.rating_count || 0);
                    const isSelected = selectedServiceId === s._id;

                    const serviceReviews = reviews.filter((r) => {
                      const rServiceId =
                        typeof r.service_id === "object"
                          ? r.service_id?._id
                          : r.service_id;
                      return rServiceId === s._id;
                    });

                    return (
                      <div
                        key={s._id}
                        onClick={() => setSelectedServiceId(s._id)}
                        className={`rounded-xl border p-4 cursor-pointer transition ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-gray-900">
                            {s.service_name}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  className={`text-sm ${star <= Math.round(sRating) ? "text-yellow-400" : "text-gray-300"}`}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                            <span className="text-sm font-semibold text-gray-700">
                              {sRating > 0 ? sRating.toFixed(1) : "New"}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({sCount} reviews)
                            </span>
                          </div>
                        </div>

                        {s.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {s.description}
                          </p>
                        )}

                        <div className="text-sm font-semibold text-blue-600 mt-1">
                          ${s.price}
                          {s.pricing_type === "hourly" ? "/hr" : " fixed"}
                        </div>

                        {isSelected && serviceReviews.length > 0 && (
                          <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
                            {serviceReviews.slice(0, 3).map((r) => (
                              <div
                                key={r._id}
                                className="flex items-start gap-3"
                              >
                                <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                  {(r.customer_id?.full_name || "C")
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-900">
                                      {r.customer_id?.full_name || "Customer"}
                                    </span>
                                    <div className="flex">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                          key={star}
                                          className={`text-xs ${star <= r.rating ? "text-yellow-400" : "text-gray-300"}`}
                                        >
                                          ★
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  {r.comment && (
                                    <p className="text-sm text-gray-600 mt-0.5">
                                      "{r.comment}"
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Certifications */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-xl font-extrabold text-gray-900">
                Certifications
              </h2>
              <div className="mt-4 space-y-3">
                {[
                  "Licensed Professional",
                  "Safety Certified",
                  "Background Checked",
                ].map((c) => (
                  <div
                    key={c}
                    className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Award className="text-green-700" size={18} />
                    </div>
                    <div className="font-semibold text-gray-900">{c}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Customer Reviews ── */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-extrabold text-gray-900">
                  Customer Reviews
                </h2>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span
                        key={s}
                        className={`text-lg ${s <= Math.round(avgRating) ? "text-yellow-400" : "text-gray-300"}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="font-bold text-gray-900">
                    {avgRating > 0 ? avgRating.toFixed(1) : "0.0"}
                  </span>
                  <span className="text-gray-500 text-sm">
                    ({totalReviews} reviews)
                  </span>
                </div>
              </div>

              {reviewsLoading ? (
                <div className="text-gray-500">Loading reviews...</div>
              ) : reviews.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-gray-500">
                    No reviews yet. Be the first to review!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <div
                      key={r._id}
                      className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-sm">
                            {(r.customer_id?.full_name || "C")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {r.customer_id?.full_name || "Customer"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {r.service_id?.service_name || "Service"}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <span
                                key={s}
                                className={`text-sm ${s <= r.rating ? "text-yellow-400" : "text-gray-300"}`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      {r.comment && (
                        <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                          "{r.comment}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>{" "}
          {/* ✅ END lg:col-span-2 */}
          {/* ── RIGHT COLUMN - Booking Form ── */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 h-fit sticky top-24">
            <div className="text-gray-600 text-sm">Starting from</div>
            <div className="flex items-end gap-1 mt-1">
              <div className="text-3xl font-extrabold text-gray-900">
                {formatMoney(minPrice)}
              </div>
              <div className="text-gray-600 pb-1">/hr</div>
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Calendar size={16} />
                Select Date
              </div>
              <input
                type="date"
                value={date}
                min={addDaysISO(0)}
                onChange={(e) => setDate(e.target.value)}
                className="mt-2 w-full border border-blue-600 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Clock size={16} />
                Select Time
              </div>
              {/* ✅ Show day unavailable warning */}
              {!isDayAvailable && date && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                  ❌ Provider is not available on {selectedDayName}s. Please
                  select another date.
                </div>
              )}

              {/* Time slots */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                {availableTimeSlots.length === 0 ? (
                  <div className="col-span-2 text-sm text-gray-500">
                    No time slots available
                  </div>
                ) : (
                  availableTimeSlots.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTime(t)}
                      type="button"
                      className={`px-3 py-3 rounded-xl border font-semibold transition ${
                        time === t
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* ✅ Show selected service */}
            <div className="mt-5 p-3 rounded-xl bg-blue-50 border border-blue-100">
              <div className="text-xs text-blue-600 font-semibold mb-1">
                Selected Service
              </div>
              <div className="font-bold text-gray-900">
                {activeServices.find((s) => s._id === selectedServiceId)
                  ?.service_name || "—"}
              </div>
              <div className="text-sm text-blue-600">
                $
                {activeServices.find((s) => s._id === selectedServiceId)?.price}
                {activeServices.find((s) => s._id === selectedServiceId)
                  ?.pricing_type === "hourly"
                  ? "/hr"
                  : " fixed"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ← Select from Skills & Services
              </div>
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold text-gray-800">Address</div>
              {savedAddresses.length > 0 && (
                <div className="mt-2 mb-3">
                  <div className="text-xs text-gray-600 mb-1.5">
                    Pick a saved address:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {savedAddresses.map((a) => (
                      <button
                        key={a._id}
                        type="button"
                        onClick={() => {
                          setSelectedAddrId(a._id);
                          setAddress(a.formatted_address || a.address_text);
                        }}
                        className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
                          selectedAddrId === a._id
                            ? "bg-blue-100 border-blue-400 text-blue-800"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {a.is_primary ? "🏠" : "📍"} {a.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddrId("");
                        setAddress("");
                      }}
                      className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
                        selectedAddrId === ""
                          ? "bg-gray-100 border-gray-400 text-gray-800"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      ✏️ Type new
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={addressInputRef}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setSelectedAddrId("");
                }}
                placeholder="Start typing an address..."
                className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100"
              />

              {savedAddresses.length === 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  💡 Save addresses in your{" "}
                  <Link
                    to="/dashboard?section=profile"
                    className="text-blue-600 underline"
                  >
                    profile
                  </Link>{" "}
                  for faster booking next time.
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-800">Notes</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes for provider"
                rows={3}
                className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>

            <button
              onClick={() => void bookNow()}
              disabled={
                !!me &&
                (bookingLoading || !verified || !available || !isDayAvailable)
              }
              className={`mt-6 w-full py-3 rounded-xl font-extrabold transition ${
                !!me &&
                (bookingLoading || !verified || !available || !isDayAvailable)
                  ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {!me
                ? "Login to Book"
                : bookingLoading
                  ? "Booking..."
                  : "Book Now"}
            </button>

            <div className="text-xs text-gray-500 text-center mt-2">
              You won't be charged yet
            </div>

            {/* 🚨 Urgent Mode */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => void submitUrgent()}
                disabled={!!me && (urgentLoading || !verified || !available)}
                className={`w-full py-3 rounded-xl font-extrabold transition ${
                  !!me && (urgentLoading || !verified || !available)
                    ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700"
                }`}
                style={{
                  boxShadow:
                    !!me && !urgentLoading && verified && available
                      ? "0 4px 12px rgba(239, 68, 68, 0.3)"
                      : "none",
                }}
              >
                {!me
                  ? "🚨 Login for Urgent Booking"
                  : urgentLoading
                    ? "🔍 Finding nearest providers..."
                    : "🚨 URGENT — Need ASAP"}
              </button>
              <div className="text-xs text-gray-500 text-center mt-2">
                +30% premium • Broadcasts to 5 nearest pros • First to accept
                wins
              </div>
              {urgentResult && (
                <div
                  className={`mt-3 p-3 rounded-lg text-sm ${
                    urgentResult.startsWith("✅")
                      ? "bg-green-50 border border-green-200 text-green-800"
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}
                >
                  {urgentResult}
                </div>
              )}
            </div>

            {!verified ? (
              <div className="mt-4 bg-yellow-50 border border-yellow-100 text-yellow-800 text-sm rounded-xl p-3">
                Provider is not verified yet (admin must approve).
              </div>
            ) : null}

            {verified && !available ? (
              <div className="mt-4 bg-red-50 border border-red-100 text-red-800 text-sm rounded-xl p-3">
                Provider is currently unavailable.
              </div>
            ) : null}
          </div>
        </div>{" "}
        {/* ✅ END main grid */}
      </div>
    </div>
  );
}
