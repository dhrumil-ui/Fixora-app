import React, { JSX, useEffect, useMemo, useRef, useState } from "react";
import ProviderOnboarding from "./ProviderOnboarding";
import { Clock, User, MessageCircle } from "lucide-react";
import { io } from "socket.io-client";
import { useSearchParams } from "react-router-dom";
import { useProviderLive } from "../hooks/useLiveData";
import { useSocket } from "../hooks/useSocket";
import { EVENTS } from "../lib/socketEvents";
import ChatModal from "./Chatmodal";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:5001";

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 16,
        paddingTop: 16,
        borderTop: "1px solid #E5E7EB",
      }}
    >
      <span style={{ fontSize: 13, color: "#6B7280" }}>
        Page <b>{page}</b> of <b>{totalPages}</b>
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #D1D5DB",
            background: "white",
            cursor: page === 1 ? "not-allowed" : "pointer",
            opacity: page === 1 ? 0.4 : 1,
            fontWeight: 700,
          }}
        >
          «
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #D1D5DB",
            background: "white",
            cursor: page === 1 ? "not-allowed" : "pointer",
            opacity: page === 1 ? 0.4 : 1,
            fontWeight: 700,
          }}
        >
          ‹
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
              <span
                key={`d${i}`}
                style={{ padding: "6px 4px", color: "#9CA3AF" }}
              >
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid",
                  fontWeight: 700,
                  cursor: "pointer",
                  borderColor: page === p ? "#2563EB" : "#D1D5DB",
                  background: page === p ? "#2563EB" : "white",
                  color: page === p ? "white" : "#374151",
                }}
              >
                {p}
              </button>
            ),
          )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #D1D5DB",
            background: "white",
            cursor: page === totalPages ? "not-allowed" : "pointer",
            opacity: page === totalPages ? 0.4 : 1,
            fontWeight: 700,
          }}
        >
          ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #D1D5DB",
            background: "white",
            cursor: page === totalPages ? "not-allowed" : "pointer",
            opacity: page === totalPages ? 0.4 : 1,
            fontWeight: 700,
          }}
        >
          »
        </button>
      </div>
    </div>
  );
}

type Role = "provider" | "customer" | "admin";

type ProviderProfile = {
  is_available?: boolean;
  phone?: string;
  photo_url?: string;
  ssn_last4?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  bio?: string;
  rating_avg?: number;
  rating_count?: number;
  max_travel_miles?: number;
};

type MeUser = {
  _id: string;
  full_name?: string;
  email?: string;
  role: Role;
  provider_status?: string;
  is_profile_complete?: boolean;
  provider_profile?: ProviderProfile;
  availability?: {
    days?: string[];
    start_time?: string;
    end_time?: string;
  };
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
  category_id?: Category | string;
};

type BookingStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "completed"
  | "reschedule_requested";

type Booking = {
  _id: string;
  status: BookingStatus;
  date?: string;
  time?: string;
  address?: string;
  notes?: string;
  payment_status?: "pending" | "paid" | "failed" | "refunded";
  service_id?: { service_name?: string; price?: number } | string;
  customer_id?: { _id?: string; full_name?: string; email?: string } | string;
  reschedule?: {
    requested?: boolean;
    proposed_date?: string;
    proposed_time?: string;
    reason?: string;
    requested_by?: "provider" | "customer";
    previous_status?: string;
    decision?: "pending" | "accepted" | "rejected" | null;
    rejection_reason?: string;
    rejection_message?: string;
    decision_at?: string;
  };
};

type ApiMeResponse = { user: MeUser };
type ApiCategoriesResponse = { categories: Category[] } | Category[];
type ApiMyServicesResponse = { services: Service[] };

type SidebarSection =
  | "dashboard"
  | "requests"
  | "earnings"
  | "profile"
  | "services"
  | "add"
  | "issues";

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

function StatusPill({ status }: { status: BookingStatus }): JSX.Element {
  const map: Record<BookingStatus, { bg: string; fg: string; label: string }> =
    {
      pending: { bg: "#FEF3C7", fg: "#92400E", label: "Pending" },
      confirmed: { bg: "#ECFDF3", fg: "#027A48", label: "Confirmed" },
      rejected: { bg: "#FEF2F2", fg: "#B42318", label: "Rejected" },
      cancelled: { bg: "#F2F4F7", fg: "#475467", label: "Cancelled" },
      completed: { bg: "#EEF4FF", fg: "#1D4ED8", label: "Completed" },
      reschedule_requested: {
        bg: "#F5F3FF",
        fg: "#6D28D9",
        label: "Reschedule Requested",
      },
    };

  const c = map[status] || map.pending;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "7px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: c.bg,
        color: c.fg,
        whiteSpace: "nowrap",
      }}
    >
      {c.label}
    </span>
  );
}

function SidebarButton(props: {
  active: boolean;
  label: string;
  onClick: () => void;
  badge?: number;
}): JSX.Element {
  return (
    <button
      onClick={props.onClick}
      style={{
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        fontWeight: 800,
        fontSize: 16,
        borderRadius: 18,
        padding: "14px 16px",
        color: props.active ? "white" : props.badge ? "#DC2626" : "#374151",
        background: props.active
          ? "linear-gradient(90deg, #2F56E5 0%, #4B6EF3 100%)"
          : props.badge
            ? "#FEF2F2"
            : "transparent",
        boxShadow: props.active ? "0 10px 18px rgba(37,99,235,0.18)" : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>{props.label}</span>
      {props.badge ? (
        <span
          style={{
            background: "#DC2626",
            color: "white",
            borderRadius: 999,
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          {props.badge}
        </span>
      ) : null}
    </button>
  );
}

function StatCard(props: {
  title: string;
  value: string | number;
  accent: string;
  subtitle?: string;
}): JSX.Element {
  const { title, value, accent, subtitle } = props;
  return (
    <div
      style={{
        minHeight: 140,
        background: "white",
        border: "1px solid #E5E7EB",
        borderRadius: 24,
        padding: 20,
        boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          background: accent,
        }}
      />
      <div style={{ marginTop: 16, fontSize: 15, color: "#6B7280" }}>
        {title}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 24,
          fontWeight: 900,
          color: "#111827",
          textTransform: "capitalize",
        }}
      >
        {value}
      </div>
      {subtitle ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

export function ProviderDashboard(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeUser | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  // Tracks whether the user has edited the profile form. When true, the
  // useEffect that syncs from `me` will NOT overwrite the user's pending edits
  // (this prevents background `me` refreshes from wiping out unsaved changes
  // like a newly-toggled "Sat" working day).
  const [profileFormDirty, setProfileFormDirty] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [myServices, setMyServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const refreshAll = () => {
    void loadProviderBookings();
    void loadRequestsSection(requestsPage, requestsSearch);
    void loadEarningsSection(earningsPage, earningsSearch);
    void loadIssues();
    void loadIssuesPaginated(issuesPage, issueTab);
  };
  useProviderLive({
    onNewRequest: refreshAll,
    onBookingUpdate: refreshAll,
    onNewReview: refreshAll,
    onNewIssue: refreshAll,
    onPaymentReceived: refreshAll,
  });

  // ── Chat state ──
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [chatPeerName, setChatPeerName] = useState<string>("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  async function loadUnreadCounts() {
    try {
      const res = await fetch(`${API_BASE}/api/messages/unread-counts`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCounts(data.counts || {});
    } catch {
      /* ignore */
    }
  }

  function openChat(booking: any) {
    const customerName =
      booking?.customer_id?.full_name || booking?.customer_name || "Customer";
    setChatBookingId(booking._id);
    setChatPeerName(customerName);
    setChatOpen(true);
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[booking._id];
      return next;
    });
  }

  // ── Socket listener for new messages → bump badges ──
  const { socket: chatSocket, connected: chatSocketConnected } = useSocket();
  useEffect(() => {
    if (!chatSocketConnected) return;
    const handleNew = (payload: any) => {
      if (!payload?.bookingId) return;
      if (chatOpen && chatBookingId === payload.bookingId) return;
      setUnreadCounts((prev) => ({
        ...prev,
        [payload.bookingId]: (prev[payload.bookingId] || 0) + 1,
      }));
    };
    const handleUnread = () => void loadUnreadCounts();
    chatSocket.on(EVENTS.CHAT_MESSAGE_NEW, handleNew);
    chatSocket.on(EVENTS.CHAT_UNREAD_UPDATE, handleUnread);
    return () => {
      chatSocket.off(EVENTS.CHAT_MESSAGE_NEW, handleNew);
      chatSocket.off(EVENTS.CHAT_UNREAD_UPDATE, handleUnread);
    };
  }, [chatSocketConnected, chatSocket, chatOpen, chatBookingId]);

  useEffect(() => {
    void loadUnreadCounts();
  }, []);

  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection =
    (searchParams.get("tab") as SidebarSection) || "dashboard";
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string>("");
  const [resDate, setResDate] = useState("");
  const [resTime, setResTime] = useState("");
  const [resReason, setResReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editServiceId, setEditServiceId] = useState<string>("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");
  const [pricingType, setPricingType] = useState<"fixed" | "hourly">("fixed");
  const [fullName, setFullName] = useState(me?.full_name || "");
  const [phone, setPhone] = useState(me?.provider_profile?.phone || "");
  const [issues, setIssues] = useState<any[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [address, setAddress] = useState(
    me?.provider_profile?.address_line1 || "",
  );
  const profileAddressInputRef = useRef<HTMLInputElement>(null);
  const [city, setCity] = useState(me?.provider_profile?.city || "");
  const [state, setState] = useState(me?.provider_profile?.state || "");
  const [zip, setZip] = useState(me?.provider_profile?.zip || "");
  const [bio, setBio] = useState(me?.provider_profile?.bio || "");
  const [aiLoading, setAiLoading] = useState(false);
  const [trackingBookingId, setTrackingBookingId] = useState<string | null>(
    null,
  );
  const [issueTab, setIssueTab] = useState<"open" | "resolved">("open");
  const [liveGpsLoading, setLiveGpsLoading] = useState(false);
  const [liveGpsError, setLiveGpsError] = useState("");
  const [urgentBooking, setUrgentBooking] = useState<any>(null);
  const [urgentAccepting, setUrgentAccepting] = useState(false);
  const [tracking, setTracking] = useState(false);
  const socketRef = useRef<any>(null);
  const watchRef = useRef<number | null>(null);
  const [catLimits, setCatLimits] = useState<{
    min_price: number;
    max_price: number;
    allowed_pricing_types: string[];
  } | null>(null);
  const [availDays, setAvailDays] = useState<string[]>(
    me?.availability?.days || ["Mon", "Tue", "Wed", "Thu", "Fri"],
  );
  const [travelFeeBookingId, setTravelFeeBookingId] = useState<string | null>(
    null,
  );
  const [travelFeeAmount, setTravelFeeAmount] = useState("");
  const [travelFeeNote, setTravelFeeNote] = useState("");
  const [travelFeeSaving, setTravelFeeSaving] = useState(false);
  const [travelFeeError, setTravelFeeError] = useState("");
  const [requestsSearch, setRequestsSearch] = useState("");
  const [requestsPage, setRequestsPage] = useState(1);
  const [earningsSearch, setEarningsSearch] = useState("");
  const [earningsPage, setEarningsPage] = useState(1);
  const [servicesSearch, setServicesSearch] = useState("");
  const [servicesPage, setServicesPage] = useState(1);
  const [requestsData, setRequestsData] = useState<Booking[]>([]);
  const [requestsTotalPages, setRequestsTotalPages] = useState(1);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [earningsData, setEarningsData] = useState<Booking[]>([]);
  const [earningsTotalPages, setEarningsTotalPages] = useState(1);
  const [servicesTotalPages, setServicesTotalPages] = useState(1);
  const [servicesTotal, setServicesTotal] = useState(0);
  const [rescheduleModalError, setRescheduleModalError] = useState("");
  const [seasonalMonths, setSeasonalMonths] = useState<number[]>([]);
  const hasInitialized = useRef(false);
  const [customerHistory, setCustomerHistory] = useState<Record<string, any>>(
    {},
  );
  const [issuesSectionData, setIssuesSectionData] = useState<any[]>([]);
  const [issuesSectionTotalPages, setIssuesSectionTotalPages] = useState(1);
  const [issuesPage, setIssuesPage] = useState(1);
  const [availStart, setAvailStart] = useState(
    me?.availability?.start_time || "09:00",
  );
  const [availEnd, setAvailEnd] = useState(
    me?.availability?.end_time || "18:00",
  );
  const needsProfile = useMemo(() => {
    if (!me) return false;
    return me.role === "provider" && me.is_profile_complete === false;
  }, [me]);

  const needsFirstService = useMemo(() => {
    if (!me) return false;
    if (needsProfile) return false;
    return myServices.length === 0;
  }, [me, needsProfile, myServices.length]);

  const pendingRequests = useMemo(
    () => bookings.filter((b) => b.status === "pending"),
    [bookings],
  );

  const confirmedRequests = useMemo(
    () => bookings.filter((b) => b.status === "confirmed"),
    [bookings],
  );

  const completedRequests = useMemo(
    () => bookings.filter((b) => b.status === "completed"),
    [bookings],
  );

  const totalEarnings = useMemo(() => {
    return completedRequests.reduce((sum, b) => {
      const amount =
        Number((b as any).total_amount ?? 0) ||
        (typeof b.service_id === "object" && b.service_id?.price
          ? Number(b.service_id.price)
          : 0);
      return sum + amount;
    }, 0);
  }, [completedRequests]);

  const thisWeekEarnings = useMemo(() => {
    // Sunday-start week (matches most US locales). Adjust if needed.
    const now = new Date();
    const dow = now.getDay(); // 0=Sun..6=Sat
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dow);
    startOfWeek.setHours(0, 0, 0, 0);
    let sum = 0;
    completedRequests.forEach((b) => {
      if (!b?.date) return;
      const d = new Date(b.date);
      if (Number.isNaN(d.getTime())) return;
      if (d < startOfWeek) return;
      const amt =
        typeof b.service_id === "object" && b.service_id?.price
          ? Number(b.service_id.price)
          : Number((b as any).total_amount || 0);
      if (Number.isFinite(amt)) sum += amt;
    });
    return Math.round(sum);
  }, [completedRequests]);

  const thisMonthEarnings = useMemo(() => {
    const now = new Date();
    let sum = 0;
    completedRequests.forEach((b) => {
      if (!b?.date) return;
      const d = new Date(b.date);
      if (Number.isNaN(d.getTime())) return;
      if (
        d.getFullYear() !== now.getFullYear() ||
        d.getMonth() !== now.getMonth()
      )
        return;
      const amt =
        typeof b.service_id === "object" && b.service_id?.price
          ? Number(b.service_id.price)
          : Number((b as any).total_amount || 0);
      if (Number.isFinite(amt)) sum += amt;
    });
    return Math.round(sum);
  }, [completedRequests]);

  const todaysEarnings = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    let sum = 0;
    completedRequests.forEach((b) => {
      if (!b?.date) return;
      // b.date is "YYYY-MM-DD" string in this app
      if (String(b.date).slice(0, 10) !== todayISO) return;
      const amt =
        typeof b.service_id === "object" && b.service_id?.price
          ? Number(b.service_id.price)
          : Number((b as any).total_amount || 0);
      if (Number.isFinite(amt)) sum += amt;
    });
    return Math.round(sum);
  }, [completedRequests]);
  const openIssuesCount = useMemo(
    () => issues.filter((i) => i.status === "open").length,
    [issues],
  );

  const filteredBookings = useMemo(() => {
    const q = requestsSearch.toLowerCase();
    return bookings.filter((b) => {
      if (!q) return true;
      const customer =
        typeof b.customer_id === "object" && b.customer_id
          ? b.customer_id.full_name || b.customer_id.email || ""
          : "";
      const service =
        typeof b.service_id === "object" && b.service_id
          ? b.service_id.service_name || ""
          : "";
      return (
        customer.toLowerCase().includes(q) ||
        service.toLowerCase().includes(q) ||
        (b.date || "").includes(q)
      );
    });
  }, [bookings, requestsSearch]);

  const paginatedBookings = useMemo(() => {
    const start = (requestsPage - 1) * PAGE_SIZE;
    return filteredBookings.slice(start, start + PAGE_SIZE);
  }, [filteredBookings, requestsPage]);

  const filteredEarnings = useMemo(() => {
    const q = earningsSearch.toLowerCase();
    return completedRequests.filter((b) => {
      if (!q) return true;
      const customer =
        typeof b.customer_id === "object" && b.customer_id
          ? b.customer_id.full_name || b.customer_id.email || ""
          : "";
      const service =
        typeof b.service_id === "object" && b.service_id
          ? b.service_id.service_name || ""
          : "";
      return (
        customer.toLowerCase().includes(q) || service.toLowerCase().includes(q)
      );
    });
  }, [completedRequests, earningsSearch]);

  const paginatedEarnings = useMemo(() => {
    const start = (earningsPage - 1) * PAGE_SIZE;
    return filteredEarnings.slice(start, start + PAGE_SIZE);
  }, [filteredEarnings, earningsPage]);

  const filteredServices = useMemo(() => {
    const q = servicesSearch.toLowerCase();
    return myServices.filter((s) => {
      if (!q) return true;
      const cat =
        typeof s.category_id === "object" && s.category_id
          ? s.category_id.category_name || s.category_id.name || ""
          : "";
      return (
        s.service_name.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }, [myServices, servicesSearch]);

  const paginatedServices = useMemo(() => {
    const start = (servicesPage - 1) * PAGE_SIZE;
    return filteredServices.slice(start, start + PAGE_SIZE);
  }, [filteredServices, servicesPage]);

  const filteredIssues = useMemo(() => {
    return issues.filter((i) =>
      issueTab === "open" ? i.status !== "resolved" : i.status === "resolved",
    );
  }, [issues, issueTab]);

  const paginatedIssues = useMemo(() => {
    const start = (issuesPage - 1) * PAGE_SIZE;
    return filteredIssues.slice(start, start + PAGE_SIZE);
  }, [filteredIssues, issuesPage]);

  // Rolling last 6 months (oldest -> current). Labels recompute every render.
  const { monthLabels, monthlySeries } = useMemo(() => {
    const names = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const today = new Date();
    const labels: string[] = [];
    const buckets: { y: number; m: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      labels.push(names[d.getMonth()]);
      buckets.push({ y: d.getFullYear(), m: d.getMonth() });
    }
    const totals = new Array(6).fill(0);
    completedRequests.forEach((b) => {
      if (!b?.date) return;
      const d = new Date(b.date);
      if (Number.isNaN(d.getTime())) return;
      const idx = buckets.findIndex(
        (x) => x.y === d.getFullYear() && x.m === d.getMonth(),
      );
      if (idx === -1) return;
      const amount =
        typeof b.service_id === "object" && b.service_id?.price
          ? Number(b.service_id.price)
          : Number((b as any).total_amount || 0);
      totals[idx] += Number.isFinite(amount) ? amount : 0;
    });
    return { monthLabels: labels, monthlySeries: totals };
  }, [completedRequests]);

  function setActiveSection(section: SidebarSection) {
    setSearchParams({ tab: section });
  }

  // Real weekly activity: count completed bookings by day-of-week (Mon..Sun)
  const weeklySeries = useMemo(() => {
    // JS getDay(): Sun=0, Mon=1, ... Sat=6. We want Mon..Sun order.
    const dayMap = [6, 0, 1, 2, 3, 4, 5]; // index = getDay() -> position in Mon..Sun
    const counts = [0, 0, 0, 0, 0, 0, 0];
    completedRequests.forEach((b) => {
      if (!b?.date) return;
      const d = new Date(b.date);
      if (Number.isNaN(d.getTime())) return;
      const pos = dayMap[d.getDay()];
      counts[pos] += 1;
    });
    return counts;
  }, [completedRequests]);

  const btnPrimarySmall: React.CSSProperties = {
    border: "none",
    background: "#2563EB",
    color: "white",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
  };

  function startTracking(bookingId: string) {
    const socket = io(API_BASE, { withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_booking", { bookingId, role: "provider" });
      setTracking(true);
      setTrackingBookingId(bookingId);

      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          socket.emit("provider_location", {
            bookingId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => console.error("GPS error:", err),
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    });
  }

  function IssueResponseForm({
    issueId,
    onSuccess,
  }: {
    issueId: string;
    onSuccess: () => void;
  }) {
    const [response, setResponse] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [open, setOpen] = useState(false);

    async function submit() {
      if (!response.trim()) {
        setError("Please enter a response");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/issues/${issueId}/respond`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed");
        setOpen(false);
        setResponse("");
        onSuccess();
      } catch (e: any) {
        setError(e.message || "Failed");
      } finally {
        setLoading(false);
      }
    }

    if (!open) {
      return (
        <button
          onClick={() => setOpen(true)}
          style={{
            marginTop: 12,
            border: "1px solid #2563EB",
            background: "white",
            color: "#2563EB",
            padding: "8px 16px",
            borderRadius: 10,
            fontWeight: 800,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          💬 Respond to Issue
        </button>
      );
    }

    return (
      <div style={{ marginTop: 12 }}>
        {error && (
          <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 8 }}>
            {error}
          </div>
        )}
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={3}
          placeholder="Explain what happened or how you will fix this..."
          style={{
            width: "100%",
            border: "1px solid #D1D5DB",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 14,
            resize: "vertical",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              border: "none",
              background: "#2563EB",
              color: "white",
              padding: "8px 16px",
              borderRadius: 10,
              fontWeight: 800,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {loading ? "Sending..." : "Send Response"}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setResponse("");
              setError("");
            }}
            style={{
              border: "1px solid #D1D5DB",
              background: "white",
              color: "#374151",
              padding: "8px 16px",
              borderRadius: 10,
              fontWeight: 800,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function stopTracking() {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    if (socketRef.current) socketRef.current.disconnect();
    setTracking(false);
    setTrackingBookingId(null);
  }

  async function loadIssues() {
    setIssuesLoading(true);
    try {
      const res = await apiFetch<{ issues: any[] }>("/api/issues/provider");
      setIssues(res.issues || []);
    } catch {
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  }

  async function loadRequestsSection(
    page = requestsPage,
    search = requestsSearch,
  ) {
    setBookingLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), search });
      const data = await apiFetch<{
        bookings: Booking[];
        totalPages: number;
        total: number;
      }>(`/api/bookings/provider?${params}`);
      setRequestsData(data.bookings || []);
      setRequestsTotalPages(data.totalPages || 1);
      setRequestsTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || "Failed to load bookings");
    } finally {
      setBookingLoading(false);
    }
  }

  async function loadEarningsSection(
    page = earningsPage,
    search = earningsSearch,
  ) {
    try {
      const params = new URLSearchParams({
        page: String(page),
        search,
        status: "completed",
      });
      const data = await apiFetch<{ bookings: Booking[]; totalPages: number }>(
        `/api/bookings/provider?${params}`,
      );
      setEarningsData(data.bookings || []);
      setEarningsTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Error requesting refund:", err);
    }
  }

  async function loadIssuesPaginated(page = issuesPage, tab = issueTab) {
    setIssuesLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), tab });
      const res = await apiFetch<{ issues: any[]; totalPages: number }>(
        `/api/issues/provider?${params}`,
      );
      setIssuesSectionData(res.issues || []);
      setIssuesSectionTotalPages(res.totalPages || 1);
    } catch {
      setIssuesSectionData([]);
    } finally {
      setIssuesLoading(false);
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
      // clear auth store
      const API_BASE_URL =
        (import.meta as any).env?.VITE_API_BASE || "http://localhost:5001";
      window.location.href = "/login";
    } catch (e: any) {
      setDeactivateError(e.message || "Failed to deactivate");
    } finally {
      setDeactivateLoading(false);
    }
  }

  async function loadProviderBookings() {
    setBookingLoading(true);
    try {
      const data = await apiFetch<{ bookings: Booking[] }>(
        "/api/bookings/provider",
      );
      setBookings(data.bookings || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load bookings");
    } finally {
      setBookingLoading(false);
    }
  }

  async function loadCustomerHistoryFor(customerId: string) {
    if (!customerId || customerHistory[customerId]) return;
    try {
      const data = await apiFetch<any>(
        `/api/bookings/customer-history/${customerId}`,
      );
      setCustomerHistory((prev) => ({ ...prev, [customerId]: data }));
    } catch {
      // silent fail
    }
  }

  async function onCategoryChange(id: string) {
    setCategoryId(id);
    if (!id) {
      setCatLimits(null);
      return;
    }
    try {
      const res = await apiFetch<{ categories: any[] }>("/api/categories");
      const cats = res.categories || [];
      const found = cats.find((c: any) => c._id === id);
      if (found) {
        setCatLimits({
          min_price: found.min_price ?? 0,
          max_price: found.max_price ?? 9999,
          allowed_pricing_types: found.allowed_pricing_types || [
            "fixed",
            "hourly",
          ],
        });
        // Auto-select first allowed pricing type
        if (found.allowed_pricing_types?.length === 1) {
          setPricingType(found.allowed_pricing_types[0]);
        }
      }
    } catch {
      setCatLimits(null);
    }
  }

  function getProviderRescheduleNote(b: Booking) {
    if (b.reschedule?.decision === "rejected") {
      return "Customer rejected reschedule";
    }

    if (
      b.status === "reschedule_requested" &&
      b.reschedule?.requested_by === "provider"
    ) {
      return "Waiting for customer approval";
    }

    return "";
  }

  async function loadMyServices(page?: number, search = "") {
    try {
      let url = "/api/services/my";
      if (page !== undefined) {
        const params = new URLSearchParams({ page: String(page), search });
        url = `/api/services/my?${params}`;
      }
      const myRes = await apiFetch<
        ApiMyServicesResponse & { totalPages?: number; total?: number }
      >(url);
      setMyServices(myRes.services || []);
      if (myRes.totalPages !== undefined)
        setServicesTotalPages(myRes.totalPages);
      if (myRes.total !== undefined) setServicesTotal(myRes.total);
    } catch (e: any) {
      setError(e?.message || "Failed to load services");
    }
  }

  async function completeBooking(id: string) {
    setError("");
    try {
      await apiFetch(`/api/bookings/${id}/complete`, { method: "PATCH" });
      await loadProviderBookings();
      await loadRequestsSection(requestsPage, requestsSearch);
    } catch (e: any) {
      setError(e?.message || "Failed to complete booking");
    }
  }

  async function submitProviderReschedule() {
    setRescheduleModalError("");
    if (!rescheduleBookingId || !resDate || !resTime) {
      setRescheduleModalError("Date and time are required");
      return;
    }

    const selectedDateTime = new Date(`${resDate}T${resTime}:00`);
    if (selectedDateTime <= new Date()) {
      setRescheduleModalError("Please select a future date and time.");
      return;
    }

    try {
      await apiFetch(`/api/bookings/${rescheduleBookingId}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({
          date: resDate,
          time: resTime,
          reason: resReason,
        }),
      });
      setShowReschedule(false);
      setRescheduleBookingId("");
      setResDate("");
      setResTime("");
      setResReason("");
      setRescheduleModalError("");
      await loadProviderBookings();
      await loadRequestsSection(requestsPage, requestsSearch);
    } catch (e: any) {
      setRescheduleModalError(e?.message || "Reschedule failed");
    }
  }

  async function loadAll(): Promise<void> {
    setError("");
    setLoading(true);
    try {
      const meRes = await apiFetch<ApiMeResponse>("/api/provider/me");
      setMe(meRes.user);

      const catRes = await apiFetch<ApiCategoriesResponse>("/api/categories");
      const cats = Array.isArray(catRes) ? catRes : catRes.categories || [];
      setCategories(cats);

      if (meRes.user?.is_profile_complete) {
        await loadMyServices();
      } else {
        setMyServices([]);
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }

    await loadProviderBookings();
    await loadIssues();
  }

  useEffect(() => {
    if (!bookings.length || !tracking || !trackingBookingId) return;

    // ✅ Find the booking being tracked
    const trackedBooking = bookings.find((b) => b._id === trackingBookingId);

    // ✅ Stop if payment is done or booking completed
    if (
      trackedBooking?.payment_status === "paid" ||
      trackedBooking?.status === "completed"
    ) {
      console.log("✅ Payment done — stopping location sharing");
      stopTracking();
    }
  }, [bookings, tracking, trackingBookingId]);

  useEffect(() => {
    if (!tracking) return;

    // ✅ Poll every 30 seconds to check payment status
    const interval = setInterval(() => {
      void loadProviderBookings();
    }, 30000);

    return () => clearInterval(interval);
  }, [tracking]);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!me) return;
    if (needsProfile) return;
    if (loading) return;
    if (hasInitialized.current) return;
    if (me.is_profile_complete && myServices.length === 0) {
      return;
    }
    hasInitialized.current = true;
    if (needsFirstService) {
      setActiveSection("add");
      return;
    }
    setActiveSection("dashboard");
  }, [
    me,
    needsProfile,
    needsFirstService,
    loading,
    myServices.length,
    setActiveSection,
  ]);

  // ✅ Auto-start tracking for today's confirmed bookings
  useEffect(() => {
    if (!bookings.length) return;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const currentHour = today.getHours();
    const todayBookings = bookings.filter(
      (b) => b.status === "confirmed" && b.date === todayStr,
    );
    if (!todayBookings.length) return;
    if (currentHour >= 9) {
      todayBookings.forEach((b) => {
        if (trackingBookingId !== b._id) {
          startTracking(b._id);
        }
      });
    } else {
      // Calculate ms until 9 AM
      const msUntil9AM =
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          9,
          0,
          0,
        ).getTime() - today.getTime();

      console.log(
        `⏰ Auto-tracking starts in ${Math.round(msUntil9AM / 60000)} minutes`,
      );
      const timer = setTimeout(() => {
        todayBookings.forEach((b) => startTracking(b._id));
      }, msUntil9AM);
      return () => clearTimeout(timer);
    }
  }, [bookings]);

  // Requests section
  useEffect(() => {
    if (activeSection === "requests")
      void loadRequestsSection(requestsPage, requestsSearch);
  }, [requestsPage]);
  useEffect(() => {
    if (activeSection === "requests") {
      setRequestsPage(1);
      void loadRequestsSection(1, requestsSearch);
    }
  }, [requestsSearch]);

  // Earnings section
  useEffect(() => {
    if (activeSection === "earnings")
      void loadEarningsSection(earningsPage, earningsSearch);
  }, [earningsPage]);
  useEffect(() => {
    if (activeSection === "earnings") {
      setEarningsPage(1);
      void loadEarningsSection(1, earningsSearch);
    }
  }, [earningsSearch]);

  // Google Places Autocomplete on the Profile address input.
  // The input only mounts when activeSection === "profile", and Maps loads async,
  // so we poll until both the input and Maps are ready.
  useEffect(() => {
    if (activeSection !== "profile") return;

    let cancelled = false;
    let autocomplete: any = null;
    let listener: any = null;
    let pollId: number | null = null;

    const init = (): boolean => {
      if (cancelled) return true; // stop polling
      if (!profileAddressInputRef.current) return false;
      const win = window as any;
      if (!win.google?.maps?.places) return false;

      autocomplete = new win.google.maps.places.Autocomplete(
        profileAddressInputRef.current,
        {
          componentRestrictions: { country: "us" },
          types: ["address"],
          fields: ["formatted_address", "geometry"],
        },
      );

      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const formatted = place?.formatted_address || "";
        if (formatted) setAddress(formatted);
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
  }, [activeSection]);

  // Services section
  useEffect(() => {
    if (activeSection === "services")
      void loadMyServices(servicesPage, servicesSearch);
  }, [servicesPage]);
  useEffect(() => {
    if (activeSection === "services") {
      setServicesPage(1);
      void loadMyServices(1, servicesSearch);
    }
  }, [servicesSearch]);

  // Issues section
  useEffect(() => {
    if (activeSection === "issues")
      void loadIssuesPaginated(issuesPage, issueTab);
  }, [issuesPage]);

  useEffect(() => {
    if (activeSection === "issues") {
      setIssuesPage(1);
      void loadIssuesPaginated(1, issueTab);
    }
  }, [issueTab]);

  useEffect(() => {
    if (!me) return;
    // If user has unsaved edits, do NOT overwrite their pending changes.
    // The form will re-sync from `me` after they click Save (which clears the dirty flag).
    if (profileFormDirty) return;
    setProfileFullName(me.full_name || "");
    setProfileEmail(me.email || "");
    setProfilePhone(me.provider_profile?.phone || "");
    setFullName(me.full_name || "");
    setPhone(me.provider_profile?.phone || "");
    setAddress(me.provider_profile?.address_line1 || "");
    setCity(me.provider_profile?.city || "");
    setState(me.provider_profile?.state || "");
    setZip(me.provider_profile?.zip || "");
    setAvailDays(me.availability?.days || ["Mon", "Tue", "Wed", "Thu", "Fri"]);
    setAvailStart(me.availability?.start_time || "09:00");
    setAvailEnd(me.availability?.end_time || "18:00");
    setProfileAddress(
      [
        me.provider_profile?.address_line1,
        me.provider_profile?.city,
        me.provider_profile?.state,
        me.provider_profile?.zip,
      ]
        .filter(Boolean)
        .join(", "),
    );
  }, [me, profileFormDirty]);

  useEffect(() => {
    if (!bookings.length) return;
    const uniqueCustomers = new Set<string>();
    bookings.forEach((b) => {
      const cid =
        typeof b.customer_id === "object" ? b.customer_id?._id : b.customer_id;
      if (cid && typeof cid === "string") uniqueCustomers.add(cid);
    });
    uniqueCustomers.forEach((cid) => void loadCustomerHistoryFor(cid));
  }, [bookings]);

  useEffect(() => {
    if (!chatSocketConnected) return;
    console.log("[urgent] listener attached, socket connected");
    const handleBroadcast = (data: any) => {
      console.log("[urgent] 🚨 broadcast received:", data);
      if (!data?.booking) {
        console.warn("[urgent] no booking in payload");
        return;
      }
      setUrgentBooking(data.booking);
      try {
        const audio = new Audio(
          "data:audio/wav;base64,UklGRpgFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YXQFAAA=",
        );
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e: any) {
        alert(e?.message || "Failed to respond to travel fee");
      }
    };
    const handleTaken = () => {
      console.log("[urgent] taken — closing popup");
      setUrgentBooking(null);
    };
    chatSocket.on("urgent:broadcast", handleBroadcast);
    chatSocket.on("urgent:taken", handleTaken);
    return () => {
      chatSocket.off("urgent:broadcast", handleBroadcast);
      chatSocket.off("urgent:taken", handleTaken);
    };
  }, [chatSocketConnected, chatSocket]);

  async function acceptUrgent() {
    if (!urgentBooking?._id) return;
    setUrgentAccepting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/bookings/${urgentBooking._id}/urgent-accept`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Already taken!");
        setUrgentBooking(null);
        return;
      }
      setUrgentBooking(null);
      await loadProviderBookings();
      alert("🎉 Urgent booking accepted!");
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setUrgentAccepting(false);
    }
  }

  async function passUrgent() {
    if (!urgentBooking?._id) return;
    try {
      await fetch(`${API_BASE}/api/bookings/${urgentBooking._id}/urgent-pass`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setUrgentBooking(null);
    }
  }

  async function handleGenerateBio() {
    setAiLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:5001/api/ai/provider/bio", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: "", tone: "professional" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to generate");
      setBio(data.bio);
    } catch (e: any) {
      setError(e?.message || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    if (!requestsData.length) return;
    const uniqueCustomers = new Set<string>();
    requestsData.forEach((b) => {
      const cid =
        typeof b.customer_id === "object" ? b.customer_id?._id : b.customer_id;
      if (cid && typeof cid === "string") uniqueCustomers.add(cid);
    });
    uniqueCustomers.forEach((cid) => void loadCustomerHistoryFor(cid));
  }, [requestsData]);

  async function saveProfile() {
    console.log("[saveProfile] availDays right before send:", availDays);
    console.log("[saveProfile] dirty flag:", profileFormDirty);
    setProfileSaving(true);
    try {
      const res = await apiFetch<{ user: any }>("/api/provider/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName || me?.full_name,
          provider_profile: {
            phone,
            address_line1: address,
            city,
            state,
            zip,
            bio,
            is_available: me?.provider_profile?.is_available,
            availability: {
              days: availDays,
              start_time: availStart,
              end_time: availEnd,
            },
          },
        }),
      });
      console.log(
        "[saveProfile] full server response:",
        JSON.stringify(res, null, 2),
      );
      console.log(
        "[saveProfile] server returned days:",
        res?.user?.availability?.days,
      );
      // Allow the [me] effect to re-sync from the freshly-saved server data
      setProfileFormDirty(false);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  }

  async function acceptReschedule(id: string) {
    setError("");
    try {
      await apiFetch(`/api/bookings/${id}/reschedule/approve`, {
        method: "PATCH",
      });
      await loadProviderBookings();
      await loadRequestsSection(requestsPage, requestsSearch);
    } catch (e: any) {
      setError(e?.message || "Failed to approve reschedule");
    }
  }

  async function rejectReschedule(id: string) {
    setError("");
    try {
      await apiFetch(`/api/bookings/${id}/reschedule/reject`, {
        method: "PATCH",
      });
      await loadProviderBookings();
      await loadRequestsSection(requestsPage, requestsSearch);
    } catch (e: any) {
      setError(e?.message || "Failed to reject reschedule");
    }
  }

  async function toggleAvailability() {
    try {
      const newStatus = !me?.provider_profile?.is_available;
      await apiFetch("/api/provider/me", {
        method: "PATCH",
        body: JSON.stringify({
          provider_profile: {
            is_available: newStatus,
          },
        }),
      });
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Failed to update availability");
    }
  }

  async function toggleLiveGps() {
    setLiveGpsError("");
    const isCurrentlyLive = (me?.provider_profile as any)?.is_live_now;

    setLiveGpsLoading(true);
    try {
      if (isCurrentlyLive) {
        // Turn OFF
        await apiFetch("/api/provider/live", {
          method: "POST",
          body: JSON.stringify({ is_live: false }),
        });
        await loadAll();
      } else {
        // Turn ON — need GPS first
        if (!navigator.geolocation) {
          setLiveGpsError("GPS not supported in this browser");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              await apiFetch("/api/provider/live", {
                method: "POST",
                body: JSON.stringify({
                  is_live: true,
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                }),
              });
              await loadAll();
            } catch (e: any) {
              setLiveGpsError(e?.message || "Failed");
            } finally {
              setLiveGpsLoading(false);
            }
          },
          (err) => {
            setLiveGpsError("GPS denied: " + err.message);
            setLiveGpsLoading(false);
          },
          { timeout: 10000, enableHighAccuracy: true },
        );
        return; // async path — early exit
      }
    } catch (e: any) {
      setLiveGpsError(e?.message || "Failed");
    } finally {
      setLiveGpsLoading(false);
    }
  }

  async function handleCreateService(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!serviceName.trim() || !categoryId || price === "") {
      setError("Please fill Service Name, Category, and Price.");
      return;
    }

    if (catLimits) {
      const numPrice = Number(price);
      if (numPrice < catLimits.min_price) {
        setError(`Minimum price for this category is $${catLimits.min_price}`);
        return;
      }
      if (numPrice > catLimits.max_price) {
        setError(`Maximum price for this category is $${catLimits.max_price}`);
        return;
      }
      if (!catLimits.allowed_pricing_types.includes(pricingType)) {
        setError(
          `This category only allows: ${catLimits.allowed_pricing_types.join(", ")} pricing`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      await apiFetch("/api/services", {
        method: "POST",
        body: JSON.stringify({
          service_name: serviceName.trim(),
          description: description.trim(),
          price: Number(price),
          category_id: categoryId,
          pricing_type: pricingType,
          seasonal_months: seasonalMonths,
        }),
      });

      setServiceName("");
      setDescription("");
      setPrice("");
      setCategoryId("");
      setPricingType("fixed");
      setCatLimits(null);
      setSeasonalMonths([]);

      await loadMyServices();
      setActiveSection("services");
    } catch (e2: any) {
      setError(e2?.message || "Failed to create service");
    } finally {
      setSaving(false);
    }
  }

  async function updateBookingStatus(
    id: string,
    status: "confirmed" | "rejected",
  ) {
    setError("");
    try {
      await apiFetch(`/api/bookings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadProviderBookings();
      await loadRequestsSection(requestsPage, requestsSearch);
    } catch (e: any) {
      setError(e?.message || "Failed to update booking");
    }
  }

  async function submitTravelFee() {
    if (!travelFeeBookingId) return;
    const amt = Number(travelFeeAmount);
    if (!amt || amt <= 0 || amt > 5000) {
      setTravelFeeError("Enter a valid amount between $1 and $5000");
      return;
    }
    setTravelFeeSaving(true);
    setTravelFeeError("");
    try {
      await apiFetch(`/api/bookings/${travelFeeBookingId}/travel-fee`, {
        method: "POST",
        body: JSON.stringify({
          amount: amt,
          note: travelFeeNote.trim(),
        }),
      });
      setTravelFeeBookingId(null);
      setTravelFeeAmount("");
      setTravelFeeNote("");
      await loadProviderBookings();
      await loadRequestsSection(requestsPage, requestsSearch);
    } catch (e: any) {
      setTravelFeeError(e?.message || "Failed to request travel fee");
    } finally {
      setTravelFeeSaving(false);
    }
  }

  function openEditServiceModal(s: Service) {
    setEditError("");
    setEditServiceId(s._id);
    setEditName(s.service_name || "");
    setEditDesc(s.description || "");
    setEditPrice(String(s.price ?? ""));
    setEditCategoryId(
      typeof s.category_id === "object" && s.category_id
        ? s.category_id._id
        : "",
    );
    setEditOpen(true);
  }

  function closeEditServiceModal() {
    setEditOpen(false);
    setEditSaving(false);
    setEditError("");
    setEditServiceId("");
    setEditName("");
    setEditDesc("");
    setEditPrice("");
    setEditCategoryId("");
  }

  async function saveEditedService() {
    setEditError("");
    if (!editServiceId) return;
    if (!editName.trim() || !editCategoryId || editPrice === "") {
      setEditError("Service Name, Category, and Price are required.");
      return;
    }

    setEditSaving(true);
    try {
      await apiFetch(`/api/services/my/${editServiceId}`, {
        method: "PATCH",
        body: JSON.stringify({
          service_name: editName.trim(),
          description: editDesc.trim(),
          price: Number(editPrice),
          category_id: editCategoryId,
        }),
      });
      await loadMyServices();
      closeEditServiceModal();
    } catch (e: any) {
      setEditError(e?.message || "Failed to update service");
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleService(id: string) {
    setError("");
    try {
      await apiFetch(`/api/services/my/${id}/toggle`, { method: "PATCH" });
      await loadMyServices();
    } catch (e: any) {
      setError(e?.message || "Failed to toggle service");
    }
  }

  async function deleteService(id: string) {
    if (!confirm("Delete this service?")) return;
    setError("");
    try {
      await apiFetch(`/api/services/my/${id}`, { method: "DELETE" });
      await loadMyServices();
    } catch (e: any) {
      setError(e?.message || "Failed to delete service");
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5F7FB", padding: 24 }}>
        <div
          style={{
            height: 18,
            width: 240,
            background: "#e5e7eb",
            borderRadius: 12,
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 20,
            marginTop: 20,
          }}
        >
          {[1, 2, 3, 4].map((k) => (
            <div
              key={k}
              style={{
                height: 140,
                background: "#f3f4f6",
                borderRadius: 24,
                border: "1px solid #E5E7EB",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (needsProfile) {
    return (
      <ProviderOnboarding
        me={me}
        onSaved={async () => {
          await loadAll();
        }}
      />
    );
  }

  const recentRequests = bookings.slice(0, 3);

  const initials = (me?.full_name || "P")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const providerName = me?.full_name || "Provider";

  const providerNameFontSize =
    providerName.length > 24 ? 15 : providerName.length > 18 ? 17 : 20;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FB",
        overscrollBehavior: "none",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          position: "fixed",
          top: 64,
          left: 0,
          zIndex: 30,
          height: "calc(100vh - 64px)",
          width: 230,
          borderRight: "1px solid #E5E7EB",
          background: "white",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflowY: "auto",
        }}
      >
        <div>
          <div
            style={{
              padding: "22px 20px",
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: "#3156D3",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 900,
                }}
              >
                F
              </div>
              <div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#111827",
                  }}
                >
                  Fixora
                </div>
                <div style={{ fontSize: 13, color: "#6B7280" }}>
                  Provider Portal
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              margin: 16,
              borderRadius: 24,
              border: "1px solid #E5E7EB",
              background: "#F7F8FC",
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: "#3156D3",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>

              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    color: "#111827",
                    lineHeight: 1.15,
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    fontSize: providerNameFontSize,
                    maxWidth: "100%",
                  }}
                >
                  {providerName}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: "#6B7280",
                    lineHeight: 1.4,
                    wordBreak: "break-word",
                  }}
                >
                  Service Professional
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "0 16px 16px 16px", display: "grid", gap: 8 }}>
            <SidebarButton
              active={activeSection === "dashboard"}
              label="Dashboard"
              onClick={() => setActiveSection("dashboard")}
            />
            <SidebarButton
              active={activeSection === "requests"}
              label="Job Requests"
              onClick={() => {
                setActiveSection("requests");
                setRequestsPage(1);
                setRequestsSearch("");
                void loadRequestsSection(1, "");
              }}
            />
            <SidebarButton
              active={activeSection === "earnings"}
              label="Earnings"
              onClick={() => setActiveSection("earnings")}
            />
            <SidebarButton
              active={activeSection === "profile"}
              label="Profile"
              onClick={() => {
                setActiveSection("profile");
                setEarningsPage(1);
                setEarningsSearch("");
                void loadEarningsSection(1, "");
              }}
            />
            <SidebarButton
              active={activeSection === "services"}
              label="My Services"
              onClick={() => {
                setActiveSection("services");
                setServicesPage(1);
                setServicesSearch("");
                void loadMyServices(1, "");
              }}
            />
            <SidebarButton
              active={activeSection === "add"}
              label="Add Service"
              onClick={() => setActiveSection("add")}
            />
            <SidebarButton
              active={activeSection === "issues"}
              label="⚠️ Issues"
              badge={openIssuesCount}
              onClick={() => {
                setActiveSection("issues");
                setIssuesPage(1);
                void loadIssues();
                void loadIssuesPaginated(1, issueTab);
              }}
            />
            {openIssuesCount > 0 && activeSection !== "issues" && (
              <div
                style={{
                  marginTop: -8,
                  marginLeft: 16,
                  marginBottom: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#DC2626",
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                🔴 {openIssuesCount} open issue
                {openIssuesCount > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* <div style={{ padding: 16 }}>
            <button
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                textAlign: "left",
                borderRadius: 18,
                padding: "14px 16px",
                fontWeight: 800,
                fontSize: 16,
                color: "#6B7280",
                cursor: "pointer",
              }}
            >
              Settings
            </button>
          </div> */}
      </aside>

      {/* Main content */}
      <main style={{ minWidth: 0, padding: 24, marginLeft: 230 }}>
        {/* Error */}
        {error ? (
          <div
            style={{
              marginBottom: 18,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              padding: 14,
              borderRadius: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        {/* Dashboard */}
        {activeSection === "dashboard" ? (
          <>
            <div style={{ marginBottom: 18 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 34,
                  lineHeight: 1.1,
                  fontWeight: 900,
                  color: "#111827",
                }}
              >
                Dashboard
              </h1>
              <div style={{ marginTop: 8, fontSize: 15, color: "#6B7280" }}>
                Overview of your activity and performance
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0,1fr))",
                gap: 20,
              }}
            >
              <StatCard
                title="Today's Earnings"
                value={`$${todaysEarnings}`}
                accent="#7BC96F"
              />
              <StatCard
                title="This Week"
                value={`$${thisWeekEarnings}`}
                accent="#6C8CE8"
              />
              <StatCard
                title="This Month"
                value={`$${thisMonthEarnings}`}
                accent="#9B59E9"
              />
              <StatCard
                title="Total Earnings"
                value={`$${totalEarnings}`}
                accent="#E9A63B"
              />
              <StatCard
                title="My Rating"
                value={
                  me?.provider_profile?.rating_avg
                    ? `★ ${Number(me.provider_profile.rating_avg).toFixed(1)}`
                    : "★ New"
                }
                accent="#F59E0B"
                subtitle={`${me?.provider_profile?.rating_count || 0} reviews`}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
                marginTop: 20,
              }}
            >
              <div
                style={{
                  minHeight: 330,
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: 24,
                  padding: 20,
                  boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#111827",
                    marginBottom: 18,
                  }}
                >
                  Earnings Trend
                </div>

                <div
                  style={{
                    height: 240,
                    borderRadius: 18,
                    background:
                      "linear-gradient(180deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.01) 100%)",
                    border: "1px dashed #D1D5DB",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: `${40 + i * 40}px`,
                        borderTop: "1px dashed #E5E7EB",
                      }}
                    />
                  ))}

                  <svg
                    viewBox="0 0 600 240"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <defs>
                      <linearGradient id="earnFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(59,130,246,0.26)" />
                        <stop offset="100%" stopColor="rgba(59,130,246,0.03)" />
                      </linearGradient>
                    </defs>

                    <path
                      d={buildAreaPath(monthlySeries, 600, 180, 30)}
                      fill="url(#earnFill)"
                    />

                    <path
                      d={buildLinePath(monthlySeries, 600, 180, 30)}
                      fill="none"
                      stroke="#3F62E6"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  <div
                    style={{
                      position: "absolute",
                      left: 24,
                      right: 24,
                      bottom: 14,
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#6B7280",
                      fontSize: 14,
                    }}
                  >
                    {monthLabels.map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div
                style={{
                  minHeight: 330,
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: 24,
                  padding: 20,
                  boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#111827",
                    marginBottom: 18,
                  }}
                >
                  Weekly Activity
                </div>

                <div
                  style={{
                    height: 240,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "20px 8px 8px 8px",
                  }}
                >
                  {weeklySeries.map((v, i) => {
                    const days = [
                      "Mon",
                      "Tue",
                      "Wed",
                      "Thu",
                      "Fri",
                      "Sat",
                      "Sun",
                    ];
                    const max = Math.max(...weeklySeries, 8);
                    const h = Math.max(52, (v / max) * 160);

                    return (
                      <div
                        key={days[i]}
                        style={{
                          flex: 1,
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            height: h,
                            borderRadius: 14,
                            background:
                              "linear-gradient(180deg, #3F62E6 0%, #3A57D3 100%)",
                            marginBottom: 12,
                          }}
                        />
                        <div style={{ fontSize: 14, color: "#6B7280" }}>
                          {days[i]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: 24,
                padding: 20,
                boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: "#111827",
                    }}
                  >
                    Pending Job Requests
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "#6B7280",
                      marginTop: 4,
                    }}
                  >
                    Pending bookings can be accepted, rejected, completed, or
                    rescheduled.
                  </div>
                </div>

                <button
                  onClick={() => {
                    void loadProviderBookings();
                    void loadRequestsSection(requestsPage, requestsSearch);
                  }}
                  style={btnOutline}
                >
                  Refresh
                </button>
              </div>

              {recentRequests.length === 0 ? (
                <div style={{ color: "#6B7280" }}>No bookings yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  {recentRequests.map((b) => {
                    const customer =
                      typeof b.customer_id === "object" && b.customer_id
                        ? b.customer_id.full_name || b.customer_id.email
                        : "Customer";

                    const service =
                      typeof b.service_id === "object" && b.service_id
                        ? b.service_id.service_name
                        : "Service";

                    const totalAmt = (b as any).total_amount;
                    // const price = `$${(b as any).total_amount || (typeof b.service_id === "object" && b.service_id?.price) || 0}`;
                    const basePrice =
                      typeof b.service_id === "object" && b.service_id?.price
                        ? Number(b.service_id.price)
                        : 0;
                    const tfAccepted =
                      (b as any).travel_fee_status === "accepted"
                        ? Number((b as any).travel_fee_requested) || 0
                        : 0;
                    const price = `$${totalAmt || basePrice + tfAccepted || 0}`;

                    return (
                      <div
                        key={b._id}
                        style={{
                          border: "1px solid #E5E7EB",
                          borderRadius: 20,
                          padding: 18,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 16,
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ display: "flex", gap: 14 }}>
                          <div
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: "50%",
                              background: "#3156D3",
                              color: "white",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 900,
                              fontSize: 18,
                            }}
                          >
                            {(customer || "C")
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>

                          <div>
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 18,
                                color: "#111827",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              {customer}
                              {(() => {
                                const cid =
                                  typeof b.customer_id === "object"
                                    ? b.customer_id?._id
                                    : b.customer_id;
                                const hist = cid
                                  ? customerHistory[cid as string]
                                  : null;
                                if (!hist) return null;
                                if (hist.is_loyal_customer) {
                                  return (
                                    <span
                                      style={{
                                        padding: "3px 10px",
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background:
                                          "linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)",
                                        color: "white",
                                        boxShadow:
                                          "0 1px 3px rgba(245, 158, 11, 0.3)",
                                      }}
                                      title={`${hist.total_bookings} past bookings`}
                                    >
                                      🏆 LOYAL ({hist.total_bookings})
                                    </span>
                                  );
                                }
                                if (hist.is_repeat_customer) {
                                  return (
                                    <span
                                      style={{
                                        padding: "3px 10px",
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: "#DBEAFE",
                                        color: "#1E40AF",
                                      }}
                                      title={`${hist.total_bookings} past bookings`}
                                    >
                                      🔁 REPEAT ({hist.total_bookings})
                                    </span>
                                  );
                                }
                                if (hist.total_bookings === 0) {
                                  return (
                                    <span
                                      style={{
                                        padding: "3px 10px",
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: "#F0FDF4",
                                        color: "#166534",
                                      }}
                                    >
                                      🆕 NEW
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <div
                              style={{
                                color: "#6B7280",
                                marginTop: 4,
                                fontSize: 15,
                              }}
                            >
                              {service}
                            </div>
                            <div
                              style={{
                                marginTop: 10,
                                display: "flex",
                                gap: 14,
                                flexWrap: "wrap",
                                color: "#6B7280",
                                fontSize: 14,
                              }}
                            >
                              <span>{b.date || "—"}</span>
                              <span>{b.time || "—"}</span>
                              <span>{b.address || "—"}</span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 10,
                                marginTop: 16,
                                flexWrap: "wrap",
                              }}
                            >
                              {/* Chat button (always available except cancelled/rejected) */}
                              {b.status !== "cancelled" &&
                                b.status !== "rejected" && (
                                  <button
                                    onClick={() => openChat(b)}
                                    style={{
                                      position: "relative",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "10px 16px",
                                      borderRadius: 8,
                                      border: "1px solid #93C5FD",
                                      background: "#EFF6FF",
                                      color: "#1D4ED8",
                                      fontWeight: 600,
                                      fontSize: 14,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <MessageCircle size={14} />
                                    Message
                                    {unreadCounts[b._id] > 0 && (
                                      <span
                                        style={{
                                          position: "absolute",
                                          top: -6,
                                          right: -6,
                                          minWidth: 20,
                                          height: 20,
                                          padding: "0 6px",
                                          borderRadius: 999,
                                          background: "#EF4444",
                                          color: "white",
                                          fontSize: 11,
                                          fontWeight: 700,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                      >
                                        {unreadCounts[b._id]}
                                      </span>
                                    )}
                                  </button>
                                )}

                              {b.status === "pending" &&
                              (b as any).travel_fee_status === "pending" ? (
                                // 💰 Travel fee already requested — waiting on customer
                                <div
                                  style={{
                                    padding: "12px 16px",
                                    background:
                                      "linear-gradient(135deg, #FEF3C7 0%, #FED7AA 100%)",
                                    border: "1px solid #FCD34D",
                                    borderRadius: 8,
                                    color: "#92400E",
                                    fontSize: 14,
                                    fontWeight: 600,
                                  }}
                                >
                                  💰 Travel fee request sent: $
                                  {(b as any).travel_fee_requested}
                                  {(b as any).travel_fee_note && (
                                    <div
                                      style={{
                                        fontSize: 12,
                                        marginTop: 4,
                                        fontWeight: 400,
                                      }}
                                    >
                                      Reason: {(b as any).travel_fee_note}
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      fontSize: 12,
                                      marginTop: 4,
                                      fontWeight: 400,
                                    }}
                                  >
                                    ⏳ Waiting for customer response...
                                  </div>
                                </div>
                              ) : b.status === "pending" ? (
                                <>
                                  <button
                                    onClick={() =>
                                      updateBookingStatus(b._id, "confirmed")
                                    }
                                    style={{
                                      ...btnSuccessWide,
                                      minWidth: 180,
                                    }}
                                  >
                                    Accept Job
                                  </button>
                                  {/* 💰 Signal 13 — Show only if distance > 15 mi */}
                                  {(b as any).distance_miles != null &&
                                    (b as any).distance_miles >
                                      (me?.provider_profile?.max_travel_miles ||
                                        25) && (
                                      <button
                                        onClick={() => {
                                          setTravelFeeBookingId(b._id);
                                          setTravelFeeAmount("");
                                          setTravelFeeNote("");
                                          setTravelFeeError("");
                                        }}
                                        style={{
                                          background:
                                            "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
                                          color: "white",
                                          border: "none",
                                          borderRadius: 8,
                                          padding: "10px 16px",
                                          fontWeight: 700,
                                          fontSize: 14,
                                          minWidth: 180,
                                          cursor: "pointer",
                                          boxShadow:
                                            "0 2px 8px rgba(245, 158, 11, 0.3)",
                                        }}
                                      >
                                        💰 Accept w/ Travel Fee
                                      </button>
                                    )}
                                  <button
                                    onClick={() =>
                                      updateBookingStatus(b._id, "rejected")
                                    }
                                    style={{
                                      ...btnOutlineWide,
                                      minWidth: 180,
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : null}

                              {b.status === "confirmed" ? (
                                <>
                                  <button
                                    onClick={() => completeBooking(b._id)}
                                    style={{
                                      ...btnSuccessWide,
                                      minWidth: 180,
                                    }}
                                  >
                                    Complete Work
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRescheduleBookingId(b._id);
                                      setResDate("");
                                      setResTime("");
                                      setResReason("");
                                      setShowReschedule(true);
                                    }}
                                    style={{
                                      ...btnOutlineWide,
                                      minWidth: 180,
                                    }}
                                  >
                                    Reschedule
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: "right", minWidth: 90 }}>
                          <div
                            style={{
                              fontSize: 20,
                              fontWeight: 900,
                              color: "#16A34A",
                            }}
                          >
                            {price}
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <StatusPill status={b.status} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* Requests */}
        {activeSection === "requests" ? (
          <div
            style={{
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 24,
              padding: 20,
              boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 30, fontWeight: 900, color: "#111827" }}
                >
                  Job Requests
                </div>
                <div style={{ marginTop: 4, color: "#6B7280" }}>
                  Manage your provider bookings and requests
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Search bookings..."
                    value={requestsSearch}
                    onChange={(e) => {
                      setRequestsSearch(e.target.value);
                      setRequestsPage(1);
                    }}
                    style={{
                      padding: "10px 14px 10px 36px",
                      borderRadius: 12,
                      border: "1px solid #D1D5DB",
                      fontSize: 14,
                      outline: "none",
                      width: 220,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#9CA3AF",
                    }}
                  >
                    🔍
                  </span>
                </div>
                <button
                  onClick={() => {
                    void loadProviderBookings();
                    void loadRequestsSection(requestsPage, requestsSearch);
                  }}
                  style={btnOutline}
                >
                  Refresh
                </button>
              </div>
            </div>

            {bookingLoading ? (
              <div style={{ color: "#6B7280" }}>Loading...</div>
            ) : filteredBookings.length === 0 ? (
              <div style={{ color: "#6B7280" }}>
                {requestsSearch ? "No results found." : "No bookings yet."}
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 16 }}>
                  {requestsData.map((b) => {
                    const customer =
                      typeof b.customer_id === "object" && b.customer_id
                        ? b.customer_id.full_name || b.customer_id.email
                        : "—";
                    const service =
                      typeof b.service_id === "object" && b.service_id
                        ? b.service_id.service_name
                        : "—";
                    const totalAmt = (b as any).total_amount;
                    const basePrice =
                      typeof b.service_id === "object" && b.service_id?.price
                        ? Number(b.service_id.price)
                        : 0;
                    const tfAccepted =
                      (b as any).travel_fee_status === "accepted"
                        ? Number((b as any).travel_fee_requested) || 0
                        : 0;
                    const amount = `$${totalAmt || basePrice + tfAccepted || 0}`;

                    return (
                      <div
                        key={b._id}
                        style={{
                          border: "1px solid #E5E7EB",
                          borderRadius: 22,
                          padding: 18,
                          background: "#fff",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 16,
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ display: "flex", gap: 14, flex: 1 }}>
                            <div
                              style={{
                                width: 54,
                                height: 54,
                                borderRadius: "50%",
                                background: "#3156D3",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 900,
                                fontSize: 18,
                                flexShrink: 0,
                              }}
                            >
                              {(customer || "C")
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 10,
                                  alignItems: "flex-start",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize: 18,
                                      fontWeight: 900,
                                      color: "#111827",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    {customer}
                                    {(() => {
                                      const cid =
                                        typeof b.customer_id === "object"
                                          ? b.customer_id?._id
                                          : b.customer_id;
                                      const hist = cid
                                        ? customerHistory[cid as string]
                                        : null;
                                      if (!hist) return null;
                                      if (hist.is_loyal_customer) {
                                        return (
                                          <span
                                            style={{
                                              padding: "3px 10px",
                                              borderRadius: 999,
                                              fontSize: 11,
                                              fontWeight: 700,
                                              background:
                                                "linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)",
                                              color: "white",
                                              boxShadow:
                                                "0 1px 3px rgba(245, 158, 11, 0.3)",
                                            }}
                                            title={`${hist.total_bookings} past bookings`}
                                          >
                                            🏆 LOYAL ({hist.total_bookings})
                                          </span>
                                        );
                                      }
                                      if (hist.is_repeat_customer) {
                                        return (
                                          <span
                                            style={{
                                              padding: "3px 10px",
                                              borderRadius: 999,
                                              fontSize: 11,
                                              fontWeight: 700,
                                              background: "#DBEAFE",
                                              color: "#1E40AF",
                                            }}
                                            title={`${hist.total_bookings} past bookings`}
                                          >
                                            🔁 REPEAT ({hist.total_bookings})
                                          </span>
                                        );
                                      }
                                      if (hist.total_bookings === 0) {
                                        return (
                                          <span
                                            style={{
                                              padding: "3px 10px",
                                              borderRadius: 999,
                                              fontSize: 11,
                                              fontWeight: 700,
                                              background: "#F0FDF4",
                                              color: "#166534",
                                            }}
                                          >
                                            🆕 NEW
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    fontSize: 20,
                                    fontWeight: 900,
                                    color: "#16A34A",
                                  }}
                                >
                                  {amount}
                                </div>
                              </div>
                              <div
                                style={{
                                  marginTop: 10,
                                  display: "flex",
                                  gap: 16,
                                  flexWrap: "wrap",
                                  fontSize: 14,
                                  color: "#6B7280",
                                }}
                              >
                                <span>{b.date || "—"}</span>
                                <span>{b.time || "—"}</span>
                                <span>{b.address || "—"}</span>
                              </div>
                              <div style={{ marginTop: 12 }}>
                                <StatusPill status={b.status} />
                              </div>
                              {/* Action buttons row - only buttons go here */}
                              <div
                                style={{
                                  display: "flex",
                                  gap: 10,
                                  flexWrap: "wrap",
                                  marginTop: 16,
                                }}
                              >
                                {/* Chat button (always available except cancelled/rejected) */}
                                {b.status !== "cancelled" &&
                                  b.status !== "rejected" && (
                                    <button
                                      onClick={() => openChat(b)}
                                      style={{
                                        position: "relative",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "10px 16px",
                                        borderRadius: 8,
                                        border: "1px solid #93C5FD",
                                        background: "#EFF6FF",
                                        color: "#1D4ED8",
                                        fontWeight: 600,
                                        fontSize: 14,
                                        cursor: "pointer",
                                      }}
                                    >
                                      <MessageCircle size={14} />
                                      Message
                                      {unreadCounts[b._id] > 0 && (
                                        <span
                                          style={{
                                            position: "absolute",
                                            top: -6,
                                            right: -6,
                                            minWidth: 20,
                                            height: 20,
                                            padding: "0 6px",
                                            borderRadius: 999,
                                            background: "#EF4444",
                                            color: "white",
                                            fontSize: 11,
                                            fontWeight: 700,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                          }}
                                        >
                                          {unreadCounts[b._id]}
                                        </span>
                                      )}
                                    </button>
                                  )}

                                {b.status === "pending" &&
                                (b as any).travel_fee_status === "pending" ? (
                                  // 💰 Travel fee already requested — waiting on customer
                                  <div
                                    style={{
                                      padding: "12px 16px",
                                      background:
                                        "linear-gradient(135deg, #FEF3C7 0%, #FED7AA 100%)",
                                      border: "1px solid #FCD34D",
                                      borderRadius: 8,
                                      color: "#92400E",
                                      fontSize: 14,
                                      fontWeight: 600,
                                    }}
                                  >
                                    💰 Travel fee request sent: $
                                    {(b as any).travel_fee_requested}
                                    {(b as any).travel_fee_note && (
                                      <div
                                        style={{
                                          fontSize: 12,
                                          marginTop: 4,
                                          fontWeight: 400,
                                        }}
                                      >
                                        Reason: {(b as any).travel_fee_note}
                                      </div>
                                    )}
                                    <div
                                      style={{
                                        fontSize: 12,
                                        marginTop: 4,
                                        fontWeight: 400,
                                      }}
                                    >
                                      ⏳ Waiting for customer response...
                                    </div>
                                  </div>
                                ) : b.status === "pending" ? (
                                  <>
                                    <button
                                      onClick={() =>
                                        updateBookingStatus(b._id, "confirmed")
                                      }
                                      style={{
                                        ...btnSuccessWide,
                                        minWidth: 180,
                                      }}
                                    >
                                      Accept Job
                                    </button>
                                    {/* 💰 Signal 13 — Show only if distance > 15 mi */}
                                    {(b as any).distance_miles != null &&
                                      (b as any).distance_miles >
                                        (me?.provider_profile
                                          ?.max_travel_miles || 25) && (
                                        <button
                                          onClick={() => {
                                            setTravelFeeBookingId(b._id);
                                            setTravelFeeAmount("");
                                            setTravelFeeNote("");
                                            setTravelFeeError("");
                                          }}
                                          style={{
                                            background:
                                              "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
                                            color: "white",
                                            border: "none",
                                            borderRadius: 8,
                                            padding: "10px 16px",
                                            fontWeight: 700,
                                            fontSize: 14,
                                            minWidth: 180,
                                            cursor: "pointer",
                                            boxShadow:
                                              "0 2px 8px rgba(245, 158, 11, 0.3)",
                                          }}
                                        >
                                          💰 Accept w/ Travel Fee
                                        </button>
                                      )}
                                    <button
                                      onClick={() =>
                                        updateBookingStatus(b._id, "rejected")
                                      }
                                      style={{
                                        ...btnOutlineWide,
                                        minWidth: 180,
                                      }}
                                    >
                                      Reject
                                    </button>
                                  </>
                                ) : null}
                                {b.status === "confirmed" ? (
                                  <>
                                    <button
                                      onClick={() => completeBooking(b._id)}
                                      style={{
                                        ...btnSuccessWide,
                                        minWidth: 180,
                                      }}
                                    >
                                      Complete Work
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRescheduleBookingId(b._id);
                                        setResDate("");
                                        setResTime("");
                                        setResReason("");
                                        setShowReschedule(true);
                                      }}
                                      style={{
                                        ...btnOutlineWide,
                                        minWidth: 180,
                                      }}
                                    >
                                      Reschedule
                                    </button>
                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "8px 14px",
                                        borderRadius: 12,
                                        background:
                                          tracking &&
                                          trackingBookingId === b._id
                                            ? "#F0FDF4"
                                            : "#F9FAFB",
                                        border: `1px solid ${tracking && trackingBookingId === b._id ? "#BBF7D0" : "#E5E7EB"}`,
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color:
                                          tracking &&
                                          trackingBookingId === b._id
                                            ? "#16A34A"
                                            : "#6B7280",
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: "50%",
                                          background:
                                            tracking &&
                                            trackingBookingId === b._id
                                              ? "#16A34A"
                                              : "#D1D5DB",
                                        }}
                                      />
                                      {tracking && trackingBookingId === b._id
                                        ? "📍 Sharing location with customer"
                                        : "📍 Auto-sharing at 9 AM on booking day"}
                                    </div>
                                  </>
                                ) : null}
                                {b.status === "reschedule_requested" &&
                                b.reschedule?.requested_by === "customer" ? (
                                  <>
                                    <button
                                      onClick={() => acceptReschedule(b._id)}
                                      style={btnPrimarySmall}
                                    >
                                      Accept Reschedule
                                    </button>
                                    <button
                                      onClick={() => rejectReschedule(b._id)}
                                      style={btnOutlineSmall}
                                    >
                                      Reject Reschedule
                                    </button>
                                  </>
                                ) : null}
                                {b.status === "reschedule_requested" &&
                                b.reschedule?.requested_by !== "customer" ? (
                                  <span
                                    style={{
                                      fontSize: 13,
                                      color: "#6D28D9",
                                      fontWeight: 700,
                                      padding: "8px 14px",
                                      background: "#F5F3FF",
                                      border: "1px solid #DDD6FE",
                                      borderRadius: 12,
                                    }}
                                  >
                                    ⏳ Waiting for customer approval
                                  </span>
                                ) : null}
                              </div>

                              {/* Reschedule rejection notice - DISPLAYED ON ITS OWN ROW, not inside action buttons */}
                              {b.reschedule?.decision === "rejected" ? (
                                <div
                                  style={{
                                    marginTop: 12,
                                    background: "#FEF2F2",
                                    border: "1px solid #FECACA",
                                    color: "#991B1B",
                                    padding: "12px 14px",
                                    borderRadius: 12,
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                  }}
                                >
                                  <div
                                    style={{ fontWeight: 900, marginBottom: 4 }}
                                  >
                                    ⚠️ Customer rejected reschedule
                                  </div>
                                  {b.reschedule?.rejection_reason ? (
                                    <div style={{ marginTop: 4 }}>
                                      <b>Reason:</b>{" "}
                                      {b.reschedule.rejection_reason}
                                    </div>
                                  ) : null}
                                  {b.reschedule?.rejection_message ? (
                                    <div style={{ marginTop: 4 }}>
                                      <b>Note:</b>{" "}
                                      {b.reschedule.rejection_message}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {/* 💰 Signal 13 — Travel Fee Modal */}
                        {travelFeeBookingId && (
                          <div
                            style={{
                              position: "fixed",
                              inset: 0,
                              background: "rgba(0,0,0,0.5)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 9999,
                            }}
                            onClick={() =>
                              !travelFeeSaving && setTravelFeeBookingId(null)
                            }
                          >
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                background: "white",
                                borderRadius: 16,
                                padding: 24,
                                width: "100%",
                                maxWidth: 480,
                                boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                              }}
                            >
                              <h3
                                style={{
                                  fontSize: 20,
                                  fontWeight: 800,
                                  marginBottom: 8,
                                }}
                              >
                                💰 Request Travel Fee
                              </h3>
                              <p
                                style={{
                                  fontSize: 14,
                                  color: "#6B7280",
                                  marginBottom: 16,
                                }}
                              >
                                Customer will be notified. They can accept
                                (booking confirmed) or reject (booking
                                cancelled).
                              </p>

                              <label
                                style={{
                                  display: "block",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  marginBottom: 6,
                                }}
                              >
                                Travel fee amount ($)
                              </label>
                              <input
                                type="number"
                                value={travelFeeAmount}
                                onChange={(e) =>
                                  setTravelFeeAmount(e.target.value)
                                }
                                placeholder="e.g. 40"
                                min={1}
                                max={5000}
                                autoFocus
                                disabled={travelFeeSaving}
                                style={{
                                  width: "100%",
                                  padding: "10px 14px",
                                  border: "1px solid #D1D5DB",
                                  borderRadius: 8,
                                  fontSize: 16,
                                  marginBottom: 14,
                                }}
                              />

                              <label
                                style={{
                                  display: "block",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  marginBottom: 6,
                                }}
                              >
                                Reason (optional)
                              </label>
                              <input
                                type="text"
                                value={travelFeeNote}
                                onChange={(e) =>
                                  setTravelFeeNote(e.target.value)
                                }
                                placeholder="e.g. Extra distance + bridge toll"
                                maxLength={200}
                                disabled={travelFeeSaving}
                                style={{
                                  width: "100%",
                                  padding: "10px 14px",
                                  border: "1px solid #D1D5DB",
                                  borderRadius: 8,
                                  fontSize: 14,
                                  marginBottom: 14,
                                }}
                              />

                              {travelFeeError && (
                                <div
                                  style={{
                                    color: "#DC2626",
                                    fontSize: 13,
                                    marginBottom: 12,
                                  }}
                                >
                                  {travelFeeError}
                                </div>
                              )}

                              <div
                                style={{
                                  display: "flex",
                                  gap: 10,
                                  justifyContent: "flex-end",
                                }}
                              >
                                <button
                                  onClick={() => setTravelFeeBookingId(null)}
                                  disabled={travelFeeSaving}
                                  style={{
                                    padding: "10px 20px",
                                    background: "white",
                                    border: "1px solid #D1D5DB",
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={submitTravelFee}
                                  disabled={travelFeeSaving || !travelFeeAmount}
                                  style={{
                                    padding: "10px 20px",
                                    background: travelFeeSaving
                                      ? "#A78BFA"
                                      : "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {travelFeeSaving
                                    ? "Sending..."
                                    : "Send to Customer"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Pagination
                  page={requestsPage}
                  totalPages={Math.ceil(filteredBookings.length / PAGE_SIZE)}
                  onPageChange={setRequestsPage}
                />
              </>
            )}
          </div>
        ) : null}

        {/* Earnings */}
        {activeSection === "earnings" ? (
          <div style={{ display: "grid", gap: 20 }}>
            <div
              style={{
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: 24,
                padding: 20,
                boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  color: "#111827",
                }}
              >
                Earnings
              </div>
              <div style={{ marginTop: 4, color: "#6B7280" }}>
                Track your earnings and payments
              </div>

              <div style={{ marginTop: 18 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#111827",
                    marginBottom: 18,
                  }}
                >
                  Monthly Earnings Overview
                </div>

                <div
                  style={{
                    height: 320,
                    borderRadius: 20,
                    border: "1px dashed #D1D5DB",
                    background:
                      "linear-gradient(180deg, rgba(59,130,246,0.05) 0%, rgba(59,130,246,0.01) 100%)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: `${60 + i * 52}px`,
                        borderTop: "1px dashed #E5E7EB",
                      }}
                    />
                  ))}

                  <svg
                    viewBox="0 0 800 320"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <path
                      d={buildLinePath(monthlySeries, 800, 220, 40)}
                      fill="none"
                      stroke="#3F62E6"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  <div
                    style={{
                      position: "absolute",
                      left: 36,
                      right: 36,
                      bottom: 18,
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 14,
                      color: "#6B7280",
                    }}
                  >
                    {monthLabels.map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: 24,
                padding: 20,
                boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: "#111827",
                  marginBottom: 14,
                }}
              >
                Recent Earnings
              </div>

              {paginatedEarnings.length === 0 ? (
                <div style={{ color: "#6B7280" }}>No completed jobs yet.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        background: "#F9FAFB",
                        color: "#6B7280",
                        fontSize: 13,
                      }}
                    >
                      <th style={th}>Date</th>
                      <th style={th}>Customer</th>
                      <th style={th}>Service</th>
                      <th style={th}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earningsData.map((b) => {
                      const customer =
                        typeof b.customer_id === "object" && b.customer_id
                          ? b.customer_id.full_name || b.customer_id.email
                          : "—";
                      const service =
                        typeof b.service_id === "object" && b.service_id
                          ? b.service_id.service_name
                          : "—";
                      const totalAmt = (b as any).total_amount;
                      const basePrice =
                        typeof b.service_id === "object" && b.service_id?.price
                          ? Number(b.service_id.price)
                          : 0;
                      const tfAccepted =
                        (b as any).travel_fee_status === "accepted"
                          ? Number((b as any).travel_fee_requested) || 0
                          : 0;
                      const amount = `$${totalAmt || basePrice + tfAccepted || 0}`;

                      return (
                        <tr
                          key={b._id}
                          style={{ borderTop: "1px solid #E5E7EB" }}
                        >
                          <td style={td}>{b.date || "—"}</td>
                          <td style={td}>{customer}</td>
                          <td style={td}>{service}</td>
                          <td
                            style={{
                              ...td,
                              color: "#16A34A",
                              fontWeight: 900,
                            }}
                          >
                            {amount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <Pagination
                    page={earningsPage}
                    totalPages={earningsTotalPages}
                    onPageChange={setEarningsPage}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: "#111827",
                      }}
                    >
                      Recent Earnings
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        placeholder="Search earnings..."
                        value={earningsSearch}
                        onChange={(e) => setEarningsSearch(e.target.value)}
                        style={{
                          padding: "8px 12px 8px 32px",
                          borderRadius: 10,
                          border: "1px solid #D1D5DB",
                          fontSize: 13,
                          outline: "none",
                          width: 200,
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          left: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#9CA3AF",
                          fontSize: 12,
                        }}
                      >
                        🔍
                      </span>
                    </div>
                  </div>
                </table>
              )}
            </div>
          </div>
        ) : null}

        {/* Profile */}
        {activeSection === "profile" ? (
          <div
            style={{
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
            }}
          >
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div
                  style={{
                    width: 116,
                    height: 116,
                    borderRadius: "50%",
                    background: "#3156D3",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 42,
                    margin: "0 auto",
                  }}
                >
                  {initials}
                </div>
                <div
                  style={{
                    marginTop: 18,
                    fontSize: 36,
                    fontWeight: 900,
                    color: "#111827",
                  }}
                >
                  {providerName}
                </div>
                <div style={{ marginTop: 8, color: "#6B7280", fontSize: 18 }}>
                  {me?.email || "—"}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#FFF7ED",
                    color: "#B45309",
                    padding: "8px 14px",
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  ★{" "}
                  {me?.provider_profile?.rating_avg
                    ? Number(me.provider_profile.rating_avg).toFixed(1)
                    : "New"}
                  <span style={{ fontWeight: 400, color: "#92400E" }}>
                    ({me?.provider_profile?.rating_count || 0} reviews)
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gap: 18 }}>
                <div>
                  <label style={label}>Full Name</label>
                  <input
                    value={fullName}
                    onChange={(e) => {
                      setProfileFormDirty(true);
                      setFullName(e.target.value);
                    }}
                    style={input}
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label style={label}>Email</label>
                  <input
                    value={profileEmail}
                    onChange={(e) => {
                      setProfileFormDirty(true);
                      setProfileEmail(e.target.value);
                    }}
                    style={input}
                    placeholder="Enter email"
                    type="email"
                  />
                </div>

                <div>
                  <label style={label}>Phone</label>
                  <input
                    value={phone}
                    onChange={(e) => {
                      setProfileFormDirty(true);
                      setPhone(e.target.value);
                    }}
                    style={input}
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label style={label}>Address</label>
                  <input
                    ref={profileAddressInputRef}
                    value={address}
                    onChange={(e) => {
                      setProfileFormDirty(true);
                      setAddress(e.target.value);
                    }}
                    style={input}
                    placeholder="Start typing an address..."
                  />
                </div>

                <div>
                  <label style={label}>Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => {
                      setProfileFormDirty(true);
                      setBio(e.target.value);
                    }}
                    placeholder="Tell customers about your experience, specialties, availability..."
                    rows={4}
                    style={{
                      ...input,
                      resize: "vertical",
                      fontFamily: "inherit",
                      lineHeight: 1.5,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleGenerateBio()}
                    disabled={aiLoading}
                    style={{
                      marginTop: 10,
                      padding: "10px 18px",
                      background: aiLoading
                        ? "#A5B4FC"
                        : "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: aiLoading ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                    }}
                  >
                    {aiLoading ? "✨ Generating..." : "✨ Generate Bio with AI"}
                  </button>
                </div>

                {/* ── Availability Settings ── */}
                <div
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 16,
                    padding: 20,
                    background: "#F9FAFB",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 15,
                      color: "#111827",
                      marginBottom: 16,
                    }}
                  >
                    📅 Availability Schedule
                  </div>

                  {/* Working Days */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={label}>Working Days</label>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 8,
                      }}
                    >
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                        (day) => {
                          const selected = availDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                console.log("[toggle] clicked day:", day);
                                setProfileFormDirty(true);
                                setAvailDays((prev) => {
                                  const next = prev.includes(day)
                                    ? prev.filter((d) => d !== day)
                                    : [...prev, day];
                                  console.log(
                                    "[toggle] availDays:",
                                    prev,
                                    "->",
                                    next,
                                  );
                                  return next;
                                });
                              }}
                              style={{
                                padding: "8px 14px",
                                borderRadius: 10,
                                border: `2px solid ${selected ? "#2563EB" : "#D1D5DB"}`,
                                background: selected ? "#EFF6FF" : "white",
                                color: selected ? "#2563EB" : "#6B7280",
                                fontWeight: 700,
                                cursor: "pointer",
                                fontSize: 13,
                              }}
                            >
                              {day}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>

                  {/* Working Hours */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 14,
                    }}
                  >
                    <div>
                      <label style={label}>Start Time</label>
                      <input
                        type="time"
                        value={availStart}
                        onChange={(e) => setAvailStart(e.target.value)}
                        style={input}
                      />
                    </div>
                    <div>
                      <label style={label}>End Time</label>
                      <input
                        type="time"
                        value={availEnd}
                        onChange={(e) => setAvailEnd(e.target.value)}
                        style={input}
                      />
                    </div>
                  </div>
                </div>

                {profileMsg ? (
                  <div
                    style={{
                      background: "#ECFDF3",
                      border: "1px solid #BBF7D0",
                      color: "#166534",
                      padding: 12,
                      borderRadius: 12,
                      fontWeight: 700,
                    }}
                  >
                    {profileMsg}
                  </div>
                ) : null}

                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  style={{
                    ...btnPrimaryBig,
                    opacity: profileSaving ? 0.7 : 1,
                    cursor: profileSaving ? "not-allowed" : "pointer",
                  }}
                >
                  {profileSaving ? "Saving..." : "Save Changes"}
                </button>
                {/* Availability Toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    border: `1px solid ${me?.provider_profile?.is_available !== false ? "#BBF7D0" : "#FECACA"}`,
                    borderRadius: 16,
                    background:
                      me?.provider_profile?.is_available !== false
                        ? "#F0FDF4"
                        : "#FFF5F5",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 15,
                        color: "#111827",
                      }}
                    >
                      {me?.provider_profile?.is_available !== false
                        ? "🟢 Available for Bookings"
                        : "🔴 Not Available"}
                    </div>
                    <div
                      style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}
                    >
                      {me?.provider_profile?.is_available !== false
                        ? "Customers can see and book your services"
                        : "Your services are hidden from customers"}
                    </div>
                  </div>
                  <button
                    onClick={toggleAvailability}
                    style={{
                      border: "none",
                      background:
                        me?.provider_profile?.is_available !== false
                          ? "#DC2626"
                          : "#16A34A",
                      color: "white",
                      borderRadius: 12,
                      padding: "10px 20px",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    {me?.provider_profile?.is_available !== false
                      ? "Go Unavailable"
                      : "Go Available"}
                  </button>
                </div>
                {/* 🛰️ Signal 4 — Live GPS Broadcast Toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    border: `1px solid ${(me?.provider_profile as any)?.is_live_now ? "#86EFAC" : "#E5E7EB"}`,
                    borderRadius: 16,
                    background: (me?.provider_profile as any)?.is_live_now
                      ? "#F0FDF4"
                      : "#F9FAFB",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 15,
                        color: "#111827",
                      }}
                    >
                      {(me?.provider_profile as any)?.is_live_now
                        ? "🟢 Live GPS Broadcast Active"
                        : "🔴 Live GPS Broadcast Off"}
                    </div>
                    <div
                      style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}
                    >
                      {(me?.provider_profile as any)?.is_live_now
                        ? "Customers searching nearby see your current location"
                        : "Turn on to appear in 'instant' searches near your live location"}
                    </div>
                    {liveGpsError && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#DC2626",
                          marginTop: 6,
                        }}
                      >
                        {liveGpsError}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={toggleLiveGps}
                    disabled={liveGpsLoading}
                    style={{
                      border: "none",
                      background: (me?.provider_profile as any)?.is_live_now
                        ? "#DC2626"
                        : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                      color: "white",
                      borderRadius: 12,
                      padding: "10px 20px",
                      fontWeight: 800,
                      cursor: liveGpsLoading ? "wait" : "pointer",
                      fontSize: 14,
                      opacity: liveGpsLoading ? 0.7 : 1,
                    }}
                  >
                    {liveGpsLoading
                      ? "..."
                      : (me?.provider_profile as any)?.is_live_now
                        ? "Stop Broadcasting"
                        : "🛰️ Go Live"}
                  </button>
                </div>
                <div
                  style={{
                    marginTop: 24,
                    borderTop: "1px solid #FEE2E2",
                    paddingTop: 24,
                  }}
                >
                  <div
                    style={{
                      background: "#FFF5F5",
                      border: "1px solid #FECACA",
                      borderRadius: 16,
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: "#B91C1C",
                      }}
                    >
                      Danger Zone
                    </div>
                    <div
                      style={{ fontSize: 13, color: "#DC2626", marginTop: 6 }}
                    >
                      Deactivating your account will log you out. Your services
                      will be hidden from customers until reactivated by admin.
                    </div>
                    <button
                      onClick={() => setDeactivateOpen(true)}
                      style={{
                        marginTop: 14,
                        border: "1px solid #FECACA",
                        background: "white",
                        color: "#DC2626",
                        borderRadius: 12,
                        padding: "10px 20px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Deactivate Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Services */}
        {activeSection === "services" ? (
          <div
            style={{
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
            }}
          >
            <div
              style={{
                padding: 20,
                borderBottom: "1px solid #E5E7EB",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{ fontSize: 30, fontWeight: 900, color: "#111827" }}
                >
                  My Services
                </div>
                <div style={{ marginTop: 4, color: "#6B7280" }}>
                  Edit, activate/deactivate, or delete services.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Search services..."
                    value={servicesSearch}
                    onChange={(e) => setServicesSearch(e.target.value)}
                    style={{
                      padding: "10px 14px 10px 36px",
                      borderRadius: 12,
                      border: "1px solid #D1D5DB",
                      fontSize: 14,
                      outline: "none",
                      width: 200,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#9CA3AF",
                    }}
                  >
                    🔍
                  </span>
                </div>
                <button
                  onClick={() => setActiveSection("add")}
                  style={btnPrimary}
                >
                  + Add Service
                </button>
                <button
                  onClick={() =>
                    void loadMyServices(servicesPage, servicesSearch)
                  }
                  style={btnOutline}
                >
                  Refresh
                </button>
              </div>
            </div>

            {myServices.length === 0 ? (
              <div style={{ padding: 20, color: "#6B7280" }}>
                No services yet. Go to "Add Service".
              </div>
            ) : (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        background: "#F9FAFB",
                        color: "#6B7280",
                        fontSize: 13,
                      }}
                    >
                      <th style={th}>Service</th>
                      <th style={th}>Category</th>
                      <th style={th}>Price</th>
                      <th style={th}>Status</th>
                      <th style={th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myServices.map((s) => {
                      const cat =
                        typeof s.category_id === "object" && s.category_id
                          ? s.category_id.category_name || s.category_id.name
                          : "—";
                      const active = !!s.is_active;

                      return (
                        <tr
                          key={s._id}
                          style={{ borderTop: "1px solid #E5E7EB" }}
                        >
                          <td style={td}>
                            <div style={{ fontWeight: 900, color: "#111827" }}>
                              {s.service_name}
                            </div>
                            <div
                              style={{
                                color: "#6B7280",
                                fontSize: 13,
                                marginTop: 4,
                              }}
                            >
                              {s.description || "—"}
                            </div>
                          </td>
                          <td style={td}>{cat || "—"}</td>
                          <td style={td}>${Number(s.price || 0).toFixed(2)}</td>
                          <td style={td}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "6px 10px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 800,
                                background: active ? "#ECFDF3" : "#FEF2F2",
                                color: active ? "#027A48" : "#B42318",
                              }}
                            >
                              {active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={td}>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                onClick={() => openEditServiceModal(s)}
                                style={btnOutlineSmall}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => toggleService(s._id)}
                                style={{
                                  ...btnOutlineSmall,
                                  borderColor: active ? "#FECACA" : "#BBF7D0",
                                  color: active ? "#B42318" : "#027A48",
                                }}
                              >
                                {active ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                onClick={() => deleteService(s._id)}
                                style={{
                                  ...btnOutlineSmall,
                                  borderColor: "#FECACA",
                                  color: "#B42318",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ padding: "16px 20px" }}>
                  <Pagination
                    page={servicesPage}
                    totalPages={servicesTotalPages}
                    onPageChange={setServicesPage}
                  />
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* Add Service */}
        {activeSection === "add" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: 20,
            }}
          >
            <div
              style={{
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: 24,
                padding: 20,
                boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 28, color: "#111827" }}>
                Add Service
              </div>
              <div style={{ color: "#6B7280", fontSize: 14, marginTop: 6 }}>
                Add a new service customers can book.
              </div>

              <form
                onSubmit={handleCreateService}
                style={{ marginTop: 20, display: "grid", gap: 14 }}
              >
                <div>
                  <label style={label}>Service Name</label>
                  <input
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="e.g. Leak Repair, Deep Cleaning"
                    style={input}
                  />
                </div>

                <div>
                  <label style={label}>Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => onCategoryChange(e.target.value)}
                    style={input}
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.category_name || c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pricing Type Selector */}
                <div>
                  <label style={label}>Pricing Type</label>
                  <div style={{ display: "flex", gap: 12 }}>
                    {/* ✅ Fixed - only show if allowed by category */}
                    {(!catLimits ||
                      catLimits.allowed_pricing_types.includes("fixed")) && (
                      <label
                        style={{
                          flex: 1,
                          border: `2px solid ${pricingType === "fixed" ? "#2563EB" : "#D1D5DB"}`,
                          borderRadius: 14,
                          padding: "12px 16px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background:
                            pricingType === "fixed" ? "#EFF6FF" : "white",
                        }}
                      >
                        <input
                          type="radio"
                          value="fixed"
                          checked={pricingType === "fixed"}
                          onChange={() => setPricingType("fixed")}
                        />
                        <div>
                          <div style={{ fontWeight: 900, color: "#111827" }}>
                            💰 Fixed Price
                          </div>
                          <div style={{ fontSize: 12, color: "#6B7280" }}>
                            Customer pays flat rate
                          </div>
                        </div>
                      </label>
                    )}

                    {/* ✅ Hourly - only show if allowed by category */}
                    {(!catLimits ||
                      catLimits.allowed_pricing_types.includes("hourly")) && (
                      <label
                        style={{
                          flex: 1,
                          border: `2px solid ${pricingType === "hourly" ? "#2563EB" : "#D1D5DB"}`,
                          borderRadius: 14,
                          padding: "12px 16px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background:
                            pricingType === "hourly" ? "#EFF6FF" : "white",
                        }}
                      >
                        <input
                          type="radio"
                          value="hourly"
                          checked={pricingType === "hourly"}
                          onChange={() => setPricingType("hourly")}
                        />
                        <div>
                          <div style={{ fontWeight: 900, color: "#111827" }}>
                            ⏱️ Hourly Rate
                          </div>
                          <div style={{ fontSize: 12, color: "#6B7280" }}>
                            Customer pays per hour
                          </div>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* Price Input */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  }}
                >
                  <div>
                    <label style={label}>
                      {pricingType === "hourly"
                        ? "Hourly Rate ($)"
                        : "Fixed Price ($)"}
                    </label>
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      type="number"
                      min={catLimits?.min_price ?? 0}
                      max={catLimits?.max_price ?? 9999}
                      step={0.01}
                      placeholder={
                        pricingType === "hourly"
                          ? "e.g. 50 per hour"
                          : "e.g. 200 flat"
                      }
                      style={{
                        ...input,
                        borderColor:
                          price &&
                          catLimits &&
                          (Number(price) < catLimits.min_price ||
                            Number(price) > catLimits.max_price)
                            ? "#EF4444"
                            : "#D1D5DB",
                      }}
                    />
                    {/* Range hint */}
                    {catLimits && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color:
                            price &&
                            (Number(price) < catLimits.min_price ||
                              Number(price) > catLimits.max_price)
                              ? "#EF4444"
                              : "#6B7280",
                        }}
                      >
                        {price && Number(price) < catLimits.min_price
                          ? `❌ Minimum price is $${catLimits.min_price}`
                          : price && Number(price) > catLimits.max_price
                            ? `❌ Maximum price is $${catLimits.max_price}`
                            : `✅ Allowed range: $${catLimits.min_price} — $${catLimits.max_price}`}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={label}>Quick Tip</label>
                    <div
                      style={{
                        padding: "12px 12px",
                        border: "1px dashed #D1D5DB",
                        borderRadius: 14,
                        color: "#4B5563",
                        minHeight: 48,
                      }}
                    >
                      {pricingType === "hourly"
                        ? "Set a fair hourly rate. Customer selects hours."
                        : "Use a clear name + honest price."}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={label}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    style={{ ...input, resize: "vertical" }}
                  />
                </div>

                <div>
                  <label style={label}>🌤️ Seasonal Months (optional)</label>
                  <div
                    style={{ fontSize: 13, color: "#6B7280", marginBottom: 10 }}
                  >
                    Pick months when this service is in high demand. Selected
                    months will boost your ranking in customer search results
                    during those months.
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {[
                      { num: 1, label: "Jan" },
                      { num: 2, label: "Feb" },
                      { num: 3, label: "Mar" },
                      { num: 4, label: "Apr" },
                      { num: 5, label: "May" },
                      { num: 6, label: "Jun" },
                      { num: 7, label: "Jul" },
                      { num: 8, label: "Aug" },
                      { num: 9, label: "Sep" },
                      { num: 10, label: "Oct" },
                      { num: 11, label: "Nov" },
                      { num: 12, label: "Dec" },
                    ].map((m) => {
                      const selected = seasonalMonths.includes(m.num);
                      return (
                        <button
                          key={m.num}
                          type="button"
                          onClick={() => {
                            if (selected) {
                              setSeasonalMonths(
                                seasonalMonths.filter((x) => x !== m.num),
                              );
                            } else {
                              setSeasonalMonths([...seasonalMonths, m.num]);
                            }
                          }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 10,
                            border: `2px solid ${selected ? "#F59E0B" : "#D1D5DB"}`,
                            background: selected ? "#FEF3C7" : "white",
                            color: selected ? "#92400E" : "#6B7280",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
                    💡 Examples: Snow removal → Dec, Jan, Feb. Lawn care →
                    Apr-Oct. Leave empty for year-round services.
                  </div>
                </div>

                <button type="submit" disabled={saving} style={btnPrimaryBig}>
                  {saving ? "Creating..." : "Create Service"}
                </button>
              </form>
            </div>

            <div
              style={{
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: 24,
                padding: 20,
                boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18, color: "#111827" }}>
                What happens next?
              </div>
              <ul
                style={{
                  marginTop: 14,
                  color: "#4B5563",
                  lineHeight: 1.9,
                  paddingLeft: 18,
                }}
              >
                <li>Your service becomes visible to customers.</li>
                <li>Customers can book you.</li>
                <li>You’ll see bookings in “Job Requests”.</li>
              </ul>
            </div>
          </div>
        ) : null}
        {/* ✅ ADD ISSUES SECTION HERE */}
        {activeSection === "issues" ? (
          <div
            style={{
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 24,
              padding: 20,
              boxShadow: "0 2px 10px rgba(16,24,40,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 30, fontWeight: 900, color: "#111827" }}
                >
                  Customer Issues
                </div>
                <div style={{ marginTop: 4, color: "#6B7280" }}>
                  Issues reported by customers about your services
                </div>
              </div>
              <button onClick={() => void loadIssues()} style={btnOutline}>
                Refresh
              </button>
            </div>

            {/* ── Tabs ── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["open", "resolved"] as const).map((tab) => {
                const count = issues.filter((i) =>
                  tab === "open"
                    ? i.status !== "resolved"
                    : i.status === "resolved",
                ).length;

                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setIssueTab(tab);
                      setIssuesPage(1);
                    }}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 14,
                      border: "none",
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: "pointer",
                      background:
                        issueTab === tab
                          ? tab === "open"
                            ? "#2563EB"
                            : "#16A34A"
                          : "#F3F4F6",
                      color: issueTab === tab ? "white" : "#6B7280",
                    }}
                  >
                    {tab === "open" ? "⚠️ Open" : "✅ Resolved"} ({count})
                  </button>
                );
              })}
            </div>

            {/* ✅ filtered list */}
            {issuesLoading ? (
              <div style={{ color: "#6B7280" }}>Loading...</div>
            ) : issuesSectionData.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "#6B7280",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>
                  {issueTab === "open" ? "🎉" : "📋"}
                </div>
                <div
                  style={{ fontWeight: 900, fontSize: 18, color: "#111827" }}
                >
                  {issueTab === "open"
                    ? "No open issues!"
                    : "No resolved issues yet."}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 16 }}>
                  {issuesSectionData.map((issue) => (
                    <div
                      key={issue._id}
                      style={{
                        border: `1px solid ${
                          issue.status === "open"
                            ? "#FECACA"
                            : issue.status === "resolved"
                              ? "#BBF7D0"
                              : "#E5E7EB"
                        }`,
                        borderRadius: 16,
                        padding: 18,
                        background:
                          issue.status === "open" ? "#FFF5F5" : "white",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          alignItems: "center",
                          marginBottom: 12,
                        }}
                      >
                        <span
                          style={{
                            background: "#FEF2F2",
                            color: "#B91C1C",
                            padding: "6px 12px",
                            borderRadius: 999,
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          ⚠️{" "}
                          {issue.issue_type?.replace(/_/g, " ").toUpperCase() ||
                            "ISSUE"}
                        </span>

                        <span
                          style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            background:
                              issue.status === "open"
                                ? "#FEF2F2"
                                : issue.status === "in_review"
                                  ? "#FEF3C7"
                                  : issue.status === "resolved"
                                    ? "#ECFDF3"
                                    : "#F3F4F6",
                            color:
                              issue.status === "open"
                                ? "#B91C1C"
                                : issue.status === "in_review"
                                  ? "#92400E"
                                  : issue.status === "resolved"
                                    ? "#166534"
                                    : "#374151",
                          }}
                        >
                          {issue.status?.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 14,
                          color: "#374151",
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>Customer:</span>{" "}
                        {issue.customer_id?.full_name || "—"}
                      </div>

                      <div
                        style={{
                          fontSize: 14,
                          color: "#6B7280",
                          display: "flex",
                          gap: 16,
                          flexWrap: "wrap",
                          marginBottom: 12,
                        }}
                      >
                        <span>🔧 {issue.service_id?.service_name || "—"}</span>
                        <span>📅 {issue.booking_id?.date || "—"}</span>
                        <span>⏰ {issue.booking_id?.time || "—"}</span>
                      </div>

                      <div
                        style={{
                          padding: "12px 14px",
                          background: "#F9FAFB",
                          borderRadius: 12,
                          fontSize: 14,
                          color: "#374151",
                          lineHeight: 1.6,
                        }}
                      >
                        "{issue.description}"
                      </div>

                      {/* Provider response OR response form */}
                      {issue.provider_response ? (
                        <div
                          style={{
                            marginTop: 12,
                            padding: "12px 14px",
                            background: "#F0FDF4",
                            border: "1px solid #BBF7D0",
                            borderRadius: 12,
                            fontSize: 14,
                            color: "#166534",
                          }}
                        >
                          <div style={{ fontWeight: 800, marginBottom: 4 }}>
                            ✅ Your Response:
                          </div>
                          "{issue.provider_response}"
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6B7280",
                              marginTop: 4,
                            }}
                          >
                            {issue.provider_responded_at
                              ? new Date(
                                  issue.provider_responded_at,
                                ).toLocaleDateString()
                              : ""}
                          </div>
                        </div>
                      ) : issue.status === "open" ? (
                        <IssueResponseForm
                          issueId={issue._id}
                          onSuccess={() => void loadIssues()}
                        />
                      ) : null}

                      {/* Admin resolution (refund) */}
                      {issue.status === "resolved" &&
                      issue.resolution_type === "refund" &&
                      issue.resolution_amount ? (
                        <div
                          style={{
                            marginTop: 12,
                            padding: "12px 14px",
                            background: "#EFF6FF",
                            border: "1px solid #BFDBFE",
                            borderRadius: 12,
                            fontSize: 14,
                            color: "#1D4ED8",
                          }}
                        >
                          <div style={{ fontWeight: 800, marginBottom: 4 }}>
                            💰 Admin Resolution:
                          </div>
                          <div>
                            ${issue.resolution_amount} refund approved to
                            customer
                          </div>
                          {issue.resolution_note ? (
                            <div style={{ marginTop: 4, color: "#3B82F6" }}>
                              {issue.resolution_note}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          color: "#9CA3AF",
                        }}
                      >
                        Reported on:{" "}
                        {new Date(issue.createdAt).toLocaleDateString()}
                      </div>

                      {/* Mark as resolved */}
                      {issue.provider_response &&
                      issue.status !== "resolved" ? (
                        <button
                          onClick={async () => {
                            if (!confirm("Mark this issue as resolved?"))
                              return;

                            await fetch(
                              `${API_BASE}/api/issues/${issue._id}/respond`,
                              {
                                method: "PATCH",
                                credentials: "include",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                  response: issue.provider_response,
                                  status: "resolved",
                                }),
                              },
                            );

                            void loadIssues();
                          }}
                          style={{
                            marginTop: 8,
                            border: "none",
                            background: "#16A34A",
                            color: "white",
                            padding: "8px 16px",
                            borderRadius: 10,
                            fontWeight: 800,
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                        >
                          ✅ Mark as Resolved
                        </button>
                      ) : null}
                      <Pagination
                        page={issuesPage}
                        totalPages={Math.ceil(
                          filteredIssues.length / PAGE_SIZE,
                        )}
                        onPageChange={setIssuesPage}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}
      </main>

      {/* Reschedule Modal */}
      {showReschedule ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              background: "white",
              borderRadius: 18,
              border: "1px solid #E5E7EB",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 18, display: "grid", gap: 12 }}>
              {rescheduleModalError && (
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
                    padding: "10px 14px",
                    borderRadius: 12,
                    fontSize: 14,
                  }}
                >
                  {rescheduleModalError}
                </div>
              )}{" "}
              <div style={{ fontWeight: 900, fontSize: 20, color: "#111827" }}>
                Request Reschedule
              </div>
              <div style={{ color: "#6B7280", marginTop: 4, fontSize: 13 }}>
                Customer must approve this request.
              </div>
            </div>

            <div style={{ padding: 18, display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <div style={label}>New Date</div>
                  <input
                    type="date"
                    value={resDate}
                    min={(() => {
                      const today = new Date();
                      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                    })()}
                    onChange={(e) => setResDate(e.target.value)}
                    style={input}
                  />
                </div>
                <div>
                  <div style={label}>New Time</div>
                  <input
                    type="time"
                    value={resTime}
                    min={(() => {
                      const today = new Date();
                      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                      if (resDate === todayStr) {
                        return `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
                      }
                      return undefined;
                    })()}
                    onChange={(e) => setResTime(e.target.value)}
                    style={input}
                  />
                </div>
              </div>

              <div>
                <div style={label}>Reason</div>
                <textarea
                  value={resReason}
                  onChange={(e) => setResReason(e.target.value)}
                  rows={4}
                  style={{ ...input, resize: "vertical" }}
                />
              </div>
            </div>

            <div
              style={{
                padding: 18,
                borderTop: "1px solid #E5E7EB",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowReschedule(false);
                  setRescheduleModalError("");
                }}
                style={btnOutline}
              >
                Cancel
              </button>
              <button
                onClick={() => void submitProviderReschedule()}
                style={btnPrimary}
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit Service Modal */}
      {editOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(620px, 100%)",
              background: "white",
              borderRadius: 18,
              border: "1px solid #E5E7EB",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 18,
                borderBottom: "1px solid #E5E7EB",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div>
                <div
                  style={{ fontWeight: 900, fontSize: 20, color: "#111827" }}
                >
                  Edit Service
                </div>
                <div style={{ color: "#6B7280", marginTop: 4, fontSize: 13 }}>
                  Update service details, price, and category.
                </div>
              </div>
              <button
                onClick={closeEditServiceModal}
                style={btnOutlineSmall}
                disabled={editSaving}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 18 }}>
              {editError ? (
                <div
                  style={{
                    marginBottom: 12,
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
                    padding: 12,
                    borderRadius: 12,
                  }}
                >
                  {editError}
                </div>
              ) : null}

              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={label}>Service Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={input}
                  />
                </div>

                <div>
                  <label style={label}>Category</label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    style={input}
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.category_name || c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={label}>Price ($)</label>
                    <input
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      type="number"
                      min={0}
                      step={0.01}
                      style={input}
                    />
                  </div>

                  <div>
                    <label style={label}>Note</label>
                    <div
                      style={{
                        padding: "12px 12px",
                        border: "1px dashed #D1D5DB",
                        borderRadius: 12,
                        color: "#4B5563",
                      }}
                    >
                      Keep price realistic.
                    </div>
                  </div>
                </div>

                <div>
                  <label style={label}>Description</label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={4}
                    style={{ ...input, resize: "vertical" }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 18,
                borderTop: "1px solid #E5E7EB",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={closeEditServiceModal}
                style={btnOutline}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                onClick={saveEditedService}
                style={btnPrimary}
                disabled={editSaving}
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* ── Deactivate Modal ── */}
      {deactivateOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 70,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(480px, 100%)",
              background: "white",
              borderRadius: 20,
              border: "1px solid #E5E7EB",
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #FEE2E2",
                background: "#FFF5F5",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{ fontSize: 20, fontWeight: 900, color: "#B91C1C" }}
                >
                  Deactivate Account
                </div>
                <div style={{ fontSize: 13, color: "#DC2626", marginTop: 4 }}>
                  Enter your password to confirm. You will be logged out
                  immediately.
                </div>
              </div>
              <button
                onClick={() => {
                  setDeactivateOpen(false);
                  setDeactivatePassword("");
                  setDeactivateError("");
                }}
                style={btnOutlineSmall}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 20 }}>
              {deactivateError && (
                <div
                  style={{
                    marginBottom: 14,
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
                    padding: "10px 14px",
                    borderRadius: 12,
                    fontSize: 14,
                  }}
                >
                  {deactivateError}
                </div>
              )}

              <div>
                <label style={label}>Confirm Password</label>
                <input
                  type="password"
                  value={deactivatePassword}
                  onChange={(e) => setDeactivatePassword(e.target.value)}
                  placeholder="Enter your password"
                  style={input}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid #E5E7EB",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setDeactivateOpen(false);
                  setDeactivatePassword("");
                  setDeactivateError("");
                }}
                disabled={deactivateLoading}
                style={btnOutline}
              >
                Cancel
              </button>
              <button
                onClick={submitDeactivate}
                disabled={deactivateLoading}
                style={{
                  ...btnPrimary,
                  background: deactivateLoading ? "#EF4444" : "#DC2626",
                  opacity: deactivateLoading ? 0.7 : 1,
                  cursor: deactivateLoading ? "not-allowed" : "pointer",
                }}
              >
                {deactivateLoading ? "Deactivating..." : "Yes, Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
      {urgentBooking && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 16,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        >
          <div
            style={{
              width: "min(500px, 100%)",
              background: "white",
              borderRadius: 24,
              border: "4px solid #DC2626",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(220, 38, 38, 0.5)",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #DC2626 0%, #EA580C 100%)",
                padding: "20px 24px",
                color: "white",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 900 }}>
                🚨 URGENT JOB OFFER
              </div>
              <div style={{ fontSize: 14, marginTop: 6, opacity: 0.95 }}>
                First to accept wins • Race against{" "}
                {(urgentBooking.urgent_broadcast_to?.length || 5) - 1} other
                providers
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}
                >
                  Service
                </div>
                <div
                  style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}
                >
                  {urgentBooking.service_id?.service_name || "Service"}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div
                  style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}
                >
                  Customer Address
                </div>
                <div style={{ fontSize: 15, color: "#111827" }}>
                  📍 {urgentBooking.formatted_address || urgentBooking.address}
                </div>
              </div>

              <div
                style={{
                  background:
                    "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
                  border: "1px solid #F59E0B",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{ fontSize: 13, color: "#92400E", fontWeight: 600 }}
                >
                  💰 Premium Price
                </div>
                <div
                  style={{ fontSize: 32, fontWeight: 900, color: "#92400E" }}
                >
                  ${urgentBooking.total_amount}
                </div>
                <div style={{ fontSize: 12, color: "#92400E", marginTop: 4 }}>
                  Includes +{urgentBooking.urgent_premium_pct}% urgency premium
                </div>
              </div>

              {urgentBooking.notes && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: 12,
                    background: "#F9FAFB",
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}
                  >
                    Notes
                  </div>
                  <div style={{ fontSize: 14, color: "#374151" }}>
                    "{urgentBooking.notes}"
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => void passUrgent()}
                  disabled={urgentAccepting}
                  style={{
                    flex: 1,
                    border: "1px solid #D1D5DB",
                    background: "white",
                    color: "#6B7280",
                    padding: "14px",
                    borderRadius: 12,
                    fontWeight: 700,
                    cursor: urgentAccepting ? "not-allowed" : "pointer",
                    fontSize: 15,
                  }}
                >
                  Pass
                </button>
                <button
                  onClick={() => void acceptUrgent()}
                  disabled={urgentAccepting}
                  style={{
                    flex: 2,
                    border: "none",
                    background: urgentAccepting
                      ? "#9CA3AF"
                      : "linear-gradient(135deg, #DC2626 0%, #EA580C 100%)",
                    color: "white",
                    padding: "14px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: urgentAccepting ? "wait" : "pointer",
                    fontSize: 16,
                    boxShadow: urgentAccepting
                      ? "none"
                      : "0 4px 12px rgba(220, 38, 38, 0.4)",
                  }}
                >
                  {urgentAccepting ? "⏳ Accepting..." : "🚨 ACCEPT NOW"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ChatModal
        open={chatOpen}
        bookingId={chatBookingId}
        peerName={chatPeerName}
        onClose={() => {
          setChatOpen(false);
          void loadUnreadCounts();
        }}
      />
    </div>
  );
}
export default ProviderDashboard;

function Field(props: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <label style={label}>{props.label}</label>
      <input value={props.value} readOnly style={input} />
    </div>
  );
}

function buildLinePath(
  values: number[],
  width: number,
  maxHeight: number,
  top: number,
) {
  const max = Math.max(...values, 1);
  const leftPad = 40;
  const rightPad = 40;
  const usableWidth = width - leftPad - rightPad;
  const step =
    values.length > 1 ? usableWidth / (values.length - 1) : usableWidth;

  return values
    .map((v, i) => {
      const x = leftPad + i * step;
      const y = top + (maxHeight - (v / max) * maxHeight);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildAreaPath(
  values: number[],
  width: number,
  maxHeight: number,
  top: number,
) {
  const max = Math.max(...values, 1);
  const leftPad = 40;
  const rightPad = 40;
  const usableWidth = width - leftPad - rightPad;
  const step =
    values.length > 1 ? usableWidth / (values.length - 1) : usableWidth;

  const points = values.map((v, i) => {
    const x = leftPad + i * step;
    const y = top + (maxHeight - (v / max) * maxHeight);
    return { x, y };
  });

  if (!points.length) return "";

  return [
    `M ${points[0].x} ${top + maxHeight}`,
    ...points.map((p) => `L ${p.x} ${p.y}`),
    `L ${points[points.length - 1].x} ${top + maxHeight}`,
    "Z",
  ].join(" ");
}

const label: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  marginBottom: 6,
  color: "#374151",
  fontSize: 14,
};

const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid #D1D5DB",
  borderRadius: 14,
  padding: "12px 14px",
  outline: "none",
  fontSize: 14,
  color: "#111827",
  background: "white",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontWeight: 800,
};

const td: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  verticalAlign: "top",
  color: "#111827",
};

const btnOutline: React.CSSProperties = {
  border: "1px solid #D1D5DB",
  background: "white",
  padding: "10px 14px",
  borderRadius: 14,
  cursor: "pointer",
  fontWeight: 800,
  color: "#374151",
};

const btnPrimary: React.CSSProperties = {
  border: "none",
  background: "#2563EB",
  color: "white",
  padding: "12px 16px",
  borderRadius: 14,
  cursor: "pointer",
  fontWeight: 900,
};

const btnPrimaryBig: React.CSSProperties = {
  border: "none",
  background: "#2563EB",
  color: "white",
  padding: "14px 18px",
  borderRadius: 16,
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 16,
};

const btnOutlineSmall: React.CSSProperties = {
  border: "1px solid #D1D5DB",
  background: "white",
  padding: "8px 10px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 800,
  color: "#111827",
};

const btnSuccessWide: React.CSSProperties = {
  border: "none",
  background: "linear-gradient(90deg, #46B64D 0%, #379C42 100%)",
  color: "white",
  padding: "12px 18px",
  borderRadius: 14,
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 15,
};

const btnOutlineWide: React.CSSProperties = {
  border: "1px solid #D1D5DB",
  background: "white",
  color: "#374151",
  padding: "12px 18px",
  borderRadius: 14,
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 15,
};
