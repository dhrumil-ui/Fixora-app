import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../auth.store";
import { apiGet } from "../lib/api";
import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  DollarSign,
  Star,
  CheckCircle,
  Home,
  Heart,
  User,
  RefreshCw,
  MapPin,
  MessageCircle,
} from "lucide-react";
import PaymentModal from "./PaymentModal";
import CancellationModal from "./Cancellationmodal";
import ChatModal from "./Chatmodal";
import { useCustomerLive } from "../hooks/useLiveData";
import { useSocket } from "../hooks/useSocket";
import { EVENTS } from "../lib/socketEvents";

type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "work_completed"
  | "reschedule_requested";

type Booking = {
  _id: string;
  date: string;
  time: string;
  status: BookingStatus;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  address?: string;
  notes?: string;
  total_amount?: number;
  currency?: string;
  service_id?: { service_name?: string; description?: string; price?: number };
  provider_id?: {
    full_name?: string;
    email?: string;
    phone?: string;
    profile_image?: string;
    provider_profile?: {
      rating_avg?: number;
      rating_count?: number;
    };
  };
  reschedule?: {
    requested?: boolean;
    proposed_date?: string | null;
    proposed_time?: string | null;
    reason?: string;
    requested_by?: "provider" | "customer" | null;
    previous_status?: string | null;
    decision?: "pending" | "accepted" | "rejected" | null;
    rejection_reason?: string;
    rejection_message?: string;
  };
  issue?: {
    status?: string;
    issue_type?: string;
    provider_response?: string;
    description?: string;
  };
  travel_fee_requested?: number | null;
  travel_fee_status?: "pending" | "accepted" | "rejected" | null;
  travel_fee_note?: string;
  distance_miles?: number | null;
};

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  "http://localhost:5001";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data as T;
}

type SectionTab = "overview" | "bookings" | "favorites" | "profile";
type BookingTab = "active" | "past" | "resolved";

// ✅ ReviewModal outside CustomerDashboard
function ReviewModal({
  bookingId,
  onClose,
  onSuccess,
}: {
  bookingId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingReviewId, setExistingReviewId] = useState<string | null>(null); // ✅

  useEffect(() => {
    // ✅ Load existing review if any
    fetch(`${API_BASE}/api/reviews/check/${bookingId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.reviewed && d.review) {
          setExistingReviewId(d.review._id);
          setRating(d.review.rating);
          setComment(d.review.comment || "");
        }
      })
      .catch(() => {});
  }, [bookingId]);

  async function submitReview() {
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // ✅ PUT if editing, POST if new
      const url = existingReviewId
        ? `${API_BASE}/api/reviews/${existingReviewId}`
        : `${API_BASE}/api/reviews`;
      const method = existingReviewId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Failed to submit review");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            {/* ✅ Title changes based on edit/new */}
            <h3 className="text-xl font-bold text-gray-900">
              {existingReviewId ? "Edit Your Review" : "Leave a Review"}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              How was your experience?
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Rating
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="text-4xl transition-transform hover:scale-110"
              >
                <span
                  className={
                    star <= (hovered || rating)
                      ? "text-yellow-400"
                      : "text-gray-300"
                  }
                >
                  ★
                </span>
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="mt-2 text-sm font-semibold text-gray-600">
              {rating === 1 && "😞 Poor"}
              {rating === 2 && "😐 Fair"}
              {rating === 3 && "🙂 Good"}
              {rating === 4 && "😊 Very Good"}
              {rating === 5 && "🤩 Excellent!"}
            </p>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Comment (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="Share your experience with this provider..."
            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-gray-200 px-5 py-3 font-semibold hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={submitReview}
            disabled={loading || rating === 0}
            className="rounded-xl bg-[#2563EB] px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading
              ? "Saving..."
              : existingReviewId
                ? "Update Review"
                : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportIssueModal({
  bookingId,
  onClose,
  onSuccess,
}: {
  bookingId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const issueTypes = [
    { value: "no_show", label: "🚫 Provider No Show" },
    { value: "poor_quality", label: "⭐ Poor Quality Work" },
    { value: "damage", label: "💥 Property Damage" },
    { value: "overcharge", label: "💰 Overcharged" },
    { value: "rude_behavior", label: "😤 Rude Behavior" },
    { value: "incomplete_work", label: "🔧 Incomplete Work" },
    { value: "other", label: "📝 Other" },
  ];

  async function submitIssue() {
    if (!issueType) {
      setError("Please select an issue type");
      return;
    }
    if (!description.trim()) {
      setError("Please describe the issue");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/issues`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          issue_type: issueType,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || "Failed to report issue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Report an Issue</h3>
            <p className="text-sm text-gray-500 mt-1">
              Tell us what went wrong
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="font-bold text-gray-900 text-lg">Issue Reported!</p>
            <p className="text-sm text-gray-500 mt-2">
              Our team will review your issue within 24 hours.
            </p>
            <button
              onClick={onSuccess}
              className="mt-5 px-6 py-2.5 rounded-xl bg-[#2563EB] text-white font-semibold hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Issue Type */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Issue Type
              </label>
              <div className="grid grid-cols-1 gap-2">
                {issueTypes.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setIssueType(t.value)}
                    className={`text-left px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                      issueType === t.value
                        ? "border-red-400 bg-red-50 text-red-700"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what happened in detail..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-gray-200 px-5 py-3 font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={submitIssue}
                disabled={loading}
                className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {loading ? "Submitting..." : "Report Issue"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 5;

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
      <span className="text-sm text-gray-500">
        Page <b>{page}</b> of <b>{totalPages}</b>
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          «
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          ‹ Prev
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | "...")[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "..." ? (
              <span key={`d${i}`} className="px-2 py-1 text-gray-400">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition ${page === p ? "bg-[#2563EB] text-white border-[#2563EB]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                {p}
              </button>
            ),
          )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          Next ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          »
        </button>
      </div>
    </div>
  );
}

export function CustomerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingTab = (searchParams.get("tab") as BookingTab) || "active";
  const sectionTab = (searchParams.get("section") as SectionTab) || "overview";
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const refreshAllCustomer = () => {
    void loadBookings();
    void loadTabBookings("active", tabActivePage, tabActiveSearch);
    void loadTabBookings("past", tabPastPage, tabPastSearch);
    void loadTabBookings("resolved", tabResolvedPage, "");
    void loadUnreadCounts();
  };
  useCustomerLive({
    onBookingUpdate: refreshAllCustomer,
    onPaymentSuccess: refreshAllCustomer,
    onPaymentFailed: refreshAllCustomer,
    onIssueResolved: refreshAllCustomer,
  });

  const [loadingBookings, setLoadingBookings] = useState(true);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(
    null,
  );
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payBookingId, setPayBookingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payCurrency, setPayCurrency] = useState<string>("USD");

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [chatPeerName, setChatPeerName] = useState<string>("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // ── Real-time chat unread badges ──
  const { socket, connected: socketConnected } = useSocket();
  useEffect(() => {
    if (!socketConnected) return;
    const handleNewMessage = (payload: any) => {
      if (!payload?.bookingId) return;
      if (chatOpen && chatBookingId === payload.bookingId) return;
      setUnreadCounts((prev) => ({
        ...prev,
        [payload.bookingId]: (prev[payload.bookingId] || 0) + 1,
      }));
    };
    const handleUnreadUpdate = () => {
      void loadUnreadCounts();
    };
    socket.on(EVENTS.CHAT_MESSAGE_NEW, handleNewMessage);
    socket.on(EVENTS.CHAT_UNREAD_UPDATE, handleUnreadUpdate);
    return () => {
      socket.off(EVENTS.CHAT_MESSAGE_NEW, handleNewMessage);
      socket.off(EVENTS.CHAT_UNREAD_UPDATE, handleUnreadUpdate);
    };
  }, [socketConnected, socket, chatOpen, chatBookingId]);

  // Load unread counts on mount
  useEffect(() => {
    void loadUnreadCounts();
  }, []);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectBookingId, setRejectBookingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectMessage, setRejectMessage] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectError, setRejectError] = useState("");
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [activeSearch, setActiveSearch] = useState("");
  const [activePage, setActivePage] = useState(1);
  const [pastSearch, setPastSearch] = useState("");
  const [pastPage, setPastPage] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);
  const [bookingIssues, setBookingIssues] = useState<Record<string, any>>({});
  const [tabActiveData, setTabActiveData] = useState<Booking[]>([]);
  const [tabActiveTotalPages, setTabActiveTotalPages] = useState(1);
  const [tabActivePage, setTabActivePage] = useState(1);
  const [tabActiveSearch, setTabActiveSearch] = useState("");
  const [tabActiveLoading, setTabActiveLoading] = useState(false);
  const [tabActiveTotal, setTabActiveTotal] = useState(0);
  const [tabPastData, setTabPastData] = useState<Booking[]>([]);
  const [tabPastTotalPages, setTabPastTotalPages] = useState(1);
  const [tabPastPage, setTabPastPage] = useState(1);
  const [tabPastSearch, setTabPastSearch] = useState("");
  const [tabPastLoading, setTabPastLoading] = useState(false);
  const [tabPastTotal, setTabPastTotal] = useState(0);
  const [tabResolvedData, setTabResolvedData] = useState<Booking[]>([]);
  const [tabResolvedTotalPages, setTabResolvedTotalPages] = useState(1);
  const [tabResolvedPage, setTabResolvedPage] = useState(1);
  const [tabResolvedLoading, setTabResolvedLoading] = useState(false);
  const [tabResolvedTotal, setTabResolvedTotal] = useState(0);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [newAddrLabel, setNewAddrLabel] = useState("");
  const [newAddrText, setNewAddrText] = useState("");
  const newAddrInputRef = useRef<HTMLInputElement>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [manualFavorites, setManualFavorites] = useState<any[]>([]);
  const [overviewFavPage, setOverviewFavPage] = useState(1);
  const [favTabPage, setFavTabPage] = useState(1);
  const [issueBookingId, setIssueBookingId] = useState<string | null>(null);
  const rejectionOptions = [
    "I am not available at that time",
    "I need the original schedule",
    "The proposed time does not work for me",
    "Please suggest another time",
    "Other",
  ];

  const navigate = useNavigate();
  const storeUser = useAuthStore((s) => s.me);
  const clear = useAuthStore((s) => s.clear);

  const user = storeUser
    ? {
        id: storeUser._id,
        full_name: storeUser.full_name || "",
        email: storeUser.email || "",
        role: storeUser.role,
        cashback_balance: Number(storeUser.cashback_balance || 0),
        cashback_total_earned: Number(storeUser.cashback_total_earned || 0),
        cashback_total_spent: Number(storeUser.cashback_total_spent || 0),
      }
    : null;

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
    clear();
    navigate("/login");
  };

  const loadBookings = async () => {
    setLoadingBookings(true);
    try {
      const data = await apiGet<{ bookings: Booking[] }>("/api/bookings/my");
      setBookings(data.bookings || []);
    } catch {
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  // ── Chat helpers ──
  const loadUnreadCounts = async () => {
    try {
      const data = await apiGet<{ counts: Record<string, number> }>(
        "/api/messages/unread-counts",
      );
      setUnreadCounts(data.counts || {});
    } catch {
      // ignore — no chat data yet is fine
    }
  };

  function openChat(booking: Booking) {
    const providerName =
      (booking.provider_id as any)?.full_name ||
      (booking as any).provider_name ||
      "Provider";
    setChatBookingId(booking._id);
    setChatPeerName(providerName);
    setChatOpen(true);
    // Eagerly clear local unread for this booking (server confirms via socket)
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[booking._id];
      return next;
    });
  }

  const loadTabBookings = async (
    tab: BookingTab,
    page: number,
    search: string,
  ) => {
    const setLoading =
      tab === "active"
        ? setTabActiveLoading
        : tab === "past"
          ? setTabPastLoading
          : setTabResolvedLoading;
    const setData =
      tab === "active"
        ? setTabActiveData
        : tab === "past"
          ? setTabPastData
          : setTabResolvedData;
    const setPages =
      tab === "active"
        ? setTabActiveTotalPages
        : tab === "past"
          ? setTabPastTotalPages
          : setTabResolvedTotalPages;
    const setTotal =
      tab === "active"
        ? setTabActiveTotal
        : tab === "past"
          ? setTabPastTotal
          : setTabResolvedTotal;

    setLoading(true);
    try {
      const params = new URLSearchParams({ tab, page: String(page), search });
      const data = await apiFetch<{
        bookings: Booking[];
        total: number;
        totalPages: number;
      }>(`/api/bookings/my?${params}`);
      setData(data.bookings || []);
      setPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sectionTab === "profile") {
      void loadSavedAddresses();
    }
  }, [sectionTab]);

  // Google Places Autocomplete on the "Add new address" input.
  // The input only mounts when sectionTab === "profile", and Maps loads async,
  // so we poll until both the input and Maps are ready.
  useEffect(() => {
    if (sectionTab !== "profile") return;

    let cancelled = false;
    let autocomplete: any = null;
    let listener: any = null;
    let pollId: number | null = null;

    const init = (): boolean => {
      if (cancelled) return true; // stop polling
      if (!newAddrInputRef.current) return false;
      const win = window as any;
      if (!win.google?.maps?.places) return false;

      autocomplete = new win.google.maps.places.Autocomplete(
        newAddrInputRef.current,
        {
          componentRestrictions: { country: "us" },
          types: ["address"],
          fields: ["formatted_address", "geometry"],
        },
      );

      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const formatted = place?.formatted_address || "";
        if (formatted) setNewAddrText(formatted);
      });

      return true;
    };

    if (!init()) {
      let attempts = 0;
      pollId = window.setInterval(() => {
        attempts++;
        if (init() || attempts > 50) {
          if (pollId !== null) {
            window.clearInterval(pollId);
            pollId = null;
          }
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearInterval(pollId);
      if (listener?.remove) listener.remove();
    };
  }, [sectionTab]);

  useEffect(() => {
    if (sectionTab === "favorites") {
      void loadManualFavorites();
    }
    if (sectionTab === "profile") {
      void loadSavedAddresses();
    }
  }, [sectionTab]);

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    if (sectionTab !== "bookings") return;
    if (bookingTab === "active")
      void loadTabBookings("active", tabActivePage, tabActiveSearch);
    if (bookingTab === "past")
      void loadTabBookings("past", tabPastPage, tabPastSearch);
    if (bookingTab === "resolved")
      void loadTabBookings("resolved", tabResolvedPage, "");
  }, [sectionTab, bookingTab]);

  useEffect(() => {
    if (sectionTab === "bookings" && bookingTab === "active")
      void loadTabBookings("active", tabActivePage, tabActiveSearch);
  }, [tabActivePage]);
  useEffect(() => {
    if (sectionTab === "bookings" && bookingTab === "past")
      void loadTabBookings("past", tabPastPage, tabPastSearch);
  }, [tabPastPage]);
  useEffect(() => {
    if (sectionTab === "bookings" && bookingTab === "resolved")
      void loadTabBookings("resolved", tabResolvedPage, "");
  }, [tabResolvedPage]);

  // Search changes
  useEffect(() => {
    if (sectionTab !== "bookings" || bookingTab !== "active") return;
    setTabActivePage(1);
    void loadTabBookings("active", 1, tabActiveSearch);
  }, [tabActiveSearch]);

  useEffect(() => {
    if (sectionTab !== "bookings" || bookingTab !== "past") return;
    setTabPastPage(1);
    void loadTabBookings("past", 1, tabPastSearch);
  }, [tabPastSearch]);

  useEffect(() => {
    if (sectionTab === "bookings") {
      void loadTabBookings("active", 1, "");
      void loadTabBookings("past", 1, "");
      void loadTabBookings("resolved", 1, "");
    }
  }, [sectionTab]);

  const activeBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status === "pending" ||
          b.status === "confirmed" ||
          b.status === "work_completed" ||
          b.status === "reschedule_requested",
      ),
    [bookings],
  );

  const pastBookings = useMemo(
    () =>
      bookings.filter(
        (b) => b.status === "completed" || b.status === "cancelled",
      ),
    [bookings],
  );

  const completedBookings = useMemo(
    () => pastBookings.filter((b) => b.status === "completed"),
    [pastBookings],
  );

  const resolvedBookings = useMemo(
    () =>
      pastBookings.filter((b) => bookingIssues[b._id]?.status === "resolved"),
    [pastBookings, bookingIssues],
  );

  const pastWithoutResolved = useMemo(
    () =>
      pastBookings.filter((b) => bookingIssues[b._id]?.status !== "resolved"),
    [pastBookings, bookingIssues],
  );

  const filteredActive = useMemo(() => {
    const q = activeSearch.toLowerCase();
    return activeBookings.filter(
      (b) =>
        !q ||
        b.provider_id?.full_name?.toLowerCase().includes(q) ||
        b.service_id?.service_name?.toLowerCase().includes(q) ||
        b.date?.includes(q),
    );
  }, [activeBookings, activeSearch]);

  const filteredPast = useMemo(() => {
    const q = pastSearch.toLowerCase();
    return pastWithoutResolved.filter(
      (b) =>
        !q ||
        b.provider_id?.full_name?.toLowerCase().includes(q) ||
        b.service_id?.service_name?.toLowerCase().includes(q) ||
        b.date?.includes(q),
    );
  }, [pastWithoutResolved, pastSearch]);

  const paginatedActive = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE;
    return filteredActive.slice(start, start + PAGE_SIZE);
  }, [filteredActive, activePage]);

  const paginatedPast = useMemo(() => {
    const start = (pastPage - 1) * PAGE_SIZE;
    return filteredPast.slice(start, start + PAGE_SIZE);
  }, [filteredPast, pastPage]);

  const paginatedResolved = useMemo(() => {
    const start = (resolvedPage - 1) * PAGE_SIZE;
    return resolvedBookings.slice(start, start + PAGE_SIZE);
  }, [resolvedBookings, resolvedPage]);

  const totalSpent = useMemo(
    () =>
      bookings
        .filter((b) => b.status !== "cancelled" && b.payment_status === "paid")
        .reduce((sum, b) => {
          const amount = Number(b.total_amount ?? 0);
          return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0),
    [bookings],
  );

  const favoriteProviders = useMemo(() => {
    const providerMap = new Map<
      string,
      {
        _id?: string;
        name: string;
        email?: string;
        phone?: string;
        count: number;
        rating_avg?: number;
        rating_count?: number;
        is_manual?: boolean;
      }
    >();

    completedBookings.forEach((b) => {
      const provId = (b.provider_id as any)?._id;
      if (!provId) return;
      const existing = providerMap.get(String(provId));
      if (existing) {
        existing.count += 1;
      } else {
        providerMap.set(String(provId), {
          _id: provId,
          name: b.provider_id?.full_name || "Provider",
          email: b.provider_id?.email,
          phone: b.provider_id?.phone,
          count: 1,
          rating_avg: b.provider_id?.provider_profile?.rating_avg,
          rating_count: b.provider_id?.provider_profile?.rating_count,
        });
      }
    });

    const autoFavs = Array.from(providerMap.values()).filter(
      (p) => p.count >= 5,
    );
    manualFavorites.forEach((m: any) => {
      const existing = providerMap.get(String(m._id));
      if (existing) {
        existing.is_manual = true;
        // If not already in autoFavs (count < 5), add it
        if (!autoFavs.some((p) => String(p._id) === String(m._id))) {
          autoFavs.push(existing);
        }
      } else {
        autoFavs.push({
          _id: m._id,
          name: m.full_name || "Provider",
          email: m.email,
          phone: m.provider_profile?.phone,
          count: 0,
          rating_avg: m.rating_avg,
          rating_count: m.rating_count,
          is_manual: true,
        });
      }
    });

    return autoFavs.sort((a, b) => b.count - a.count);
  }, [completedBookings, manualFavorites]);

  const overviewFavPages = Math.ceil(favoriteProviders.length / 3);
  const paginatedOverviewFavs = useMemo(() => {
    const start = (overviewFavPage - 1) * 3;
    return favoriteProviders.slice(start, start + 3);
  }, [favoriteProviders, overviewFavPage]);

  // Favorites tab — 9 per page
  const favTabPages = Math.ceil(favoriteProviders.length / 9);
  const paginatedFavTab = useMemo(() => {
    const start = (favTabPage - 1) * 9;
    return favoriteProviders.slice(start, start + 9);
  }, [favoriteProviders, favTabPage]);

  // ✅ Existing bookings useEffect
  useEffect(() => {
    loadBookings();
  }, []);

  // ✅ ADD THIS - load issues when bookings change
  useEffect(() => {
    if (!bookings.length) return;

    async function loadMyIssues() {
      try {
        const res = await fetch(`${API_BASE}/api/issues/my`, {
          credentials: "include",
        });
        const data = await res.json();
        const map: Record<string, any> = {};
        (data.issues || []).forEach((issue: any) => {
          const bid = issue.booking_id?._id || issue.booking_id;
          map[bid] = issue;
        });
        setBookingIssues(map);
      } catch (err) {
        console.error("Logout error:", err);
      }
    }

    void loadMyIssues();
  }, [bookings]);

  const respondToTravelFee = async (
    bookingId: string,
    decision: "accepted" | "rejected",
  ) => {
    if (
      !confirm(
        decision === "accepted"
          ? "Accept the travel fee? Booking will be confirmed with new total."
          : "Reject the travel fee? This will cancel the booking.",
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/bookings/${bookingId}/travel-fee`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to respond");
      // Reload bookings
      await loadBookings();
    } catch (e: any) {
      alert(e?.message || "Failed to respond to travel fee");
    }
  };

  const cancelBooking = (id: string) => {
    setCancelBookingId(id);
    setCancelOpen(true);
  };

  const initials = (name?: string) => {
    const base = (name || "P").trim();
    return base
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const statusBadge = (status: BookingStatus) => {
    if (status === "confirmed") return "bg-green-100 text-green-700";
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    if (status === "work_completed") return "bg-blue-100 text-blue-700";
    if (status === "reschedule_requested")
      return "bg-purple-100 text-purple-700";
    if (status === "completed") return "bg-gray-100 text-gray-700";
    return "bg-red-100 text-red-700";
  };

  function setBookingTab(tab: BookingTab) {
    setSearchParams((prev: URLSearchParams) => {
      prev.set("tab", tab);
      return prev;
    });
  }
  function setSectionTab(section: SectionTab) {
    setSearchParams((prev: URLSearchParams) => {
      prev.set("section", section as string);
      return prev;
    });
  }

  function openPay(booking: Booking) {
    setPayBookingId(booking._id);
    const amt =
      Number(booking.total_amount ?? 0) ||
      Number(booking.service_id?.price ?? 0);
    setPayAmount(Number.isFinite(amt) ? amt : 0);
    setPayCurrency(booking.currency || "USD");
    setPayOpen(true);
  }

  function openRescheduleModal(bookingId: string) {
    setRescheduleError("");
    setRescheduleBookingId(bookingId);
    setNewDate("");
    setNewTime("");
    setRescheduleOpen(true);
  }

  function closeRescheduleModal() {
    setRescheduleOpen(false);
    setRescheduleBookingId(null);
    setNewDate("");
    setNewTime("");
    setRescheduleError("");
  }

  async function approveRescheduleRequest(bookingId: string) {
    try {
      await apiFetch(`/api/bookings/${bookingId}/reschedule/approve`, {
        method: "PATCH",
      });
      await loadBookings();
    } catch (e: any) {
      alert(e?.message || "Failed to approve reschedule");
    }
  }

  function openRejectRescheduleModal(bookingId: string) {
    setRejectBookingId(bookingId);
    setRejectReason("");
    setRejectMessage("");
    setRejectError("");
    setRejectModalOpen(true);
  }

  function closeRejectRescheduleModal() {
    setRejectModalOpen(false);
    setRejectBookingId(null);
    setRejectReason("");
    setRejectMessage("");
    setRejectError("");
  }

  async function submitRejectReschedule() {
    if (!rejectBookingId) return;
    if (!rejectReason) {
      setRejectError("Please select a reason.");
      return;
    }
    if (rejectReason === "Other" && !rejectMessage.trim()) {
      setRejectError("Please enter your message.");
      return;
    }
    try {
      setRejectLoading(true);
      setRejectError("");
      await apiFetch(`/api/bookings/${rejectBookingId}/reschedule/reject`, {
        method: "PATCH",
        body: JSON.stringify({
          rejection_reason: rejectReason,
          rejection_message: rejectMessage,
        }),
      });
      closeRejectRescheduleModal();
      await loadBookings();
    } catch (e: any) {
      setRejectError(e?.message || "Failed to reject reschedule");
    } finally {
      setRejectLoading(false);
    }
  }

  async function loadSavedAddresses() {
    try {
      const res = await fetch(`${API_BASE}/api/customer/saved-addresses`, {
        credentials: "include",
      });
      const data = await res.json();
      setSavedAddresses(data.saved_addresses || []);
    } catch {
      setSavedAddresses([]);
    }
  }

  async function addAddress() {
    if (!newAddrLabel.trim() || !newAddrText.trim()) {
      setAddressError("Both label and address required");
      return;
    }
    setSavingAddress(true);
    setAddressError("");
    try {
      const res = await fetch(`${API_BASE}/api/customer/saved-addresses`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newAddrLabel,
          address_text: newAddrText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setSavedAddresses(data.saved_addresses);
      setNewAddrLabel("");
      setNewAddrText("");
    } catch (e: any) {
      setAddressError(e.message || "Failed");
    } finally {
      setSavingAddress(false);
    }
  }

  async function deleteAddress(id: string) {
    if (!confirm("Delete this address?")) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/customer/saved-addresses/${id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = await res.json();
      setSavedAddresses(data.saved_addresses || []);
    } catch (err) {
      console.error("Failed to set primary address:", err);
    }
  }

  async function setPrimary(id: string) {
    try {
      const res = await fetch(
        `${API_BASE}/api/customer/saved-addresses/${id}/primary`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );
      const data = await res.json();
      setSavedAddresses(data.saved_addresses || []);
    } catch (err) {
      console.error("Failed to set primary address:", err);
    }
  }

  async function loadManualFavorites() {
    try {
      const res = await fetch(`${API_BASE}/api/customer/favorites`, {
        credentials: "include",
      });
      const data = await res.json();
      setManualFavorites(data.favorites || []);
    } catch (err) {
      console.error("Failed to load manual favorites:", err);
      setManualFavorites([]);
    }
  }

  async function toggleFavoriteProvider(providerId: string, isFav: boolean) {
    try {
      const url = `${API_BASE}/api/customer/favorites/${providerId}`;
      const res = await fetch(url, {
        method: isFav ? "DELETE" : "POST",
        credentials: "include",
      });
      if (!res.ok) return;
      await loadManualFavorites();
    } catch (err) {
      console.error("Failed to set primary address:", err);
    }
  }

  async function submitReschedule() {
    if (!rescheduleBookingId) return;
    if (!newDate || !newTime) {
      setRescheduleError("Please select both date and time.");
      return;
    }
    const selectedDateTime = new Date(`${newDate}T${newTime}:00`);
    if (selectedDateTime <= new Date()) {
      setRescheduleError("Please select a future date and time.");
      return;
    }
    setRescheduleLoading(true);
    setRescheduleError("");
    try {
      await apiFetch<{ message?: string }>(
        `/api/bookings/${rescheduleBookingId}/reschedule`,
        {
          method: "PATCH",
          body: JSON.stringify({ date: newDate, time: newTime }),
        },
      );
      closeRescheduleModal();
      await loadBookings();
      await loadTabBookings("active", tabActivePage, tabActiveSearch);
    } catch (e: any) {
      setRescheduleError(e?.message || "Reschedule failed");
    } finally {
      setRescheduleLoading(false);
    }
  }

  async function submitDeactivate() {
    if (!deactivatePassword) {
      setDeactivateError("Please enter your password.");
      return;
    }
    setDeactivateLoading(true);
    setDeactivateError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/deactivate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deactivatePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      clear();
      navigate("/login");
    } catch (e: any) {
      setDeactivateError(e.message || "Failed to deactivate");
    } finally {
      setDeactivateLoading(false);
    }
  }

  const renderActionButtons = (booking: Booking) => (
    <div className="mt-4 flex flex-wrap gap-3">
      {/* Chat button — always available when booking is active */}
      {booking.status !== "cancelled" && (
        <button
          onClick={() => openChat(booking)}
          className="relative inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          <MessageCircle size={16} />
          Message
          {unreadCounts[booking._id] > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {unreadCounts[booking._id]}
            </span>
          )}
        </button>
      )}

      {booking.status === "reschedule_requested" &&
        booking.reschedule?.requested_by === "provider" && (
          <>
            <button
              onClick={() => approveRescheduleRequest(booking._id)}
              className="rounded-xl bg-[#2563EB] px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700"
            >
              Accept Reschedule
            </button>
            <button
              onClick={() => openRejectRescheduleModal(booking._id)}
              className="rounded-xl border border-red-300 px-4 py-2.5 font-semibold text-red-700 transition hover:bg-red-50"
            >
              Reject Reschedule
            </button>
          </>
        )}

      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeRejectRescheduleModal}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Reject Reschedule
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Tell the provider why you are rejecting this request.
                </p>
              </div>
              <button
                onClick={closeRejectRescheduleModal}
                className="rounded-lg border border-gray-200 px-3 py-1 hover:bg-gray-50"
              >
                ✕
              </button>
            </div>
            {rejectError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {rejectError}
              </div>
            )}
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Reason
                </label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  <option value="">Select reason</option>
                  {rejectionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Message {rejectReason === "Other" ? "*" : "(optional)"}
                </label>
                <textarea
                  value={rejectMessage}
                  onChange={(e) => setRejectMessage(e.target.value)}
                  rows={4}
                  placeholder="Write your message to provider"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeRejectRescheduleModal}
                disabled={rejectLoading}
                className="rounded-xl border border-gray-200 px-5 py-3 font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={submitRejectReschedule}
                disabled={rejectLoading}
                className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {rejectLoading ? "Sending..." : "Send Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {booking.status === "reschedule_requested" &&
        booking.reschedule?.requested_by === "customer" && (
          <span className="rounded-xl bg-purple-50 px-4 py-2.5 text-sm font-semibold text-purple-700">
            Waiting for provider approval
          </span>
        )}

      {booking.reschedule?.decision === "rejected" && (
        <span className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
          Reschedule rejected. Original booking remains active.
        </span>
      )}

      {/* 💰 Signal 13 — Travel fee request from provider */}
      {booking.travel_fee_status === "pending" &&
        booking.travel_fee_requested && (
          <div
            className="w-full rounded-xl p-4 mb-2"
            style={{
              background: "linear-gradient(135deg, #FEF3C7 0%, #FED7AA 100%)",
              border: "1px solid #FCD34D",
            }}
          >
            <div className="font-bold text-orange-900 mb-1">
              💰 Travel Fee Requested
            </div>
            <div className="text-sm text-orange-800 mb-2">
              Your provider requested a{" "}
              <strong>${booking.travel_fee_requested}</strong> travel fee.
              {booking.travel_fee_note && (
                <div className="mt-1 italic">"{booking.travel_fee_note}"</div>
              )}
            </div>
            <div className="text-xs text-orange-700 mb-3 bg-white/50 rounded p-2">
              Service: ${booking.total_amount} + Travel: $
              {booking.travel_fee_requested} ={" "}
              <strong>
                Total: $
                {(booking.total_amount || 0) + booking.travel_fee_requested}
              </strong>
              <div className="mt-1">
                100% of travel fee goes directly to provider.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => respondToTravelFee(booking._id, "accepted")}
                className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4"
              >
                ✅ Accept Fee
              </button>
              <button
                onClick={() => respondToTravelFee(booking._id, "rejected")}
                className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4"
              >
                ❌ Reject & Cancel
              </button>
            </div>
          </div>
        )}

      {(booking.status === "pending" || booking.status === "confirmed") &&
        booking.reschedule?.decision !== "rejected" && (
          <>
            <button
              onClick={() => openRescheduleModal(booking._id)}
              className="rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Reschedule
            </button>
            <button
              onClick={() => cancelBooking(booking._id)}
              className="rounded-xl border border-red-300 px-4 py-2.5 font-semibold text-red-700 transition hover:bg-red-50"
            >
              Cancel
            </button>
          </>
        )}

      {booking.status === "work_completed" &&
        booking.payment_status !== "paid" && (
          <button
            onClick={() => openPay(booking)}
            className="rounded-xl border border-blue-300 px-4 py-2.5 font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            Pay Now
          </button>
        )}

      {/* ✅ Leave Review button */}
      {(booking.status === "completed" ||
        booking.status === "work_completed") && (
        <button
          onClick={() => {
            setSelectedBooking(booking._id);
            setShowReviewModal(true);
          }}
          className="rounded-xl bg-[#2563EB] px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700"
        >
          Leave Review
        </button>
      )}

      {/* ✅ Report Issue button - for completed/work_completed */}
      {(booking.status === "completed" ||
        booking.status === "work_completed") &&
        !bookingIssues?.[booking._id] && (
          <button
            onClick={() => {
              setIssueBookingId(booking._id);
              setShowIssueModal(true);
            }}
            className="rounded-xl border border-red-300 px-4 py-2.5 font-semibold text-red-600 transition hover:bg-red-50"
          >
            ⚠️ Report Issue
          </button>
        )}
    </div>
  );

  const renderBookingCard = (booking: Booking, muted = false) => (
    <div
      key={booking._id}
      className={`rounded-3xl border border-gray-200 bg-white p-5 shadow-sm ${muted ? "" : "hover:border-[#2563EB]"} transition`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-1 gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-bold ${muted ? "bg-gray-300 text-gray-700" : "bg-[#2563EB] text-white"}`}
          >
            {initials(booking.provider_id?.full_name)}
          </div>
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {booking.provider_id?.full_name || "Provider"}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-gray-600">
                    {booking.service_id?.service_name || "Service"}
                  </p>
                  {(booking.provider_id as any)?.provider_profile?.rating_avg >
                    0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400 text-xs">★</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {Number(
                          (booking.provider_id as any)?.provider_profile
                            ?.rating_avg || 0,
                        ).toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-400">
                        (
                        {(booking.provider_id as any)?.provider_profile
                          ?.rating_count || 0}{" "}
                        reviews)
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadge(booking.status)}`}
              >
                {booking.status === "reschedule_requested"
                  ? "Reschedule Pending"
                  : booking.status.charAt(0).toUpperCase() +
                    booking.status.slice(1)}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <Calendar size={16} />
                <span>{booking.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={16} />
                <span>{booking.time}</span>
              </div>
              {booking.address ? (
                <div className="flex items-center gap-1.5">
                  <MapPin size={16} />
                  <span>{booking.address}</span>
                </div>
              ) : null}
            </div>

            {booking.status === "reschedule_requested" &&
              booking.reschedule?.requested_by === "provider" && (
                <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
                  <div className="font-semibold">
                    Provider requested a new time:
                    <span className="ml-2 font-bold">
                      {booking.reschedule?.proposed_date || "—"}{" "}
                      {booking.reschedule?.proposed_time
                        ? `at ${booking.reschedule.proposed_time}`
                        : ""}
                    </span>
                  </div>
                  {booking.reschedule?.reason ? (
                    <div className="mt-1">
                      <span className="font-semibold">Note:</span>{" "}
                      {booking.reschedule.reason}
                    </div>
                  ) : null}
                </div>
              )}

            {/* ✅ Show issue status + provider response */}
            {(() => {
              const issue = bookingIssues?.[booking._id];
              if (!issue) return null;
              return (
                <div className="mt-3">
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-2 ${
                      issue.status === "resolved"
                        ? "bg-green-100 text-green-700"
                        : issue.status === "in_review"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    ⚠️ Issue {issue.status?.replace(/_/g, " ").toUpperCase()}
                  </div>

                  {issue.provider_response && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 mb-2">
                      <div className="text-xs font-bold text-blue-700 mb-1">
                        💬 Provider Response:
                      </div>
                      <div className="text-sm text-blue-800">
                        "{issue.provider_response}"
                      </div>
                    </div>
                  )}

                  {!issue.provider_response && issue.status === "open" && (
                    <div className="text-xs text-gray-500 mb-2">
                      ⏳ Waiting for provider response...
                    </div>
                  )}

                  {issue.status === "resolved" && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 mb-2">
                      <div className="text-xs font-bold text-green-700 mb-1">
                        ✅ Issue Resolved
                      </div>
                      {issue.resolution_note && (
                        <div className="text-sm text-green-800 mb-1">
                          {issue.resolution_note}
                        </div>
                      )}
                      {issue.resolution_type === "refund" && (
                        <div className="text-sm font-bold text-green-700">
                          💰 Refund: ${issue.resolution_amount}
                        </div>
                      )}
                      {issue.resolution_type === "extra_charge" && (
                        <div className="text-sm font-bold text-orange-700">
                          💳 Extra charge: ${issue.resolution_amount}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Refund request button */}
                  {issue.status !== "resolved" && !issue.refund_requested && (
                    <button
                      onClick={async () => {
                        const reason = prompt("Why do you need a refund?");
                        if (!reason) return;
                        try {
                          await fetch(
                            `${API_BASE}/api/issues/${issue._id}/refund-request`,
                            {
                              method: "PATCH",
                              credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ refund_reason: reason }),
                            },
                          );
                          const res = await fetch(`${API_BASE}/api/issues/my`, {
                            credentials: "include",
                          });
                          const data = await res.json();
                          const map: Record<string, any> = {};
                          (data.issues || []).forEach((i: any) => {
                            const bid = i.booking_id?._id || i.booking_id;
                            map[bid] = i;
                          });
                          setBookingIssues(map);
                        } catch (err) {
                          console.error("Error requesting refund:", err);
                        }
                      }}
                      className="mt-1 px-4 py-2 rounded-xl border border-orange-300 text-orange-600 text-sm font-semibold hover:bg-orange-50"
                    >
                      💰 Request Refund
                    </button>
                  )}

                  {issue.refund_requested && issue.status !== "resolved" && (
                    <div className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                      💰 Refund Requested — Admin reviewing
                    </div>
                  )}
                </div>
              );
            })()}

            {booking.notes ? (
              <p className="mt-3 text-sm text-gray-500">{booking.notes}</p>
            ) : null}
            {renderActionButtons(booking)}
            {booking.status === "confirmed" &&
              booking.payment_status !== "paid" && (
                <button
                  onClick={() => navigate(`/track/${booking._id}`)}
                  className="rounded-xl bg-green-600 px-4 py-2.5 font-semibold text-white transition hover:bg-green-700"
                >
                  📍 Track Provider
                </button>
              )}
          </div>
        </div>

        <div className="min-w-[120px] text-left lg:text-right">
          {(() => {
            const issue = bookingIssues?.[booking._id];
            const refundAmt =
              issue?.status === "resolved" &&
              issue?.resolution_type === "refund"
                ? Number(issue.resolution_amount || 0)
                : 0;
            const original = Number(booking.total_amount ?? 0);
            const adjusted = Math.max(0, original - refundAmt);
            return (
              <>
                <div className="text-3xl font-bold text-gray-900">
                  ${adjusted.toFixed(0)}
                </div>
                {refundAmt > 0 && (
                  <div className="text-sm text-gray-400 line-through">
                    ${original.toFixed(0)}
                  </div>
                )}
              </>
            );
          })()}
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            {booking.payment_status}
          </div>
        </div>
      </div>
    </div>
  );

  const activeOverviewBookings = activeBookings.slice(0, 2);

  return (
    <div className="min-h-screen bg-[#f7f8fc] overscroll-none">
      <aside className="fixed top-16 left-0 z-30 h-[calc(100vh-64px)] w-[250px] flex-col justify-between border-r border-gray-200 bg-white px-4 py-6 hidden lg:flex overflow-y-auto">
        <div>
          <div className="mb-6 flex items-center gap-3">
            <Link to="/" className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3156d3] text-2xl font-bold text-white">
                F
              </div>
              <div>
                <div className="text-[18px] font-bold text-gray-900">
                  Fixora
                </div>
                <div className="text-sm text-gray-500">Customer Portal</div>
              </div>
            </Link>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-[#f4f7ff] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#3156d3] text-lg font-bold text-white">
                {initials(user?.full_name || "C")}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[18px] font-bold text-gray-900">
                  {user?.full_name || "Customer"}
                </div>
                <div className="truncate text-sm text-gray-500">
                  Premium Member
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Active Bookings</div>
                <div className="font-bold text-gray-900">
                  {activeBookings.length}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Total Spent</div>
                <div className="font-bold text-gray-900">
                  ${totalSpent.toFixed(0)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {(
              ["overview", "bookings", "favorites", "profile"] as SectionTab[]
            ).map((tab) => {
              const icons = {
                overview: <Home size={18} />,
                bookings: <Calendar size={18} />,
                favorites: <Heart size={18} />,
                profile: <User size={18} />,
              };
              const labels = {
                overview: "Overview",
                bookings: "My Bookings",
                favorites: "Favorites",
                profile: "Profile",
              };
              return (
                <button
                  key={tab}
                  onClick={() => setSectionTab(tab)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold transition ${sectionTab === tab ? "bg-gradient-to-r from-[#2448d8] to-[#4b6ef3] text-white shadow-lg shadow-blue-100" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  {icons[tab]}
                  {labels[tab]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Link
            to="/services"
            className="block rounded-2xl bg-[#57c265] px-4 py-3 text-center font-semibold text-white transition hover:bg-green-600"
          >
            + Book New Service
          </Link>
        </div>
      </aside>

      <main className="w-100vw min-w-0 p-5 lg:p-6 lg:ml-[250px]">
        {sectionTab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#3156d3] text-xl font-bold text-white">
                    {initials(user?.full_name || "C")}
                  </div>
                  <div>
                    <div className="text-[26px] font-bold leading-tight text-gray-900">
                      {user?.full_name || "Customer"}
                    </div>
                    <div className="text-sm text-gray-500">Premium Member</div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Active Bookings</div>
                    <div className="text-3xl font-bold text-gray-900">
                      {activeBookings.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Total Spent</div>
                    <div className="text-3xl font-bold text-gray-900">
                      ${totalSpent.toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
                {[
                  {
                    icon: <Calendar className="text-blue-600" size={22} />,
                    bg: "bg-blue-100",
                    label: "Active Bookings",
                    value: activeBookings.length,
                  },
                  {
                    icon: <CheckCircle className="text-green-600" size={22} />,
                    bg: "bg-green-100",
                    label: "Completed",
                    value: completedBookings.length,
                  },
                  {
                    icon: <DollarSign className="text-purple-600" size={22} />,
                    bg: "bg-purple-100",
                    label: "Total Spent",
                    value: `$${totalSpent.toFixed(0)}`,
                  },
                  {
                    icon: <Heart className="text-orange-600" size={22} />,
                    bg: "bg-orange-100",
                    label: "Favorites",
                    value: favoriteProviders.length,
                  },
                  {
                    icon: <span className="text-2xl">💰</span>,
                    bg: "bg-gradient-to-br from-yellow-100 to-amber-100",
                    label: "Cashback Balance",
                    value: `$${Number(user?.cashback_balance || 0).toFixed(2)}`,
                    sub:
                      Number(user?.cashback_total_earned || 0) > 0
                        ? `Earned $${Number(user?.cashback_total_earned).toFixed(2)} lifetime`
                        : "Earn 5-8% on paid bookings",
                  },
                ].map((card: any, i) => (
                  <div
                    key={i}
                    className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <div
                      className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${card.bg}`}
                    >
                      {card.icon}
                    </div>
                    <div className="text-sm text-gray-500">{card.label}</div>
                    <div className="mt-2 text-4xl font-bold text-gray-900">
                      {card.value}
                    </div>
                    {card.sub && (
                      <div className="mt-1 text-xs text-gray-400">
                        {card.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    Active Bookings
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    Your upcoming and in-progress bookings
                  </div>
                </div>
                <button
                  onClick={loadBookings}
                  className="flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2 font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
              {loadingBookings ? (
                <p className="text-gray-600">Loading bookings...</p>
              ) : activeOverviewBookings.length === 0 ? (
                <div className="py-10 text-center">
                  <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="mb-4 text-gray-600">No active bookings</p>
                  <Link
                    to="/services"
                    className="inline-block rounded-xl bg-[#2563EB] px-6 py-3 text-white transition hover:bg-blue-700"
                  >
                    Book a Service
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeOverviewBookings.map((booking) =>
                    renderBookingCard(booking),
                  )}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 text-2xl font-bold text-gray-900">
                Your Favorite Providers
              </div>
              {favoriteProviders.length === 0 ? (
                <p className="text-gray-500">
                  Complete some bookings to see your favorite providers here.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {paginatedOverviewFavs.map((provider, index) => (
                    <div
                      key={`${provider.name}-${index}`}
                      className="rounded-3xl border border-gray-200 p-6 text-center"
                    >
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#3156d3] text-xl font-bold text-white">
                        {initials(provider.name)}
                      </div>
                      <div className="mt-4 text-xl font-bold text-gray-900">
                        {provider.name}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        Repeat bookings: {provider.count}
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span
                            key={s}
                            className={`text-sm ${s <= Math.round(provider.rating_avg || 0) ? "text-yellow-400" : "text-gray-300"}`}
                          >
                            ★
                          </span>
                        ))}
                        <span className="text-sm font-semibold text-gray-700 ml-1">
                          {provider.rating_avg
                            ? provider.rating_avg.toFixed(1)
                            : "New"}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({provider.rating_count || 0} reviews)
                        </span>
                      </div>
                      <Link
                        to="/services"
                        className="mt-4 inline-block text-sm font-semibold text-[#2563EB]"
                      >
                        Book Again
                      </Link>
                    </div>
                  ))}
                  <Pagination
                    page={overviewFavPage}
                    totalPages={overviewFavPages}
                    onPageChange={setOverviewFavPage}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {sectionTab === "bookings" && (
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  My Bookings
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Manage your active and past bookings
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setBookingTab("active")}
                    className={`rounded-2xl px-5 py-3 font-semibold transition ${bookingTab === "active" ? "bg-[#2563EB] text-white" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    Active ({tabActiveTotal})
                  </button>
                  <button
                    onClick={() => setBookingTab("past")}
                    className={`rounded-2xl px-5 py-3 font-semibold transition ${bookingTab === "past" ? "bg-[#2563EB] text-white" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    Past ({tabPastTotal})
                  </button>
                  <button
                    onClick={() => setBookingTab("resolved")}
                    className={`rounded-2xl px-5 py-3 font-semibold transition ${bookingTab === "resolved" ? "bg-[#2563EB] text-white" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    ✅ Resolved ({tabResolvedTotal})
                  </button>
                </div>

                {/* Refresh button per tab */}
                <button
                  onClick={() => {
                    if (bookingTab === "active")
                      void loadTabBookings(
                        "active",
                        tabActivePage,
                        tabActiveSearch,
                      );
                    if (bookingTab === "past")
                      void loadTabBookings("past", tabPastPage, tabPastSearch);
                    if (bookingTab === "resolved")
                      void loadTabBookings("resolved", tabResolvedPage, "");
                    void loadBookings(); // refresh stats too
                  }}
                  className="flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2 font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Search — active and past tabs only */}
              {(bookingTab === "active" || bookingTab === "past") && (
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder={`Search ${bookingTab} bookings...`}
                    value={
                      bookingTab === "active" ? tabActiveSearch : tabPastSearch
                    }
                    onChange={(e) => {
                      if (bookingTab === "active")
                        setTabActiveSearch(e.target.value);
                      else setTabPastSearch(e.target.value);
                    }}
                    className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    🔍
                  </span>
                </div>
              )}

              {/* Active Tab */}
              {bookingTab === "active" &&
                (tabActiveLoading ? (
                  <p className="text-gray-600">Loading...</p>
                ) : tabActiveData.length === 0 ? (
                  <div className="py-12 text-center">
                    <Calendar
                      size={48}
                      className="mx-auto mb-4 text-gray-300"
                    />
                    <p className="mb-4 text-gray-600">
                      {tabActiveSearch
                        ? "No results found"
                        : "No active bookings"}
                    </p>
                    {!tabActiveSearch && (
                      <Link
                        to="/services"
                        className="inline-block rounded-xl bg-[#2563EB] px-6 py-3 text-white transition hover:bg-blue-700"
                      >
                        Book a Service
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {tabActiveData.map((b) => renderBookingCard(b))}
                    </div>
                    <Pagination
                      page={tabActivePage}
                      totalPages={tabActiveTotalPages}
                      onPageChange={setTabActivePage}
                    />
                  </>
                ))}

              {/* Past Tab */}
              {bookingTab === "past" &&
                (tabPastLoading ? (
                  <p className="text-gray-600">Loading...</p>
                ) : tabPastData.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    {tabPastSearch
                      ? "No results found"
                      : "No past bookings yet."}
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {tabPastData.map((b) => renderBookingCard(b, true))}
                    </div>
                    <Pagination
                      page={tabPastPage}
                      totalPages={tabPastTotalPages}
                      onPageChange={setTabPastPage}
                    />
                  </>
                ))}

              {/* Resolved Tab */}
              {bookingTab === "resolved" &&
                (tabResolvedLoading ? (
                  <p className="text-gray-600">Loading...</p>
                ) : tabResolvedData.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    No resolved issues yet.
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {tabResolvedData.map((b) => renderBookingCard(b, true))}
                    </div>
                    <Pagination
                      page={tabResolvedPage}
                      totalPages={tabResolvedTotalPages}
                      onPageChange={setTabResolvedPage}
                    />
                  </>
                ))}
            </div>
          </div>
        )}
        {sectionTab === "favorites" && (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-gray-900">Favorites</h2>
              <p className="mt-1 text-sm text-gray-500">
                Providers you've saved + booked 5+ times
              </p>
            </div>

            {favoriteProviders.length === 0 ? (
              <div className="py-12 text-center">
                <Heart size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600">
                  No favorites yet. Save providers with ❤️ or book a provider 5+
                  times.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedFavTab.map((p, index) => (
                  <div
                    key={`${p._id}-${index}`}
                    className={`rounded-3xl p-6 relative ${
                      p.is_manual
                        ? "border-2 border-pink-200 bg-pink-50"
                        : "border border-gray-200"
                    }`}
                  >
                    {p.is_manual && p._id && (
                      <button
                        onClick={() => toggleFavoriteProvider(p._id!, true)}
                        title="Remove from favorites"
                        className="absolute top-3 right-3 text-2xl"
                      >
                        ❤️
                      </button>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#3156d3] text-xl font-bold text-white">
                        {initials(p.name)}
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900">
                          {p.name}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
                          {p.is_manual && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-pink-100 text-pink-700 font-semibold">
                              ❤️ SAVED
                            </span>
                          )}
                          {p.count >= 5 && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-semibold">
                              🔁 {p.count}x BOOKED
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span
                          key={s}
                          className={`text-sm ${s <= Math.round(p.rating_avg || 0) ? "text-yellow-400" : "text-gray-300"}`}
                        >
                          ★
                        </span>
                      ))}
                      <span className="text-sm font-semibold text-gray-700 ml-1">
                        {p.rating_avg ? p.rating_avg.toFixed(1) : "New"}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({p.rating_count || 0} reviews)
                      </span>
                    </div>
                    {p.email && (
                      <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                        <div>Email: {p.email}</div>
                        {p.phone && (
                          <div className="mt-1">Phone: {p.phone}</div>
                        )}
                      </div>
                    )}
                    <Link
                      to={p._id ? `/provider/${p._id}` : "/services"}
                      className="mt-4 inline-block rounded-xl bg-[#2563EB] px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700"
                    >
                      Book Again
                    </Link>
                  </div>
                ))}
                <Pagination
                  page={favTabPage}
                  totalPages={favTabPages}
                  onPageChange={setFavTabPage}
                />
              </div>
            )}
          </div>
        )}
        {sectionTab === "profile" && (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
              <p className="mt-1 text-sm text-gray-500">
                Your account information
              </p>
            </div>
            <div className="mx-auto max-w-3xl">
              <div className="mb-8 text-center">
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[#3156d3] text-4xl font-bold text-white">
                  {initials(user?.full_name || "C")}
                </div>
                <div className="mt-4 text-3xl font-bold text-gray-900">
                  {user?.full_name || "Customer"}
                </div>
                <div className="mt-2 text-gray-500">{user?.email || "—"}</div>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-yellow-50 px-4 py-2 text-sm font-semibold text-yellow-700">
                  <Star size={16} fill="currentColor" />
                  Premium Member
                </div>
              </div>
              <div className="grid gap-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Full Name
                  </label>
                  <input
                    value={user?.full_name || ""}
                    readOnly
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Email
                  </label>
                  <input
                    value={user?.email || ""}
                    readOnly
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Role
                  </label>
                  <input
                    value={user?.role || "customer"}
                    readOnly
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 capitalize focus:outline-none"
                  />
                </div>
                {/* 🏠 Signal 5 — Saved Addresses */}
                <div className="mt-6 border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    🏠 Saved Addresses
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Save multiple addresses for faster booking (home, beach
                    house, work, etc.)
                  </p>

                  {savedAddresses.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {savedAddresses.map((a) => (
                        <div
                          key={a._id}
                          className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">
                                {a.label}
                              </span>
                              {a.is_primary && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-semibold">
                                  PRIMARY
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 truncate">
                              {a.formatted_address || a.address_text}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {!a.is_primary && (
                              <button
                                onClick={() => setPrimary(a._id)}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Set primary
                              </button>
                            )}
                            <button
                              onClick={() => deleteAddress(a._id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-xl border border-gray-200 p-4 bg-white">
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      Add new address:
                    </div>
                    {addressError && (
                      <div className="text-red-600 text-sm mb-2">
                        {addressError}
                      </div>
                    )}
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Label (e.g. Home, Beach House)"
                        value={newAddrLabel}
                        onChange={(e) => setNewAddrLabel(e.target.value)}
                        maxLength={50}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <input
                        ref={newAddrInputRef}
                        type="text"
                        placeholder="Start typing an address..."
                        value={newAddrText}
                        onChange={(e) => setNewAddrText(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={addAddress}
                        disabled={savingAddress}
                        className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        {savingAddress ? "Saving..." : "+ Add Address"}
                      </button>
                    </div>
                  </div>
                </div>
                <button className="mt-2 rounded-2xl bg-[#2563EB] px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
                  Save Changes
                </button>
                <div className="mt-6 border-t border-red-100 pt-6">
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                    <h3 className="text-lg font-bold text-red-700">
                      Danger Zone
                    </h3>
                    <p className="mt-1 text-sm text-red-600">
                      Once you deactivate your account, you will be logged out
                      and cannot login until reactivated by admin.
                    </p>
                    <button
                      onClick={() => setDeactivateOpen(true)}
                      className="mt-4 rounded-xl border border-red-300 bg-white px-5 py-2.5 font-semibold text-red-600 hover:bg-red-50 transition"
                    >
                      Deactivate Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <PaymentModal
        open={payOpen}
        bookingId={payBookingId}
        amount={payAmount}
        currency={payCurrency}
        onClose={() => setPayOpen(false)}
        onSuccess={async () => {
          setPayOpen(false);
          await loadBookings();
          await loadTabBookings("active", tabActivePage, tabActiveSearch);
          await loadTabBookings("past", tabPastPage, tabPastSearch);
          await loadTabBookings("resolved", tabResolvedPage, "");
        }}
      />

      <ChatModal
        open={chatOpen}
        bookingId={chatBookingId}
        peerName={chatPeerName}
        onClose={() => {
          setChatOpen(false);
          void loadUnreadCounts();
        }}
      />

      {/* ✅ Review Modal */}
      {showReviewModal && selectedBooking && (
        <ReviewModal
          bookingId={selectedBooking}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedBooking(null);
          }}
          onSuccess={() => {
            setShowReviewModal(false);
            setSelectedBooking(null);
            loadBookings();
          }}
        />
      )}

      {showIssueModal && issueBookingId && (
        <ReportIssueModal
          bookingId={issueBookingId}
          onClose={() => {
            setShowIssueModal(false);
            setIssueBookingId(null);
          }}
          onSuccess={() => {
            setShowIssueModal(false);
            setIssueBookingId(null);
          }}
        />
      )}

      {/* Reschedule Modal */}
      {rescheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeRescheduleModal}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Reschedule Booking
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Choose a new date & time.
                </p>
              </div>
              <button
                onClick={closeRescheduleModal}
                className="rounded-lg border border-gray-200 px-3 py-1 hover:bg-gray-50"
              >
                ✕
              </button>
            </div>
            {rescheduleError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {rescheduleError}
              </div>
            )}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  New Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  min={addDaysISO(0)}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  New Time
                </label>
                <input
                  type="time"
                  value={newTime}
                  min={(() => {
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                    if (newDate === todayStr) {
                      return `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
                    }
                    return undefined;
                  })()}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeRescheduleModal}
                disabled={rescheduleLoading}
                className="rounded-xl border border-gray-200 px-5 py-3 font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={submitReschedule}
                disabled={rescheduleLoading}
                className="rounded-xl bg-[#2563EB] px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {rescheduleLoading ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {deactivateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDeactivateOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900">
              Deactivate Account
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Enter your password to confirm deactivation. You will be logged
              out immediately.
            </p>
            {deactivateError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {deactivateError}
              </div>
            )}
            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Confirm Password
              </label>
              <input
                type="password"
                value={deactivatePassword}
                onChange={(e) => setDeactivatePassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeactivateOpen(false);
                  setDeactivatePassword("");
                  setDeactivateError("");
                }}
                disabled={deactivateLoading}
                className="rounded-xl border border-gray-200 px-5 py-3 font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={submitDeactivate}
                disabled={deactivateLoading}
                className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deactivateLoading ? "Deactivating..." : "Yes, Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelOpen && cancelBookingId && (
        <CancellationModal
          bookingId={cancelBookingId}
          onClose={() => {
            setCancelOpen(false);
            setCancelBookingId(null);
          }}
          onSuccess={() => {
            loadBookings();
          }}
        />
      )}
    </div>
  );
}
