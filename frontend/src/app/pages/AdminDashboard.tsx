import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  DollarSign,
  Users,
  Briefcase,
  TrendingUp,
  Search,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  LayoutDashboard,
  UsersRound,
  ClipboardList,
  Package,
  FileBarChart,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  Zap,
  TrendingDown,
  Activity,
  Award,
  Target,
  Flame,
  AlertCircle,
  ChevronUp,
  Eye,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useAuthStore } from "../auth.store";
import { useAdminLive } from "../hooks/useLiveData";

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  "http://localhost:5001";
const PAGE_SIZE = 5;

type ProviderStatus = "draft" | "pending" | "verified" | "rejected";
type ProviderRow = {
  _id: string;
  full_name?: string;
  email: string;
  role: "provider";
  provider_status?: ProviderStatus;
  is_profile_complete?: boolean;
  createdAt?: string;
  provider_profile?: any;
};
type UserRow = {
  _id: string;
  full_name?: string;
  email: string;
  role: "customer" | "provider";
  is_active: boolean;
  deactivated_at?: string;
};
type CategoryRow = {
  _id: string;
  category_name: string;
  icon?: string;
  is_active?: boolean;
  min_price?: number;
  max_price?: number;
  allowed_pricing_types?: string[];
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

// ── Sidebar Menu Structure ──
const MENU = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, subTabs: [] },
  {
    id: "users",
    label: "Users",
    icon: UsersRound,
    subTabs: [
      { id: "all-users", label: "All Users" },
      { id: "verification", label: "Provider Verification" },
      { id: "deactivated", label: "Deactivated Accounts" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: ClipboardList,
    subTabs: [
      { id: "bookings", label: "All Bookings" },
      { id: "payments", label: "Payments" },
      { id: "refunds", label: "Refund Requests" },
      { id: "conversations", label: "Conversations" },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    icon: Package,
    subTabs: [
      { id: "services", label: "Services" },
      { id: "categories", label: "Categories" },
      { id: "reviews", label: "Reviews" },
    ],
  },
  { id: "reports", label: "Reports", icon: FileBarChart, subTabs: [] },
];

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
      <p className="text-sm text-gray-500">
        Page <span className="font-semibold">{page}</span> of{" "}
        <span className="font-semibold">{totalPages}</span>
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          «
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
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
              <span
                key={`dot-${i}`}
                className="px-2 py-1.5 text-gray-400 text-sm"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${page === p ? "bg-[#2563EB] text-white border-[#2563EB]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                {p}
              </button>
            ),
          )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          Next ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          »
        </button>
      </div>
    </div>
  );
}

function AdminIssueActions({
  issue,
  onUpdate,
}: {
  issue: any;
  onUpdate: () => void;
}) {
  const [resolutionType, setResolutionType] = useState("none");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  async function resolve() {
    if (resolutionType !== "none" && !amount) {
      setError("Please enter amount");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/issues/${issue._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "resolved",
          resolution_type: resolutionType,
          resolution_amount: Number(amount) || 0,
          resolution_note: note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setOpen(false);
      onUpdate();
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function markInReview() {
    try {
      await fetch(`${API_BASE}/api/issues/${issue._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_review" }),
      });
      onUpdate();
    } catch (error) {
      console.error(error);
    }
  }

  // 🤖 AI: Analyze the issue with Claude
  async function analyzeWithAI() {
    setAiLoading(true);
    setError("");
    setAiResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/admin/analyze-issue`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: issue.description || issue.message || "",
          booking_id: issue.booking_id?._id || issue.booking_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "AI failed");
      setAiResult(data);

      // Auto-open resolution form + pre-fill if AI suggests action
      setOpen(true);
      if (data.refund_amount_suggested && data.refund_amount_suggested > 0) {
        setResolutionType("refund");
        setAmount(String(data.refund_amount_suggested));
      }
      if (data.draft_response) {
        setNote(data.draft_response);
      }
    } catch (e: any) {
      setError(e?.message || "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      {!open ? (
        <div className="flex gap-2 flex-wrap">
          {issue.status === "open" && (
            <button
              onClick={markInReview}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            >
              👁 Mark In Review
            </button>
          )}
          {/* 🤖 AI analyze button */}
          <button
            onClick={analyzeWithAI}
            disabled={aiLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{
              background: aiLoading
                ? "#A5B4FC"
                : "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
              boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
            }}
          >
            {aiLoading ? "✨ Analyzing..." : "🤖 Analyze with AI"}
          </button>
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700"
          >
            ✅ Resolve Issue
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="font-semibold text-gray-900 mb-3">
            Resolve this issue:
          </div>
          {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

          {/* 🤖 AI Analysis Result */}
          {aiResult && (
            <div
              className="mb-4 rounded-xl p-4"
              style={{
                background: "linear-gradient(135deg, #F0F4FF 0%, #FAF5FF 100%)",
                border: "1px solid #C7D2FE",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 18 }}>🤖</span>
                <span
                  style={{ fontWeight: 800, color: "#4338CA", fontSize: 14 }}
                >
                  AI Analysis
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    background:
                      aiResult.severity === "critical"
                        ? "#FEF2F2"
                        : aiResult.severity === "high"
                          ? "#FEF3C7"
                          : aiResult.severity === "medium"
                            ? "#EFF6FF"
                            : "#F0FDF4",
                    color:
                      aiResult.severity === "critical"
                        ? "#991B1B"
                        : aiResult.severity === "high"
                          ? "#92400E"
                          : aiResult.severity === "medium"
                            ? "#1E40AF"
                            : "#166534",
                  }}
                >
                  {String(aiResult.severity || "").toUpperCase()}
                </span>
              </div>

              <div style={{ fontSize: 13, lineHeight: 1.6, color: "#1F2937" }}>
                <div style={{ marginBottom: 6 }}>
                  <strong>Customer mood:</strong>{" "}
                  <span style={{ textTransform: "capitalize" }}>
                    {aiResult.customer_mood}
                  </span>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong>Recommendation:</strong> {aiResult.recommended_action}
                </div>
                {aiResult.refund_amount_suggested != null && (
                  <div style={{ marginBottom: 6 }}>
                    <strong>Suggested refund:</strong> $
                    {aiResult.refund_amount_suggested}
                  </div>
                )}
                <div
                  style={{
                    marginBottom: 6,
                    fontStyle: "italic",
                    color: "#4B5563",
                  }}
                >
                  💡 {aiResult.reasoning}
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: "white",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#9CA3AF",
                  textAlign: "center",
                }}
              >
                Suggested fields below have been pre-filled. Edit before
                confirming.
              </div>
            </div>
          )}

          {/* Resolution Form */}
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Resolution Type
              </label>
              <select
                value={resolutionType}
                onChange={(e) => setResolutionType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="none">No Action</option>
                <option value="refund">Refund</option>
                <option value="discount">Discount Coupon</option>
                <option value="rework">Rework Service</option>
              </select>
            </div>

            {resolutionType !== "none" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Admin Note
              </label>
              <textarea
                placeholder="Explain the resolution..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 min-h-20"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => void resolve()}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 text-sm font-semibold"
              >
                {loading ? "Resolving..." : "Confirm Resolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get("section") || "dashboard";
  const activeSubTab = searchParams.get("tab") || "";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── All states ──
  const [providerSearch, setProviderSearch] = useState("");
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState("");
  const [pendingProviders, setPendingProviders] = useState<ProviderRow[]>([]);
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [providerPage, setProviderPage] = useState(1);
  const [providerTotalPages, setProviderTotalPages] = useState(1);
  const [providerTotal, setProviderTotal] = useState(0);
  const [deactivatedUsers, setDeactivatedUsers] = useState<UserRow[]>([]);
  const [deactivatedLoading, setDeactivatedLoading] = useState(false);
  const [deactivatedError, setDeactivatedError] = useState("");
  const [deactivatedSearch, setDeactivatedSearch] = useState("");
  const [reactivateBusy, setReactivateBusy] = useState<Record<string, boolean>>(
    {},
  );
  const [deactivatedPage, setDeactivatedPage] = useState(1);
  const [deactivatedTotalPages, setDeactivatedTotalPages] = useState(1);
  const [deactivatedTotal, setDeactivatedTotal] = useState(0);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [newCatMinPrice, setNewCatMinPrice] = useState("");
  const [newCatMaxPrice, setNewCatMaxPrice] = useState("");
  const [newCatAllowFixed, setNewCatAllowFixed] = useState(true);
  const [newCatAllowHourly, setNewCatAllowHourly] = useState(true);
  const [catSearch, setCatSearch] = useState("");
  const [catPage, setCatPage] = useState(1);
  const [catTotalPages, setCatTotalPages] = useState(1);
  const [catTotal, setCatTotal] = useState(0);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicesPage, setServicesPage] = useState(1);
  const [servicesTotalPages, setServicesTotalPages] = useState(1);
  const [servicesTotal, setServicesTotal] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewsSearch, setReviewsSearch] = useState("");
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [realStats, setRealStats] = useState<any>(null);
  const [monthlyChart, setMonthlyChart] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsTotalPages, setBookingsTotalPages] = useState(1);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsSearch, setBookingsSearch] = useState("");
  const [bookingsStatusFilter, setBookingsStatusFilter] = useState("all");
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsStatusFilter, setPaymentsStatusFilter] = useState("all");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [allUsersError, setAllUsersError] = useState("");
  const [allUsersPage, setAllUsersPage] = useState(1);
  const [allUsersTotalPages, setAllUsersTotalPages] = useState(1);
  const [allUsersTotal, setAllUsersTotal] = useState(0);
  const [allUsersSearch, setAllUsersSearch] = useState("");
  const [allUsersRoleFilter, setAllUsersRoleFilter] = useState("all");
  const [issues, setIssues] = useState<any[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState("");
  const [commissionReport, setCommissionReport] = useState<any>(null);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionFrom, setCommissionFrom] = useState("");
  const [commissionTo, setCommissionTo] = useState("");
  const [commissionTab, setCommissionTab] = useState<
    "overview" | "monthly" | "category" | "providers" | "customers"
  >("overview");
  const currentUser = useAuthStore((s) => s.me);
  const refreshAllAdmin = () => {
    void loadAdminStats();
    void loadAllUsers(allUsersPage, allUsersSearch, allUsersRoleFilter);
    void loadAllBookings(bookingsPage, bookingsSearch, bookingsStatusFilter);
    void loadAllPayments(paymentsPage, paymentsStatusFilter);
    void loadIssues();
    void loadReviews(reviewsPage, reviewsSearch);
    void loadPendingProviders(providerPage, providerSearch);
    void loadDashboardInsights();
  };
  useAdminLive({
    onNewUser: refreshAllAdmin,
    onNewBooking: refreshAllAdmin,
    onNewPayment: refreshAllAdmin,
    onRefund: refreshAllAdmin,
    onNewIssue: refreshAllAdmin,
    onNewReview: refreshAllAdmin,
  });
  const [collapsedSection, setCollapsedSection] = useState<string | null>(null);
  const [dashboardInsights, setDashboardInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Conversations (admin moderation) state
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsPage, setConversationsPage] = useState(1);
  const [conversationsTotalPages, setConversationsTotalPages] = useState(1);
  const [conversationsTotal, setConversationsTotal] = useState(0);
  const [selectedConvMessages, setSelectedConvMessages] = useState<
    any[] | null
  >(null);
  const [selectedConvLoading, setSelectedConvLoading] = useState(false);
  const [selectedConvLabel, setSelectedConvLabel] = useState<string>("");

  // Export modal state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportPreset, setExportPreset] = useState<
    "all" | "7d" | "30d" | "90d" | "year" | "custom"
  >("all");
  function applyPreset(p: typeof exportPreset) {
    setExportPreset(p);
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (p === "all") {
      setExportFrom("");
      setExportTo("");
      return;
    }
    if (p === "custom") return;
    const from = new Date(today);
    if (p === "7d") from.setDate(today.getDate() - 7);
    if (p === "30d") from.setDate(today.getDate() - 30);
    if (p === "90d") from.setDate(today.getDate() - 90);
    if (p === "year") from.setFullYear(today.getFullYear() - 1);
    setExportFrom(fmt(from));
    setExportTo(fmt(today));
  }

  const adminIssues = useMemo(
    () =>
      issues.filter(
        (i) => i.refund_requested === true && i.status !== "resolved",
      ),
    [issues],
  );

  // Compute month-over-month % growth from monthlyChart.
  // Last item = current month, second-to-last = prev month.
  function pctGrowth(curr: number, prev: number): number {
    if (!prev || prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  const lastTwo = monthlyChart.slice(-2);
  const prevMonth = lastTwo[0] || {};
  const currMonth = lastTwo[1] || {};
  const revenueGrowth = pctGrowth(
    Number(currMonth.revenue || 0),
    Number(prevMonth.revenue || 0),
  );
  const bookingsGrowth = pctGrowth(
    Number(currMonth.bookings || 0),
    Number(prevMonth.bookings || 0),
  );
  // No historical data on providers in monthlyChart, so use new-this-month vs total
  const providersGrowth = realStats?.providersGrowth ?? 0;

  // Real platform commission from commissionReport (admin's main report endpoint),
  // fallback to 0 until the report is loaded.
  const realCommission = Number(
    commissionReport?.summary?.totalPlatformCommission || 0,
  );
  const commissionGrowth = pctGrowth(
    Number(currMonth.commission || currMonth.revenue * 0.15 || 0),
    Number(prevMonth.commission || prevMonth.revenue * 0.15 || 0),
  );

  const stats = {
    totalRevenue: realStats?.totalRevenue || 0,
    revenueGrowth,
    totalBookings: realStats?.totalBookings || 0,
    bookingsGrowth,
    activeProviders: realStats?.activeProviders || 0,
    providersGrowth,
    platformCommission: realCommission,
    commissionGrowth,
  };

  const monthlyRevenue =
    monthlyChart.length > 0
      ? monthlyChart
      : [
          { month: "Jan", revenue: 0, bookings: 0 },
          { month: "Feb", revenue: 0, bookings: 0 },
          { month: "Mar", revenue: 0, bookings: 0 },
          { month: "Apr", revenue: 0, bookings: 0 },
          { month: "May", revenue: 0, bookings: 0 },
          { month: "Jun", revenue: 0, bookings: 0 },
        ];

  // CSV export — exports whatever data is currently loaded for the active section.
  function downloadCSV(
    filename: string,
    sections: { title: string; headers: string[]; rows: any[][] }[],
  ) {
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const parts: string[] = [];
    parts.push(`"Fixora Admin Report"`);
    parts.push(`"Generated:","${new Date().toLocaleString()}"`);
    if (exportFrom || exportTo) {
      parts.push(
        `"Date range:","${exportFrom || "All time"} to ${exportTo || "Now"}"`,
      );
    }
    parts.push("");
    sections.forEach((sec) => {
      parts.push(`"=== ${sec.title} (${sec.rows.length} rows) ==="`);
      parts.push(sec.headers.map(escape).join(","));
      sec.rows.forEach((r) => parts.push(r.map(escape).join(",")));
      parts.push("");
    });
    const blob = new Blob([parts.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Helper: keep only items whose date falls within the chosen range
  function filterByDate(items: any[], dateField: string) {
    if (!exportFrom && !exportTo) return items;
    const fromTs = exportFrom ? new Date(exportFrom).getTime() : 0;
    const toTs = exportTo
      ? new Date(exportTo).getTime() + 86400000 - 1
      : Infinity;
    return items.filter((it) => {
      const v = it[dateField];
      if (!v) return false;
      const ts = new Date(v).getTime();
      return !Number.isNaN(ts) && ts >= fromTs && ts <= toTs;
    });
  }

  async function handleFullExport() {
    setExportBusy(true);
    try {
      // Fetch ALL data with high limit (paginated endpoints respect limit param)
      const [bk, py, us, sv, rv] = await Promise.all([
        apiFetch<any>(
          `/api/admin/bookings?limit=10000&page=1&search=&status=all`,
        ),
        apiFetch<any>(
          `/api/admin/payments?limit=10000&page=1&payment_status=all`,
        ),
        apiFetch<any>(
          `/api/admin/all-users?limit=10000&page=1&search=&role=all`,
        ),
        apiFetch<any>(`/api/admin/services?limit=10000&page=1&search=`),
        apiFetch<any>(`/api/reviews?limit=10000&page=1&search=`),
      ]);

      const bookings = filterByDate(bk.bookings || [], "createdAt");
      const payments = filterByDate(py.payments || [], "createdAt");
      const users = filterByDate(us.users || [], "createdAt");
      const services = filterByDate(sv.services || [], "createdAt");
      const revs = filterByDate(rv.reviews || [], "createdAt");

      const sections = [
        {
          title: "SUMMARY",
          headers: ["Metric", "Value"],
          rows: [
            ["Total Revenue", `$${stats.totalRevenue.toLocaleString()}`],
            ["Revenue Growth %", stats.revenueGrowth],
            ["Total Bookings", stats.totalBookings],
            ["Bookings Growth %", stats.bookingsGrowth],
            ["Active Providers", stats.activeProviders],
            ["Providers Growth %", stats.providersGrowth],
            [
              "Platform Commission",
              `$${stats.platformCommission.toLocaleString()}`,
            ],
            ["Cancellation Rate %", realStats?.cancellationRate ?? 0],
            [
              "Avg Booking Value",
              `$${(realStats?.avgBookingValue ?? 0).toLocaleString()}`,
            ],
            ["Refund Rate %", realStats?.refundRate ?? 0],
            ["Customer Retention %", realStats?.retentionRate ?? 0],
          ],
        },
        {
          title: "BOOKINGS",
          headers: [
            "Customer",
            "Email",
            "Provider",
            "Service",
            "Date",
            "Time",
            "Amount",
            "Status",
            "Payment",
            "Created",
          ],
          rows: bookings.map((b: any) => [
            b.customer_id?.full_name || "",
            b.customer_id?.email || "",
            b.provider_id?.full_name || "",
            b.service_id?.service_name || "",
            b.date || "",
            b.time || "",
            Number(b.total_amount || b.service_id?.price || 0).toFixed(2),
            b.status || "",
            b.payment_status || "",
            b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "",
          ]),
        },
        {
          title: "PAYMENTS",
          headers: [
            "Customer",
            "Provider",
            "Service",
            "Amount",
            "Payment Status",
            "Booking Status",
            "Method",
            "Created",
          ],
          rows: payments.map((p: any) => [
            p.customer_id?.full_name || "",
            p.provider_id?.full_name || "",
            p.service_id?.service_name || "",
            Number(p.total_amount || p.service_id?.price || 0).toFixed(2),
            p.payment_status || "",
            p.status || "",
            p.payment_method || "",
            p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
          ]),
        },
        {
          title: "USERS",
          headers: [
            "Name",
            "Email",
            "Role",
            "Active",
            "Provider Status",
            "Joined",
          ],
          rows: users.map((u: any) => [
            u.full_name || "",
            u.email || "",
            u.role || "",
            u.is_active ? "Yes" : "No",
            u.provider_status || "",
            u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "",
          ]),
        },
        {
          title: "SERVICES",
          headers: [
            "Service",
            "Provider",
            "Category",
            "Price",
            "Pricing Type",
            "Active",
            "Created",
          ],
          rows: services.map((s: any) => [
            s.service_name || "",
            s.provider_id?.full_name || "",
            s.category_id?.category_name || "",
            Number(s.price || 0).toFixed(2),
            s.pricing_type || "",
            s.is_active ? "Yes" : "No",
            s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "",
          ]),
        },
        {
          title: "REVIEWS",
          headers: [
            "Customer",
            "Provider",
            "Rating",
            "Comment",
            "Visible",
            "Created",
          ],
          rows: revs.map((r: any) => [
            r.customer_id?.full_name || "",
            r.provider_id?.full_name || "",
            r.rating || "",
            r.comment || "",
            r.is_visible ? "Yes" : "No",
            r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "",
          ]),
        },
      ];

      const stamp = new Date().toISOString().slice(0, 10);
      const rangeTag =
        exportFrom || exportTo
          ? `_${exportFrom || "all"}_to_${exportTo || stamp}`
          : "";
      downloadCSV(`fixora-full-report${rangeTag}_${stamp}.csv`, sections);
      setExportOpen(false);
    } catch (e: any) {
      alert("Export failed: " + (e?.message || "unknown"));
    } finally {
      setExportBusy(false);
    }
  }

  // ── Navigation helpers ──
  function goToSection(sectionId: string, subTabId?: string) {
    if (sectionId === activeSection && !subTabId && activeSubTab) {
      setSearchParams({ section: sectionId });
      return;
    }
    const params: any = { section: sectionId };
    if (subTabId) params.tab = subTabId;
    setSearchParams(params);
    setSidebarOpen(false);
  }

  // ── Load Functions ──
  async function loadCommissionReport() {
    setCommissionLoading(true);
    try {
      const params = new URLSearchParams();
      if (commissionFrom) params.set("from", commissionFrom);
      if (commissionTo) params.set("to", commissionTo);
      const res = await apiFetch<any>(`/api/admin/commission-report?${params}`);
      setCommissionReport(res);
    } catch (e: any) {
      console.error(e);
    } finally {
      setCommissionLoading(false);
    }
  }

  async function loadPendingProviders(
    page = providerPage,
    search = providerSearch,
  ) {
    setProvidersError("");
    setProvidersLoading(true);
    try {
      const res = await apiFetch<any>(
        `/api/admin/providers?status=pending_verification&page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`,
      );
      setPendingProviders(res.providers || []);
      setProviderTotalPages(res.totalPages || 1);
      setProviderTotal(res.total || 0);
    } catch (e: any) {
      setProvidersError(e?.message || "Failed");
    } finally {
      setProvidersLoading(false);
    }
  }

  async function loadDeactivatedUsers(
    page = deactivatedPage,
    search = deactivatedSearch,
  ) {
    setDeactivatedError("");
    setDeactivatedLoading(true);
    try {
      const res = await apiFetch<any>(
        `/api/admin/users?is_active=false&page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`,
      );
      setDeactivatedUsers(res.users || []);
      setDeactivatedTotalPages(res.totalPages || 1);
      setDeactivatedTotal(res.total || 0);
    } catch (e: any) {
      setDeactivatedError(e?.message || "Failed");
    } finally {
      setDeactivatedLoading(false);
    }
  }

  async function loadCategories(page = catPage, search = catSearch) {
    setCatLoading(true);
    setCatError("");
    try {
      const res = await apiFetch<any>(
        `/api/categories?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`,
      );
      setCategories(res.categories || []);
      setCatTotalPages(res.totalPages || 1);
      setCatTotal(res.total || 0);
    } catch (e: any) {
      setCatError(e?.message || "Failed");
    } finally {
      setCatLoading(false);
    }
  }

  async function loadDashboardInsights() {
    setInsightsLoading(true);
    try {
      const res = await apiFetch<any>("/api/admin/dashboard-insights");
      setDashboardInsights(res);
    } catch (e: any) {
      console.error(e);
    } finally {
      setInsightsLoading(false);
    }
  }

  async function loadConversations(page = conversationsPage) {
    setConversationsLoading(true);
    try {
      const res = await apiFetch<any>(
        `/api/admin/conversations?page=${page}&limit=10`,
      );
      setConversations(res.conversations || []);
      setConversationsTotalPages(res.totalPages || 1);
      setConversationsTotal(res.total || 0);
    } catch (e: any) {
      console.error(e);
    } finally {
      setConversationsLoading(false);
    }
  }

  async function openAdminConversation(bookingId: string, label: string) {
    setSelectedConvLabel(label);
    setSelectedConvMessages([]);
    setSelectedConvLoading(true);
    try {
      const res = await apiFetch<any>(`/api/admin/conversations/${bookingId}`);
      setSelectedConvMessages(res.messages || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setSelectedConvLoading(false);
    }
  }

  async function loadAllServices(page = servicesPage, search = serviceSearch) {
    setServicesLoading(true);
    setServicesError("");
    try {
      const res = await apiFetch<any>(
        `/api/admin/services?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`,
      );
      setAllServices(res.services || []);
      setServicesTotalPages(res.totalPages || 1);
      setServicesTotal(res.total || 0);
    } catch (e: any) {
      setServicesError(e?.message || "Failed");
    } finally {
      setServicesLoading(false);
    }
  }

  async function loadReviews(page = reviewsPage, search = reviewsSearch) {
    setReviewsLoading(true);
    setReviewsError("");
    try {
      const res = await apiFetch<any>(
        `/api/reviews?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`,
      );
      setReviews(res.reviews || []);
      setReviewsTotalPages(res.totalPages || 1);
      setReviewsTotal(res.total || 0);
    } catch (e: any) {
      setReviewsError(e?.message || "Failed");
    } finally {
      setReviewsLoading(false);
    }
  }

  async function loadIssues() {
    setIssuesLoading(true);
    setIssuesError("");
    try {
      const res = await apiFetch<any>("/api/issues");
      setIssues(res.issues || []);
    } catch (e: any) {
      setIssuesError(e?.message || "Failed");
    } finally {
      setIssuesLoading(false);
    }
  }

  async function loadAdminStats() {
    try {
      const res = await apiFetch<any>("/api/admin/stats");
      setRealStats(res);
      setMonthlyChart(res.monthlyChart || []);
    } catch (e: any) {
      console.error(e);
    }
  }

  async function loadAllBookings(
    page = bookingsPage,
    search = bookingsSearch,
    status = bookingsStatusFilter,
  ) {
    setBookingsLoading(true);
    setBookingsError("");
    try {
      const res = await apiFetch<any>(
        `/api/admin/bookings?page=${page}&search=${encodeURIComponent(search)}&status=${status}&limit=${PAGE_SIZE}`,
      );
      setAllBookings(res.bookings || []);
      setBookingsTotalPages(res.totalPages || 1);
      setBookingsTotal(res.total || 0);
    } catch (e: any) {
      setBookingsError(e?.message || "Failed");
    } finally {
      setBookingsLoading(false);
    }
  }

  async function loadAllPayments(
    page = paymentsPage,
    status = paymentsStatusFilter,
  ) {
    setPaymentsLoading(true);
    setPaymentsError("");
    try {
      const res = await apiFetch<any>(
        `/api/admin/payments?page=${page}&payment_status=${status}&limit=${PAGE_SIZE}`,
      );
      setAllPayments(res.payments || []);
      setPaymentsTotalPages(res.totalPages || 1);
      setPaymentsTotal(res.total || 0);
    } catch (e: any) {
      setPaymentsError(e?.message || "Failed");
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function loadAllUsers(
    page = allUsersPage,
    search = allUsersSearch,
    role = allUsersRoleFilter,
  ) {
    setAllUsersLoading(true);
    setAllUsersError("");
    try {
      const res = await apiFetch<any>(
        `/api/admin/all-users?page=${page}&search=${encodeURIComponent(search)}&role=${role}&limit=${PAGE_SIZE}`,
      );
      setAllUsers(res.users || []);
      setAllUsersTotalPages(res.totalPages || 1);
      setAllUsersTotal(res.total || 0);
    } catch (e: any) {
      setAllUsersError(e?.message || "Failed");
    } finally {
      setAllUsersLoading(false);
    }
  }

  async function adminUpdateBookingStatus(id: string, status: string) {
    try {
      await apiFetch(`/api/admin/bookings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      void loadAllBookings(bookingsPage, bookingsSearch, bookingsStatusFilter);
    } catch (e: any) {
      setBookingsError(e?.message || "Failed");
    }
  }

  // ── Initial loads ──
  useEffect(() => {
    void loadAdminStats();
    void loadPendingProviders(1, "");
    void loadDeactivatedUsers(1, "");
    void loadCategories(1, "");
    void loadAllServices(1, "");
    void loadReviews(1, "");
    void loadIssues();
    void loadAllBookings(1, "", "all");
    void loadAllPayments(1, "all");
    void loadAllUsers(1, "", "all");
    void loadCommissionReport();
    void loadDashboardInsights();
    void loadConversations(1);
  }, []);

  // ── Conversations page effect ──
  useEffect(() => {
    if (activeSection === "operations" && activeSubTab === "conversations") {
      void loadConversations(conversationsPage);
    }
  }, [conversationsPage, activeSection, activeSubTab]);

  // ── Search/page effects ──
  useEffect(() => {
    setProviderPage(1);
    void loadPendingProviders(1, providerSearch);
  }, [providerSearch]);
  useEffect(() => {
    void loadPendingProviders(providerPage, providerSearch);
  }, [providerPage]);
  useEffect(() => {
    setDeactivatedPage(1);
    void loadDeactivatedUsers(1, deactivatedSearch);
  }, [deactivatedSearch]);
  useEffect(() => {
    void loadDeactivatedUsers(deactivatedPage, deactivatedSearch);
  }, [deactivatedPage]);
  useEffect(() => {
    setCatPage(1);
    void loadCategories(1, catSearch);
  }, [catSearch]);
  useEffect(() => {
    void loadCategories(catPage, catSearch);
  }, [catPage]);
  useEffect(() => {
    setServicesPage(1);
    void loadAllServices(1, serviceSearch);
  }, [serviceSearch]);
  useEffect(() => {
    void loadAllServices(servicesPage, serviceSearch);
  }, [servicesPage]);
  useEffect(() => {
    setReviewsPage(1);
    void loadReviews(1, reviewsSearch);
  }, [reviewsSearch]);
  useEffect(() => {
    void loadReviews(reviewsPage, reviewsSearch);
  }, [reviewsPage]);
  useEffect(() => {
    void loadAllBookings(bookingsPage, bookingsSearch, bookingsStatusFilter);
  }, [bookingsPage]);
  useEffect(() => {
    setBookingsPage(1);
    void loadAllBookings(1, bookingsSearch, bookingsStatusFilter);
  }, [bookingsSearch, bookingsStatusFilter]);
  useEffect(() => {
    void loadAllPayments(paymentsPage, paymentsStatusFilter);
  }, [paymentsPage, paymentsStatusFilter]);
  useEffect(() => {
    void loadAllUsers(allUsersPage, allUsersSearch, allUsersRoleFilter);
  }, [allUsersPage]);
  useEffect(() => {
    setAllUsersPage(1);
    void loadAllUsers(1, allUsersSearch, allUsersRoleFilter);
  }, [allUsersSearch, allUsersRoleFilter]);

  // ── Actions ──
  async function reactivateUser(id: string) {
    setReactivateBusy((s) => ({ ...s, [id]: true }));
    try {
      await apiFetch(`/api/admin/users/${id}/reactivate`, { method: "PATCH" });
      void loadDeactivatedUsers(deactivatedPage, deactivatedSearch);
    } catch (e: any) {
      setDeactivatedError(e?.message || "Failed");
    } finally {
      setReactivateBusy((s) => ({ ...s, [id]: false }));
    }
  }

  function timeAgo(date: string | Date) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  }

  async function updateProviderStatus(id: string, status: ProviderStatus) {
    setProvidersError("");
    setActionBusy((s) => ({ ...s, [id]: true }));
    try {
      await apiFetch(`/api/admin/providers/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      void loadPendingProviders(providerPage, providerSearch);
    } catch (e: any) {
      setProvidersError(e?.message || "Failed");
    } finally {
      setActionBusy((s) => ({ ...s, [id]: false }));
    }
  }

  async function createCategory() {
    if (!newCatName.trim()) {
      setCatError("Category name is required");
      return;
    }
    const allowed_pricing_types = [
      ...(newCatAllowFixed ? ["fixed"] : []),
      ...(newCatAllowHourly ? ["hourly"] : []),
    ];
    if (allowed_pricing_types.length === 0) {
      setCatError("Select at least one pricing type");
      return;
    }
    setCatSaving(true);
    setCatError("");
    try {
      await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify({
          category_name: newCatName.trim(),
          icon: newCatIcon.trim(),
          min_price: Number(newCatMinPrice) || 0,
          max_price: Number(newCatMaxPrice) || 9999,
          allowed_pricing_types,
        }),
      });
      setNewCatName("");
      setNewCatIcon("");
      setNewCatMinPrice("");
      setNewCatMaxPrice("");
      setNewCatAllowFixed(true);
      setNewCatAllowHourly(true);
      void loadCategories(1, catSearch);
    } catch (e: any) {
      setCatError(e?.message || "Failed");
    } finally {
      setCatSaving(false);
    }
  }

  async function updateCategory(id: string) {
    if (!editCatName.trim()) return;
    try {
      await apiFetch(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ category_name: editCatName.trim() }),
      });
      setEditCatId(null);
      setEditCatName("");
      void loadCategories(catPage, catSearch);
    } catch (e: any) {
      setCatError(e?.message || "Failed");
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category?")) return;
    try {
      await apiFetch(`/api/categories/${id}`, { method: "DELETE" });
      void loadCategories(catPage, catSearch);
    } catch (e: any) {
      setCatError(e?.message || "Failed");
    }
  }

  async function toggleService(id: string) {
    try {
      await apiFetch(`/api/admin/services/${id}/toggle`, { method: "PATCH" });
      void loadAllServices(servicesPage, serviceSearch);
    } catch (e: any) {
      setServicesError(e?.message || "Failed");
    }
  }

  async function toggleCategory(id: string) {
    try {
      await apiFetch(`/api/categories/${id}/toggle`, { method: "PATCH" });
      void loadCategories(catPage, catSearch);
    } catch (e: any) {
      setCatError(e?.message || "Failed");
    }
  }

  async function toggleReview(id: string) {
    try {
      await apiFetch(`/api/reviews/${id}/toggle`, { method: "PATCH" });
      void loadReviews(reviewsPage, reviewsSearch);
    } catch (e: any) {
      setReviewsError(e?.message || "Failed");
    }
  }

  async function deleteReview(id: string) {
    if (!confirm("Delete this review?")) return;
    try {
      await apiFetch(`/api/reviews/${id}`, { method: "DELETE" });
      void loadReviews(reviewsPage, reviewsSearch);
    } catch (e: any) {
      setReviewsError(e?.message || "Failed");
    }
  }

  // ── RENDER ──
  return (
    <div
      className="min-h-screen gradient-bg-mesh overscroll-none"
      style={{
        background:
          "linear-gradient(135deg, #f5f7ff 0%, #fff5fc 50%, #f0f9ff 100%)",
      }}
    >
      {/* ─── SIDEBAR ─── */}
      <aside
        className={`fixed top-16 left-0 z-30 h-[calc(100vh-64px)] w-64 glass-card-dark border-r border-white/30 flex flex-col transform transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2563EB] rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-base">Fixora</div>
              <div className="text-xs text-gray-500">Admin Portal</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close sidebar"
            title="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Profile Card */}
        <div className="p-4">
          <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-[#2563EB] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
              {(currentUser?.full_name || currentUser?.email || "A")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((x: string) => x[0]?.toUpperCase())
                .join("") || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 truncate">
                {currentUser?.full_name || "Admin"}
              </div>
              <div className="text-xs text-gray-500">Platform Manager</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="px-3 pb-4 space-y-1 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 200px)" }}
        >
          {MENU.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.subTabs.length === 0) {
                      goToSection(item.id);
                      setCollapsedSection(null);
                    } else if (isActive && collapsedSection !== item.id) {
                      setCollapsedSection(item.id);
                    } else if (isActive && collapsedSection === item.id) {
                      setCollapsedSection(null);
                    } else {
                      goToSection(item.id, item.subTabs[0].id);
                      setCollapsedSection(null);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon size={18} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.subTabs.length > 0 && (
                    <ChevronRight
                      size={14}
                      className={`transition-transform ${isActive && collapsedSection !== item.id ? "rotate-90" : ""}`}
                    />
                  )}
                </button>

                {isActive &&
                  collapsedSection !== item.id &&
                  item.subTabs.length > 0 && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-3">
                      {item.subTabs.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => goToSection(item.id, sub.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                            activeSubTab === sub.id
                              ? "text-[#2563EB] font-semibold bg-blue-50"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── MAIN CONTENT ─── */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-16 z-20">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                title="Toggle sidebar menu"
                aria-label="Toggle sidebar menu"
              >
                <Menu size={20} />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 capitalize">
                  {MENU.find((m) => m.id === activeSection)?.label ||
                    "Dashboard"}
                  {activeSubTab && (
                    <span className="text-gray-400 font-normal text-base">
                      {
                        MENU.find((m) => m.id === activeSection)?.subTabs.find(
                          (s) => s.id === activeSubTab,
                        )?.label
                      }
                    </span>
                  )}
                </h1>
              </div>
            </div>
            <button
              onClick={() => setExportOpen(true)}
              className="hidden sm:flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          {/* ═══════════ DASHBOARD SECTION ═══════════ */}
          {activeSection === "dashboard" && (
            <div className="space-y-6">
              {/* ── Welcome Hero Banner ── */}
              <div
                className="relative overflow-hidden rounded-3xl p-8"
                style={{
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
                }}
              >
                <div
                  className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 float-anim"
                  style={{
                    background:
                      "radial-gradient(circle, white 0%, transparent 70%)",
                    transform: "translate(30%, -30%)",
                  }}
                />
                <div
                  className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10 float-anim"
                  style={{
                    background:
                      "radial-gradient(circle, white 0%, transparent 70%)",
                    animationDelay: "3s",
                  }}
                />

                <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="text-yellow-300" size={20} />
                      <span className="text-white/90 text-sm font-semibold tracking-wider uppercase">
                        Welcome back, {currentUser?.full_name || "Admin"}
                      </span>
                    </div>
                    <h2 className="text-4xl font-bold text-white mb-2">
                      {dashboardInsights?.healthScore >= 80 ? (
                        <>
                          Your platform is{" "}
                          <span className="text-yellow-300">thriving</span> 🚀
                        </>
                      ) : dashboardInsights?.healthScore >= 60 ? (
                        <>
                          Your platform is{" "}
                          <span className="text-yellow-300">growing well</span>{" "}
                          📈
                        </>
                      ) : (
                        <>
                          Let's{" "}
                          <span className="text-yellow-300">grow together</span>{" "}
                          💪
                        </>
                      )}
                    </h2>
                    <p className="text-white/80">
                      {new Date().toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="glass-card rounded-2xl px-5 py-3">
                      <div className="text-xs text-gray-600 font-semibold">
                        Platform Health
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-2xl font-bold gradient-text">
                          {dashboardInsights?.healthScore || 0}
                        </div>
                        <span
                          className={`text-xs font-bold ${
                            dashboardInsights?.healthScore >= 80
                              ? "text-green-600"
                              : dashboardInsights?.healthScore >= 60
                                ? "text-blue-600"
                                : "text-orange-600"
                          }`}
                        >
                          {dashboardInsights?.healthLabel || "LOADING"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── AI Insights Bar (REAL DATA) ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card-dark rounded-2xl p-5 hover-lift cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stats.revenueGrowth >= 0 ? "from-green-400 to-emerald-500" : "from-red-400 to-rose-500"} flex items-center justify-center text-white shadow-lg`}
                    >
                      {stats.revenueGrowth >= 0 ? (
                        <TrendingUp size={18} />
                      ) : (
                        <TrendingDown size={18} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-500">
                        {stats.revenueGrowth >= 0
                          ? "Revenue is up"
                          : "Revenue down"}
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        {Math.abs(stats.revenueGrowth)}%
                      </div>
                      <div className="text-xs text-gray-500">vs last month</div>
                    </div>
                  </div>
                </div>

                <div className="glass-card-dark rounded-2xl p-5 hover-lift cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white shadow-lg">
                      <Flame size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-500">
                        Trending Service
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        {dashboardInsights?.trending?.name || "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {dashboardInsights?.trending?.percent >= 0 ? "+" : ""}
                        {dashboardInsights?.trending?.percent || 0}% bookings
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-card-dark rounded-2xl p-5 hover-lift cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white shadow-lg">
                      <Target size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-500">
                        Monthly Goal
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        {dashboardInsights?.goalProgress || 0}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {dashboardInsights?.monthlyBookings || 0} /{" "}
                        {dashboardInsights?.monthlyGoal || 50} bookings
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Premium Stats Cards with REAL Sparklines ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    label: "Total Revenue",
                    value: `$${stats.totalRevenue.toLocaleString()}`,
                    growth: stats.revenueGrowth,
                    Icon: DollarSign,
                    gradient: "from-blue-500 to-cyan-500",
                    sparkline: dashboardInsights?.sparklines?.revenue || [],
                    chartColor: "#3b82f6",
                  },
                  {
                    label: "Total Bookings",
                    value: stats.totalBookings,
                    growth: stats.bookingsGrowth,
                    Icon: Briefcase,
                    gradient: "from-emerald-500 to-teal-500",
                    sparkline: dashboardInsights?.sparklines?.bookings || [],
                    chartColor: "#10b981",
                  },
                  {
                    label: "Active Providers",
                    value: stats.activeProviders,
                    growth: stats.providersGrowth,
                    Icon: Users,
                    gradient: "from-purple-500 to-pink-500",
                    sparkline: dashboardInsights?.sparklines?.providers || [],
                    chartColor: "#a855f7",
                  },
                  {
                    label: "Platform Earnings",
                    value: `$${stats.platformCommission.toLocaleString()}`,
                    growth: stats.commissionGrowth,
                    Icon: TrendingUp,
                    gradient: "from-orange-500 to-red-500",
                    sparkline: dashboardInsights?.sparklines?.commission || [],
                    chartColor: "#f97316",
                  },
                ].map(
                  ({
                    label,
                    value,
                    growth,
                    Icon,
                    gradient,
                    sparkline,
                    chartColor,
                  }) => (
                    <div
                      key={label}
                      className="relative overflow-hidden rounded-3xl p-6 hover-lift glass-card-dark"
                    >
                      <div
                        className={`absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 bg-gradient-to-br ${gradient}`}
                        style={{ transform: "translate(30%, -30%)" }}
                      />

                      <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                          <div
                            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}
                          >
                            <Icon className="text-white" size={22} />
                          </div>
                          <div className="live-indicator text-xs font-bold text-emerald-600">
                            LIVE
                          </div>
                        </div>

                        <p className="text-gray-600 text-sm font-semibold mb-1">
                          {label}
                        </p>
                        <p className="text-3xl font-bold text-gray-900 mb-3">
                          {value}
                        </p>

                        <div className="flex items-center justify-between">
                          <span
                            className={`flex items-center gap-1 text-sm font-bold ${growth > 0 ? "text-emerald-600" : "text-red-600"}`}
                          >
                            {growth > 0 ? (
                              <ChevronUp size={16} />
                            ) : (
                              <TrendingDown size={16} />
                            )}
                            {Math.abs(growth)}%
                          </span>
                          <span className="text-xs text-gray-400">
                            vs last month
                          </span>
                        </div>

                        <div className="mt-3 h-12 -mx-2">
                          {sparkline.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart
                                data={sparkline.map((v: number, i: number) => ({
                                  v,
                                  i,
                                }))}
                              >
                                <defs>
                                  <linearGradient
                                    id={`spark-${label}`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="0%"
                                      stopColor={chartColor}
                                      stopOpacity={0.4}
                                    />
                                    <stop
                                      offset="100%"
                                      stopColor={chartColor}
                                      stopOpacity={0}
                                    />
                                  </linearGradient>
                                </defs>
                                <Area
                                  type="monotone"
                                  dataKey="v"
                                  stroke={chartColor}
                                  strokeWidth={2}
                                  fill={`url(#spark-${label})`}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs text-gray-400">
                              No data yet
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>

              {/* ── 4 Health Metrics ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Cancellation Rate",
                    value: `${realStats?.cancellationRate ?? 0}%`,
                    sub: `${realStats?.cancelledBookings ?? 0} of ${realStats?.totalBookings ?? 0}`,
                    icon: "🚫",
                    color: "from-red-500 to-rose-500",
                    good: (realStats?.cancellationRate ?? 0) < 15,
                  },
                  {
                    label: "Avg Booking Value",
                    value: `$${(realStats?.avgBookingValue ?? 0).toLocaleString()}`,
                    sub: `${realStats?.paidBookingsCount ?? 0} paid bookings`,
                    icon: "💵",
                    color: "from-emerald-500 to-teal-500",
                    good: true,
                  },
                  {
                    label: "Refund Rate",
                    value: `${realStats?.refundRate ?? 0}%`,
                    sub: `${realStats?.refundedCount ?? 0} refunded`,
                    icon: "↩️",
                    color: "from-orange-500 to-amber-500",
                    good: (realStats?.refundRate ?? 0) < 5,
                  },
                  {
                    label: "Customer Retention",
                    value: `${realStats?.retentionRate ?? 0}%`,
                    sub: `${realStats?.repeatCustomers ?? 0} repeat customers`,
                    icon: "💎",
                    color: "from-purple-500 to-indigo-500",
                    good: (realStats?.retentionRate ?? 0) > 20,
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="glass-card-dark rounded-2xl p-5 hover-lift"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center text-lg shadow-lg`}
                      >
                        {m.icon}
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${m.good ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {m.good ? "Healthy" : "Watch"}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 mb-1">
                      {m.label}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {m.value}
                    </div>
                    <div className="text-xs text-gray-400">{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* ── Smart Quick Actions (REAL DATA) ── */}
              {(providerTotal > 0 || adminIssues.length > 0) && (
                <div className="glass-card-dark rounded-3xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="text-amber-500" size={20} />
                    <h3 className="text-lg font-bold text-gray-900">
                      Action Required
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {providerTotal > 0 && (
                      <button
                        onClick={() => goToSection("users", "verification")}
                        className="group flex items-center justify-between p-4 rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 hover-lift text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <AlertCircle
                              className="text-orange-500"
                              size={16}
                            />
                            <span className="font-bold text-gray-900">
                              {providerTotal} Provider
                              {providerTotal !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            Awaiting verification
                          </div>
                        </div>
                        <ArrowRight
                          className="text-orange-500 group-hover:translate-x-1 transition"
                          size={20}
                        />
                      </button>
                    )}
                    {adminIssues.length > 0 && (
                      <button
                        onClick={() => goToSection("operations", "refunds")}
                        className="group flex items-center justify-between p-4 rounded-2xl bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 hover-lift text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <AlertCircle className="text-red-500" size={16} />
                            <span className="font-bold text-gray-900">
                              {adminIssues.length} Refund Request
                              {adminIssues.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            Needs your review
                          </div>
                        </div>
                        <ArrowRight
                          className="text-red-500 group-hover:translate-x-1 transition"
                          size={20}
                        />
                      </button>
                    )}
                    <button
                      onClick={() => goToSection("reports")}
                      className="group flex items-center justify-between p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 hover-lift text-left"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Activity className="text-blue-500" size={16} />
                          <span className="font-bold text-gray-900">
                            View Reports
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Full financial breakdown
                        </div>
                      </div>
                      <ArrowRight
                        className="text-blue-500 group-hover:translate-x-1 transition"
                        size={20}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Charts Row ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card-dark rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Revenue Performance
                      </h3>
                      <p className="text-sm text-gray-500">
                        Last 6 months trend
                      </p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyRevenue}>
                      <defs>
                        <linearGradient
                          id="revenueGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#6366f1"
                            stopOpacity={1}
                          />
                          <stop
                            offset="100%"
                            stopColor="#8b5cf6"
                            stopOpacity={0.7}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                      <YAxis
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255,255,255,0.95)",
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                          backdropFilter: "blur(10px)",
                        }}
                        formatter={(value: any) => [
                          `$${Number(value).toLocaleString()}`,
                          "Revenue",
                        ]}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="url(#revenueGrad)"
                        radius={[12, 12, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* REAL Category Distribution */}
                <div className="glass-card-dark rounded-3xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Top Categories
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Distribution by revenue
                  </p>
                  {dashboardInsights?.categoryDistribution?.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={dashboardInsights.categoryDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {dashboardInsights.categoryDistribution.map(
                              (entry: any, index: number) => (
                                <Cell key={index} fill={entry.color} />
                              ),
                            )}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(255,255,255,0.95)",
                              border: "1px solid #e5e7eb",
                              borderRadius: "12px",
                              backdropFilter: "blur(10px)",
                            }}
                            formatter={(value: any) => [`${value}%`, "Share"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-2 space-y-1">
                        {dashboardInsights.categoryDistribution
                          .slice(0, 3)
                          .map((cat: any) => (
                            <div
                              key={cat.name}
                              className="flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ background: cat.color }}
                                />
                                <span className="font-semibold text-gray-700">
                                  {cat.name}
                                </span>
                              </div>
                              <span className="text-gray-500">
                                {cat.value}%
                              </span>
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                      No category data yet
                    </div>
                  )}
                </div>
              </div>

              {/* ── REAL Live Activity Feed + Top Providers ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card-dark rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Activity className="text-emerald-500" size={20} />
                      <h3 className="text-lg font-bold text-gray-900">
                        Live Activity
                      </h3>
                    </div>
                    <span className="live-indicator text-xs font-bold text-emerald-600">
                      LIVE
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {dashboardInsights?.liveFeed?.length > 0 ? (
                      dashboardInsights.liveFeed.map(
                        (activity: any, i: number) => (
                          <div
                            key={i}
                            className={`flex items-center gap-3 p-3 rounded-2xl ${activity.color} hover-lift`}
                          >
                            <div className="text-2xl">{activity.icon}</div>
                            <div className="flex-1">
                              <div className="text-sm font-bold text-gray-900">
                                {activity.text}
                              </div>
                              <div className="text-xs text-gray-600">
                                {activity.user}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 font-semibold">
                              {timeAgo(activity.time)}
                            </div>
                          </div>
                        ),
                      )
                    ) : (
                      <div className="py-12 text-center text-gray-400 text-sm">
                        No recent activity yet. Start by getting your first
                        booking! 🚀
                      </div>
                    )}
                  </div>
                </div>

                {/* REAL Top Providers */}
                <div className="glass-card-dark rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Award className="text-amber-500" size={20} />
                      <h3 className="text-lg font-bold text-gray-900">
                        Top Providers
                      </h3>
                    </div>
                    <button
                      onClick={() => goToSection("reports")}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      View All <ArrowRight size={12} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {dashboardInsights?.topProviders?.length > 0 ? (
                      dashboardInsights.topProviders.map((provider: any) => (
                        <div
                          key={provider.rank}
                          className={`flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r ${provider.gradient} hover-lift`}
                        >
                          <div className="text-2xl w-10 text-center">
                            {provider.badge}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-bold text-gray-900">
                              {provider.name}
                            </div>
                            <div className="text-xs text-gray-600">
                              {provider.jobs} completed jobs
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-gray-900">
                              ${provider.earnings.toLocaleString()}
                            </div>
                            <div className="text-xs text-emerald-600 font-semibold">
                              earnings
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-gray-400 text-sm">
                        No providers with completed jobs yet
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Booking Volume Chart (REAL DATA) ── */}
              <div className="glass-card-dark rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Booking Volume
                    </h3>
                    <p className="text-sm text-gray-500">
                      Monthly booking trends
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-3 py-1 rounded-full ${stats.bookingsGrowth >= 0 ? "bg-emerald-50" : "bg-red-50"}`}
                  >
                    {stats.bookingsGrowth >= 0 ? (
                      <TrendingUp size={14} className="text-emerald-600" />
                    ) : (
                      <TrendingDown size={14} className="text-red-600" />
                    )}
                    <span
                      className={`text-xs font-bold ${stats.bookingsGrowth >= 0 ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {stats.bookingsGrowth >= 0 ? "+" : ""}
                      {stats.bookingsGrowth}% growth
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyRevenue}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={1} />
                        <stop
                          offset="100%"
                          stopColor="#6366f1"
                          stopOpacity={0.6}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255,255,255,0.95)",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        backdropFilter: "blur(10px)",
                      }}
                    />
                    <Bar
                      dataKey="bookings"
                      fill="url(#barGrad)"
                      radius={[12, 12, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ═══════════ USERS SECTION ═══════════ */}
          {activeSection === "users" && activeSubTab === "all-users" && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    All Users
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    All customers and providers.{" "}
                    <span className="text-gray-400 text-xs">
                      ({allUsersTotal} total)
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={allUsersRoleFilter}
                    onChange={(e) => setAllUsersRoleFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">All Roles</option>
                    <option value="customer">Customers</option>
                    <option value="provider">Providers</option>
                  </select>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={allUsersSearch}
                      onChange={(e) => setAllUsersSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <button
                    onClick={() =>
                      void loadAllUsers(
                        allUsersPage,
                        allUsersSearch,
                        allUsersRoleFilter,
                      )
                    }
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
                  >
                    <RefreshCcw size={14} /> Refresh
                  </button>
                </div>
              </div>
              {allUsersError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {allUsersError}
                </div>
              )}
              {allUsersLoading ? (
                <div className="text-gray-600">Loading...</div>
              ) : allUsers.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No users found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {[
                          "User",
                          "Role",
                          "Status",
                          "Joined",
                          "Provider Status",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.map((u) => {
                        const initials =
                          (u.full_name || u.email)
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((x: string) => x[0]?.toUpperCase())
                            .join("") || "U";
                        return (
                          <tr
                            key={u._id}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${u.role === "provider" ? "bg-[#2563EB]" : "bg-purple-500"}`}
                                >
                                  {initials}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {u.full_name || "—"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {u.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${u.role === "provider" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                              >
                                {u.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {u.createdAt
                                ? new Date(u.createdAt).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="py-3 px-4">
                              {u.role === "provider" ? (
                                <span
                                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${u.provider_status === "verified" ? "bg-green-100 text-green-700" : u.provider_status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}
                                >
                                  {u.provider_status || "pending"}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Pagination
                    page={allUsersPage}
                    totalPages={allUsersTotalPages}
                    onPageChange={(p) => setAllUsersPage(p)}
                  />
                </div>
              )}
            </div>
          )}

          {activeSection === "users" && activeSubTab === "verification" && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Provider Verification
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Approve or reject provider onboarding.{" "}
                    <span className="text-gray-400 text-xs">
                      ({providerTotal} total)
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      void loadPendingProviders(providerPage, providerSearch)
                    }
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <RefreshCcw size={16} /> Refresh
                  </button>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Search providers..."
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
              {providersError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {providersError}
                </div>
              )}
              {providersLoading ? (
                <div className="text-gray-600">Loading...</div>
              ) : pendingProviders.length === 0 ? (
                <div className="text-gray-600 py-8 text-center">
                  No pending providers.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {[
                          "Provider",
                          "Phone",
                          "Profile",
                          "Status",
                          "Action",
                        ].map((h, i) => (
                          <th
                            key={h}
                            className={`py-3 px-4 text-sm font-semibold text-gray-700 ${i === 4 ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pendingProviders.map((p) => {
                        const busy = !!actionBusy[p._id];
                        const initials =
                          (p.full_name || p.email)
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((x) => x[0]?.toUpperCase())
                            .join("") || "P";
                        return (
                          <tr
                            key={p._id}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#2563EB] rounded-full flex items-center justify-center text-white font-semibold">
                                  {initials}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {p.full_name || "Provider"}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {p.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-700">
                              {p.provider_profile?.phone || "—"}
                            </td>
                            <td className="py-3 px-4 text-gray-700">
                              <div className="text-sm">
                                {p.is_profile_complete
                                  ? "Complete"
                                  : "Incomplete"}
                              </div>
                              <div className="text-xs text-gray-500">
                                SSN:{" "}
                                {p.provider_profile?.ssn_last4
                                  ? `****${p.provider_profile.ssn_last4}`
                                  : "—"}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 px-3 py-1 text-xs font-semibold">
                                {p.provider_status || "pending"}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() =>
                                    void updateProviderStatus(p._id, "verified")
                                  }
                                  disabled={busy}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                                >
                                  <CheckCircle2 size={16} /> Approve
                                </button>
                                <button
                                  onClick={() =>
                                    void updateProviderStatus(p._id, "rejected")
                                  }
                                  disabled={busy}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  <XCircle size={16} /> Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Pagination
                    page={providerPage}
                    totalPages={providerTotalPages}
                    onPageChange={(p) => setProviderPage(p)}
                  />
                </div>
              )}
            </div>
          )}

          {activeSection === "users" && activeSubTab === "deactivated" && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Deactivated Accounts
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Reactivate users who deactivated their accounts.{" "}
                    <span className="text-gray-400 text-xs">
                      ({deactivatedTotal} total)
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      void loadDeactivatedUsers(
                        deactivatedPage,
                        deactivatedSearch,
                      )
                    }
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <RefreshCcw size={16} /> Refresh
                  </button>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={deactivatedSearch}
                      onChange={(e) => setDeactivatedSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
              {deactivatedError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {deactivatedError}
                </div>
              )}
              {deactivatedLoading ? (
                <div className="text-gray-600">Loading...</div>
              ) : deactivatedUsers.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No deactivated accounts.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {[
                          "User",
                          "Role",
                          "Deactivated At",
                          "Status",
                          "Action",
                        ].map((h, i) => (
                          <th
                            key={h}
                            className={`py-3 px-4 text-sm font-semibold text-gray-700 ${i === 4 ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deactivatedUsers.map((u) => {
                        const busy = !!reactivateBusy[u._id];
                        const initials =
                          (u.full_name || u.email)
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((x) => x[0]?.toUpperCase())
                            .join("") || "U";
                        return (
                          <tr
                            key={u._id}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center text-white font-semibold">
                                  {initials}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {u.full_name || "User"}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {u.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${u.role === "provider" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {u.deactivated_at
                                ? new Date(
                                    u.deactivated_at,
                                  ).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-semibold">
                                Deactivated
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex justify-end">
                                <button
                                  onClick={() => void reactivateUser(u._id)}
                                  disabled={busy}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                                >
                                  <CheckCircle2 size={16} />
                                  {busy ? "Reactivating..." : "Reactivate"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Pagination
                    page={deactivatedPage}
                    totalPages={deactivatedTotalPages}
                    onPageChange={(p) => setDeactivatedPage(p)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ═══════════ OPERATIONS SECTION ═══════════ */}
          {activeSection === "operations" && activeSubTab === "bookings" && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    All Bookings
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Every booking on the platform.{" "}
                    <span className="text-gray-400 text-xs">
                      ({bookingsTotal} total)
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={bookingsStatusFilter}
                    onChange={(e) => setBookingsStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={bookingsSearch}
                      onChange={(e) => setBookingsSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <button
                    onClick={() =>
                      void loadAllBookings(
                        bookingsPage,
                        bookingsSearch,
                        bookingsStatusFilter,
                      )
                    }
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
                  >
                    <RefreshCcw size={14} /> Refresh
                  </button>
                </div>
              </div>
              {bookingsError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {bookingsError}
                </div>
              )}
              {bookingsLoading ? (
                <div className="text-gray-600">Loading...</div>
              ) : allBookings.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No bookings.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {[
                          "Customer",
                          "Provider",
                          "Service",
                          "Date",
                          "Amount",
                          "Status",
                          "Payment",
                          "Action",
                        ].map((h, i) => (
                          <th
                            key={h}
                            className={`py-3 px-4 text-sm font-semibold text-gray-700 ${i === 7 ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allBookings.map((b) => (
                        <tr
                          key={b._id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {b.customer_id?.full_name || "—"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {b.customer_id?.email || ""}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {b.provider_id?.full_name || "—"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {b.provider_id?.email || ""}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {b.service_id?.service_name || "—"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            <div>{b.date || "—"}</div>
                            <div className="text-xs text-gray-400">
                              {b.time || ""}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            $
                            {Number(
                              b.total_amount || b.service_id?.price || 0,
                            ).toFixed(0)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${b.status === "completed" ? "bg-blue-100 text-blue-700" : b.status === "confirmed" ? "bg-green-100 text-green-700" : b.status === "cancelled" ? "bg-gray-100 text-gray-700" : b.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${b.payment_status === "paid" ? "bg-green-100 text-green-700" : b.payment_status === "refunded" ? "bg-purple-100 text-purple-700" : b.payment_status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}
                            >
                              {b.payment_status || "pending"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end gap-1">
                              {b.status !== "completed" &&
                                b.status !== "cancelled" && (
                                  <>
                                    {b.status !== "confirmed" && (
                                      <button
                                        onClick={() =>
                                          void adminUpdateBookingStatus(
                                            b._id,
                                            "confirmed",
                                          )
                                        }
                                        className="px-2 py-1 rounded text-xs font-semibold border border-green-200 text-green-700 hover:bg-green-50"
                                      >
                                        Confirm
                                      </button>
                                    )}
                                    <button
                                      onClick={() =>
                                        void adminUpdateBookingStatus(
                                          b._id,
                                          "cancelled",
                                        )
                                      }
                                      className="px-2 py-1 rounded text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    page={bookingsPage}
                    totalPages={bookingsTotalPages}
                    onPageChange={(p) => setBookingsPage(p)}
                  />
                </div>
              )}
            </div>
          )}

          {activeSection === "operations" && activeSubTab === "payments" && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    All Payments
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Every transaction.{" "}
                    <span className="text-gray-400 text-xs">
                      ({paymentsTotal} total)
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={paymentsStatusFilter}
                    onChange={(e) => setPaymentsStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">All Payments</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                  <button
                    onClick={() =>
                      void loadAllPayments(paymentsPage, paymentsStatusFilter)
                    }
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
                  >
                    <RefreshCcw size={14} /> Refresh
                  </button>
                </div>
              </div>
              {paymentsError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {paymentsError}
                </div>
              )}
              {paymentsLoading ? (
                <div className="text-gray-600">Loading...</div>
              ) : allPayments.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No payments.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {[
                          "Customer",
                          "Provider",
                          "Service",
                          "Amount",
                          "Payment Status",
                          "Booking Status",
                          "Date",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allPayments.map((p) => (
                        <tr
                          key={p._id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {p.customer_id?.full_name || "—"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {p.customer_id?.email || ""}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {p.provider_id?.full_name || "—"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {p.provider_id?.email || ""}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {p.service_id?.service_name || "—"}
                          </td>
                          <td className="py-3 px-4 font-bold text-gray-900">
                            $
                            {Number(
                              p.total_amount || p.service_id?.price || 0,
                            ).toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${p.payment_status === "paid" ? "bg-green-100 text-green-700" : p.payment_status === "refunded" ? "bg-purple-100 text-purple-700" : p.payment_status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}
                            >
                              {p.payment_status || "pending"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${p.status === "completed" ? "bg-blue-100 text-blue-700" : p.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {p.date || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    page={paymentsPage}
                    totalPages={paymentsTotalPages}
                    onPageChange={(p) => setPaymentsPage(p)}
                  />
                </div>
              )}
            </div>
          )}

          {activeSection === "operations" && activeSubTab === "refunds" && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Refund Requests
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Issues where customer requested a refund.
                  </p>
                </div>
                <button
                  onClick={() => void loadIssues()}
                  disabled={issuesLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <RefreshCcw size={16} /> Refresh
                </button>
              </div>
              {issuesError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {issuesError}
                </div>
              )}
              {issuesLoading ? (
                <div className="text-gray-600">Loading...</div>
              ) : adminIssues.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  🎉 No refund requests!
                </div>
              ) : (
                <div className="space-y-4">
                  {adminIssues.map((issue) => (
                    <div
                      key={issue._id}
                      className={`rounded-xl border p-5 ${issue.status === "open" ? "border-red-200 bg-red-50" : issue.status === "in_review" ? "border-yellow-200 bg-yellow-50" : "border-gray-200"}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                          ⚠️{" "}
                          {issue.issue_type?.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${issue.status === "open" ? "bg-red-200 text-red-800" : issue.status === "in_review" ? "bg-yellow-200 text-yellow-800" : "bg-gray-200 text-gray-800"}`}
                        >
                          {issue.status?.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {new Date(issue.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <div className="font-semibold text-gray-500 text-xs mb-1">
                            CUSTOMER
                          </div>
                          <div className="text-gray-900 font-medium">
                            {issue.customer_id?.full_name || "—"}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {issue.customer_id?.email || ""}
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-500 text-xs mb-1">
                            PROVIDER
                          </div>
                          <div className="text-gray-900 font-medium">
                            {issue.provider_id?.full_name || "—"}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {issue.provider_id?.email || ""}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mb-3 flex gap-4 flex-wrap">
                        <span>🔧 {issue.service_id?.service_name || "—"}</span>
                        <span>📅 {issue.booking_id?.date || "—"}</span>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200 mb-3">
                        <div className="text-xs font-bold text-gray-500 mb-1">
                          CUSTOMER COMPLAINT:
                        </div>
                        <div className="text-sm text-gray-800">
                          "{issue.description}"
                        </div>
                      </div>
                      {issue.provider_response ? (
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 mb-3">
                          <div className="text-xs font-bold text-blue-600 mb-1">
                            PROVIDER RESPONSE:
                          </div>
                          <div className="text-sm text-blue-800">
                            "{issue.provider_response}"
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 mb-3">
                          ⏳ Provider has not responded yet
                        </div>
                      )}
                      {issue.status !== "resolved" && (
                        <AdminIssueActions
                          issue={issue}
                          onUpdate={() => void loadIssues()}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════════ CONVERSATIONS (Chat Moderation) ═══════════ */}
          {activeSection === "operations" &&
            activeSubTab === "conversations" && (
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      💬 Booking Conversations
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Read-only view of all customer ↔ provider chats.{" "}
                      <span className="text-gray-400 text-xs">
                        ({conversationsTotal} total)
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => void loadConversations(conversationsPage)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
                  >
                    <RefreshCcw size={14} /> Refresh
                  </button>
                </div>

                {conversationsLoading ? (
                  <div className="text-gray-600 py-8 text-center">
                    Loading conversations...
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-sm">
                    No chat conversations yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((c) => (
                      <button
                        key={String(c.booking_id)}
                        onClick={() => {
                          const label = `${c.customer?.full_name || "Customer"} ↔ ${c.provider?.full_name || "Provider"}`;
                          void openAdminConversation(c.booking_id, label);
                        }}
                        className="w-full text-left rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-900 text-sm">
                                {c.customer?.full_name || "Customer"}
                              </span>
                              <span className="text-gray-400 text-xs">↔</span>
                              <span className="font-semibold text-gray-900 text-sm">
                                {c.provider?.full_name || "Provider"}
                              </span>
                              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                {c.message_count} messages
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 truncate">
                              "{c.last_message}"
                            </div>
                            <div className="text-xs text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                              <span>
                                📅 Booking {c.booking?.date || ""} ·{" "}
                                {c.booking?.status}
                              </span>
                              <span>last reply: {timeAgo(c.last_at)}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                    <Pagination
                      page={conversationsPage}
                      totalPages={conversationsTotalPages}
                      onPageChange={(p) => setConversationsPage(p)}
                    />
                  </div>
                )}

                {/* Conversation view modal */}
                {selectedConvMessages !== null && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                      className="absolute inset-0 bg-black/40"
                      onClick={() => setSelectedConvMessages(null)}
                    />
                    <div className="relative w-full max-w-lg h-[600px] max-h-[85vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50">
                        <div>
                          <h3 className="font-bold text-gray-900">
                            {selectedConvLabel}
                          </h3>
                          <p className="text-xs text-gray-500">
                            Admin read-only view
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedConvMessages(null)}
                          className="p-1.5 rounded-lg hover:bg-white/60"
                          title="Close conversation"
                          aria-label="Close conversation"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                        {selectedConvLoading ? (
                          <div className="text-center text-gray-400 text-sm py-10">
                            Loading...
                          </div>
                        ) : selectedConvMessages.length === 0 ? (
                          <div className="text-center text-gray-400 text-sm py-10">
                            No messages
                          </div>
                        ) : (
                          selectedConvMessages.map((m: any) => (
                            <div
                              key={m._id}
                              className="rounded-2xl bg-white border border-gray-200 px-4 py-3"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-gray-700">
                                  {m.sender_id?.full_name || "User"}
                                  <span className="ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase">
                                    {m.sender_id?.role || ""}
                                  </span>
                                </span>
                                <span className="text-[11px] text-gray-400">
                                  {new Date(m.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                                {m.body}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* ═══════════ CATALOG SECTION ═══════════ */}
          {activeSection === "catalog" && activeSubTab === "services" && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Services Management
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Enable/disable services.{" "}
                    <span className="text-gray-400 text-xs">
                      ({servicesTotal} total)
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      void loadAllServices(servicesPage, serviceSearch)
                    }
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <RefreshCcw size={16} /> Refresh
                  </button>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Search services..."
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
              {servicesError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {servicesError}
                </div>
              )}
              {servicesLoading ? (
                <div className="text-gray-600">Loading...</div>
              ) : allServices.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No services.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {[
                          "Service",
                          "Provider",
                          "Category",
                          "Price",
                          "Status",
                          "Action",
                        ].map((h, i) => (
                          <th
                            key={h}
                            className={`py-3 px-4 text-sm font-semibold text-gray-700 ${i === 5 ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allServices.map((s) => (
                        <tr
                          key={s._id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {s.service_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {s.description || "—"}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            <div>{s.provider_id?.full_name || "—"}</div>
                            <div className="text-xs text-gray-500">
                              {s.provider_id?.email || ""}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {s.category_id?.category_name || "—"}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            <div className="font-semibold">
                              ${Number(s.price || 0).toFixed(2)}
                              {s.pricing_type === "hourly" ? "/hr" : ""}
                            </div>
                            <div className="text-xs text-gray-500">
                              {s.pricing_type === "hourly"
                                ? "⏱️ Hourly"
                                : "💰 Fixed"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                            >
                              {s.is_active ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end">
                              <button
                                onClick={() => void toggleService(s._id)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${s.is_active ? "border border-red-200 text-red-600 hover:bg-red-50" : "border border-green-200 text-green-600 hover:bg-green-50"}`}
                              >
                                {s.is_active ? "Disable" : "Enable"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    page={servicesPage}
                    totalPages={servicesTotalPages}
                    onPageChange={(p) => setServicesPage(p)}
                  />
                </div>
              )}
            </div>
          )}

          {activeSection === "catalog" && activeSubTab === "categories" && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Service Categories
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage categories.{" "}
                    <span className="text-gray-400 text-xs">
                      ({catTotal} total)
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void loadCategories(catPage, catSearch)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <RefreshCcw size={16} /> Refresh
                  </button>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Search categories..."
                      value={catSearch}
                      onChange={(e) => setCatSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
              {catError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {catError}
                </div>
              )}
              <div className="space-y-3 mb-6">
                <div className="flex gap-3 flex-wrap">
                  <input
                    type="text"
                    placeholder="Category name"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-4 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Icon (optional)"
                    value={newCatIcon}
                    onChange={(e) => setNewCatIcon(e.target.value)}
                    className="w-36 border border-gray-300 rounded-lg px-4 py-2"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">
                      Min $
                    </span>
                    <input
                      type="number"
                      placeholder="0"
                      value={newCatMinPrice}
                      onChange={(e) => setNewCatMinPrice(e.target.value)}
                      className="w-24 border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">
                      Max $
                    </span>
                    <input
                      type="number"
                      placeholder="9999"
                      value={newCatMaxPrice}
                      onChange={(e) => setNewCatMaxPrice(e.target.value)}
                      className="w-24 border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2">
                    <span className="text-sm font-semibold text-gray-700">
                      Allow:
                    </span>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCatAllowFixed}
                        onChange={(e) => setNewCatAllowFixed(e.target.checked)}
                        className="rounded"
                      />
                      💰 Fixed
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCatAllowHourly}
                        onChange={(e) => setNewCatAllowHourly(e.target.checked)}
                        className="rounded"
                      />
                      ⏱️ Hourly
                    </label>
                  </div>
                  <button
                    onClick={() => void createCategory()}
                    disabled={catSaving}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  >
                    {catSaving ? "Adding..." : "+ Add Category"}
                  </button>
                </div>
              </div>
              {catLoading ? (
                <div className="text-gray-600">Loading...</div>
              ) : categories.length === 0 ? (
                <div className="text-gray-500 py-8 text-center">
                  No categories yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {[
                          "Name",
                          "Icon",
                          "Price Range",
                          "Pricing",
                          "Status",
                          "Actions",
                        ].map((h, i) => (
                          <th
                            key={h}
                            className={`py-3 px-4 text-sm font-semibold text-gray-700 ${i === 5 ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr
                          key={cat._id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">
                            {editCatId === cat._id ? (
                              <input
                                value={editCatName}
                                onChange={(e) => setEditCatName(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-1.5 w-full max-w-xs"
                                autoFocus
                              />
                            ) : (
                              <span className="font-medium text-gray-900">
                                {cat.category_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {cat.icon || "—"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            ${cat.min_price ?? 0} — ${cat.max_price ?? 9999}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1 flex-wrap">
                              {(
                                cat.allowed_pricing_types || ["fixed", "hourly"]
                              ).map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-semibold"
                                >
                                  {t === "hourly" ? "⏱️ Hourly" : "💰 Fixed"}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cat.is_active !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                            >
                              {cat.is_active !== false ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end gap-2">
                              {editCatId === cat._id ? (
                                <>
                                  <button
                                    onClick={() => void updateCategory(cat._id)}
                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditCatId(null);
                                      setEditCatName("");
                                    }}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditCatId(cat._id);
                                      setEditCatName(cat.category_name);
                                    }}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => void toggleCategory(cat._id)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${cat.is_active !== false ? "border border-red-200 text-red-600 hover:bg-red-50" : "border border-green-200 text-green-600 hover:bg-green-50"}`}
                                  >
                                    {cat.is_active !== false
                                      ? "Disable"
                                      : "Enable"}
                                  </button>
                                  <button
                                    onClick={() => void deleteCategory(cat._id)}
                                    className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    page={catPage}
                    totalPages={catTotalPages}
                    onPageChange={(p) => setCatPage(p)}
                  />
                </div>
              )}
            </div>
          )}

          {activeSection === "catalog" && activeSubTab === "reviews" && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Customer Reviews
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    All customer reviews.{" "}
                    <span className="text-gray-400 text-xs">
                      ({reviewsTotal} total)
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void loadReviews(reviewsPage, reviewsSearch)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <RefreshCcw size={16} /> Refresh
                  </button>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Search reviews..."
                      value={reviewsSearch}
                      onChange={(e) => setReviewsSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
              {reviewsError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {reviewsError}
                </div>
              )}
              {reviewsLoading ? (
                <div className="text-gray-600">Loading...</div>
              ) : reviews.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No reviews yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {[
                          "Customer",
                          "Provider",
                          "Rating",
                          "Comment",
                          "Status",
                          "Actions",
                        ].map((h, i) => (
                          <th
                            key={h}
                            className={`py-3 px-4 text-sm font-semibold text-gray-700 ${i === 5 ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map((r) => (
                        <tr
                          key={r._id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {r.customer_id?.full_name || "—"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {r.customer_id?.email || ""}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {r.provider_id?.full_name || "—"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {r.provider_id?.email || ""}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <span
                                  key={s}
                                  className={
                                    s <= r.rating
                                      ? "text-yellow-400"
                                      : "text-gray-300"
                                  }
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {r.rating}/5
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 max-w-xs">
                            {r.comment || "—"}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${r.is_visible ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                            >
                              {r.is_visible ? "Visible" : "Hidden"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => void toggleReview(r._id)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${r.is_visible ? "border border-orange-200 text-orange-600 hover:bg-orange-50" : "border border-green-200 text-green-600 hover:bg-green-50"}`}
                              >
                                {r.is_visible ? "Hide" : "Show"}
                              </button>
                              <button
                                onClick={() => void deleteReview(r._id)}
                                className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    page={reviewsPage}
                    totalPages={reviewsTotalPages}
                    onPageChange={(p) => setReviewsPage(p)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ═══════════ REPORTS SECTION (Commission Report) ═══════════ */}
          {activeSection === "reports" && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      💰 Commission & Revenue Report
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Full financial breakdown — Gross → Provider Payout →
                      Commission → Cashback → Net Revenue
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="date"
                      value={commissionFrom}
                      onChange={(e) => setCommissionFrom(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <span className="text-gray-500 text-sm">to</span>
                    <input
                      type="date"
                      value={commissionTo}
                      onChange={(e) => setCommissionTo(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => void loadCommissionReport()}
                      disabled={commissionLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                    >
                      <RefreshCcw size={14} />{" "}
                      {commissionLoading ? "Loading..." : "Generate Report"}
                    </button>
                  </div>
                </div>
              </div>

              {commissionReport && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-6 border-b border-gray-100">
                    {[
                      {
                        label: "Gross Revenue",
                        value: `$${Number(commissionReport.summary.grossRevenue).toLocaleString()}`,
                        color: "bg-blue-50 text-blue-700",
                        icon: "💵",
                      },
                      {
                        label: "Provider Payout",
                        value: `$${Number(commissionReport.summary.totalProviderPayout).toLocaleString()}`,
                        color: "bg-green-50 text-green-700",
                        icon: "🏠",
                      },
                      {
                        label: "Commission",
                        value: `$${Number(commissionReport.summary.totalPlatformCommission).toLocaleString()}`,
                        color: "bg-purple-50 text-purple-700",
                        icon: "🏦",
                      },
                      {
                        label: "Cashback",
                        value: `$${Number(commissionReport.summary.totalCashback).toLocaleString()}`,
                        color: "bg-orange-50 text-orange-700",
                        icon: "🎁",
                      },
                      {
                        label: "Net Revenue",
                        value: `$${Number(commissionReport.summary.netRevenue).toLocaleString()}`,
                        color: "bg-emerald-50 text-emerald-700",
                        icon: "📈",
                      },
                      {
                        label: "Avg Rate",
                        value: `${commissionReport.summary.avgCommissionRate}%`,
                        color: "bg-gray-50 text-gray-700",
                        icon: "📊",
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className={`rounded-xl p-4 ${card.color}`}
                      >
                        <div className="text-2xl mb-1">{card.icon}</div>
                        <div className="text-xs font-semibold opacity-70 mb-1">
                          {card.label}
                        </div>
                        <div className="text-lg font-bold">{card.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 p-4 border-b border-gray-100 flex-wrap">
                    {(
                      [
                        "overview",
                        "monthly",
                        "category",
                        "providers",
                        "customers",
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setCommissionTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition ${commissionTab === tab ? "bg-[#2563EB] text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      >
                        {tab === "overview"
                          ? "📊 Overview"
                          : tab === "monthly"
                            ? "📅 Monthly"
                            : tab === "category"
                              ? "🏷️ Category"
                              : tab === "providers"
                                ? "👷 Providers"
                                : "👥 Customers"}
                      </button>
                    ))}
                  </div>

                  <div className="p-6">
                    {commissionTab === "overview" && (
                      <div className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-4">
                              Revenue Breakdown
                            </h4>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart
                                data={[
                                  {
                                    name: "💵 Gross",
                                    value: Number(
                                      commissionReport.summary.grossRevenue,
                                    ),
                                    fill: "#3B82F6",
                                  },
                                  {
                                    name: "🏠 Payout",
                                    value: Number(
                                      commissionReport.summary
                                        .totalProviderPayout,
                                    ),
                                    fill: "#10B981",
                                  },
                                  {
                                    name: "🏦 Commission",
                                    value: Number(
                                      commissionReport.summary
                                        .totalPlatformCommission,
                                    ),
                                    fill: "#8B5CF6",
                                  },
                                  {
                                    name: "🎁 Cashback",
                                    value: Number(
                                      commissionReport.summary.totalCashback,
                                    ),
                                    fill: "#F97316",
                                  },
                                  {
                                    name: "📈 Net",
                                    value: Number(
                                      commissionReport.summary.netRevenue,
                                    ),
                                    fill: "#059669",
                                  },
                                ]}
                                layout="vertical"
                                margin={{
                                  top: 5,
                                  right: 60,
                                  left: 20,
                                  bottom: 5,
                                }}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#f0f0f0"
                                />
                                <XAxis
                                  type="number"
                                  tickFormatter={(v) =>
                                    `$${v.toLocaleString()}`
                                  }
                                  stroke="#9CA3AF"
                                  fontSize={12}
                                />
                                <YAxis
                                  type="category"
                                  dataKey="name"
                                  width={120}
                                  stroke="#374151"
                                  fontSize={13}
                                  tick={{ fontWeight: 600 }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#fff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "12px",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                  }}
                                  formatter={(value: any) => [
                                    `$${Number(value).toLocaleString()}`,
                                    "Amount",
                                  ]}
                                />
                                <Bar
                                  dataKey="value"
                                  radius={[0, 8, 8, 0]}
                                  label={{
                                    position: "right",
                                    formatter: (value: any) =>
                                      `$${Number(value).toLocaleString()}`,
                                    fill: "#374151",
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  {[
                                    "#3B82F6",
                                    "#10B981",
                                    "#8B5CF6",
                                    "#F97316",
                                    "#059669",
                                  ].map((color, i) => (
                                    <Cell key={i} fill={color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>

                            {/* Visual breakdown summary */}
                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                                <div className="w-3 h-3 rounded bg-blue-500"></div>
                                <span className="font-semibold text-gray-700">
                                  Gross Revenue
                                </span>
                                <span className="ml-auto font-bold text-blue-700">
                                  $
                                  {Number(
                                    commissionReport.summary.grossRevenue,
                                  ).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                                <div className="w-3 h-3 rounded bg-green-500"></div>
                                <span className="font-semibold text-gray-700">
                                  Provider Payout
                                </span>
                                <span className="ml-auto font-bold text-green-700">
                                  $
                                  {Number(
                                    commissionReport.summary
                                      .totalProviderPayout,
                                  ).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg">
                                <div className="w-3 h-3 rounded bg-purple-500"></div>
                                <span className="font-semibold text-gray-700">
                                  Commission
                                </span>
                                <span className="ml-auto font-bold text-purple-700">
                                  $
                                  {Number(
                                    commissionReport.summary
                                      .totalPlatformCommission,
                                  ).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg">
                                <div className="w-3 h-3 rounded bg-orange-500"></div>
                                <span className="font-semibold text-gray-700">
                                  Cashback Given
                                </span>
                                <span className="ml-auto font-bold text-orange-700">
                                  $
                                  {Number(
                                    commissionReport.summary.totalCashback,
                                  ).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg col-span-2 border-2 border-emerald-200">
                                <div className="w-3 h-3 rounded bg-emerald-600"></div>
                                <span className="font-bold text-gray-900">
                                  📈 Net Revenue (Profit)
                                </span>
                                <span className="ml-auto font-bold text-emerald-700 text-base">
                                  $
                                  {Number(
                                    commissionReport.summary.netRevenue,
                                  ).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-4">
                              Commission Strategy (Per Provider)
                            </h4>
                            <div className="space-y-2">
                              {[
                                {
                                  tier: "🔥 Hot",
                                  jobs: "20+ jobs",
                                  rate: "22%",
                                },
                                {
                                  tier: "⚡ Active",
                                  jobs: "10-19 jobs",
                                  rate: "18%",
                                },
                                {
                                  tier: "✅ Regular",
                                  jobs: "5-9 jobs",
                                  rate: "15%",
                                },
                                {
                                  tier: "🌱 Slow",
                                  jobs: "1-4 jobs",
                                  rate: "10%",
                                },
                                { tier: "🆕 New", jobs: "0 jobs", rate: "8%" },
                              ].map((s) => (
                                <div
                                  key={s.tier}
                                  className="rounded-xl border border-gray-200 p-3 flex justify-between items-center"
                                >
                                  <div>
                                    <span className="font-semibold text-gray-900">
                                      {s.tier}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      ({s.jobs})
                                    </span>
                                  </div>
                                  <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold">
                                    {s.rate}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        {commissionReport.tierDistribution && (
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-4">
                              Provider Tier Distribution
                            </h4>
                            <ResponsiveContainer width="100%" height={250}>
                              <BarChart
                                data={Object.entries(
                                  commissionReport.tierDistribution,
                                ).map(([tier, count]) => ({ tier, count }))}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="tier" />
                                <YAxis />
                                <Tooltip />
                                <Bar
                                  dataKey="count"
                                  fill="#8B5CF6"
                                  radius={[4, 4, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    )}

                    {commissionTab === "monthly" && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-4">
                          Monthly Revenue Breakdown
                        </h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={commissionReport.monthlyBreakdown}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#f0f0f0"
                            />
                            <XAxis dataKey="month" stroke="#666" />
                            <YAxis stroke="#666" />
                            <Tooltip />
                            <Bar
                              dataKey="gross"
                              name="Gross"
                              fill="#3B82F6"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="commission"
                              name="Commission"
                              fill="#8B5CF6"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="payout"
                              name="Payout"
                              fill="#10B981"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-6 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                {[
                                  "Month",
                                  "Bookings",
                                  "Gross",
                                  "Commission",
                                  "Payout",
                                ].map((h) => (
                                  <th
                                    key={h}
                                    className="text-left py-2 px-3 font-semibold text-gray-600"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {commissionReport.monthlyBreakdown.map(
                                (row: any) => (
                                  <tr
                                    key={row.month}
                                    className="border-b border-gray-100 hover:bg-gray-50"
                                  >
                                    <td className="py-2 px-3 font-medium">
                                      {row.month}
                                    </td>
                                    <td className="py-2 px-3">
                                      {row.bookings}
                                    </td>
                                    <td className="py-2 px-3 text-blue-700 font-semibold">
                                      ${row.gross?.toFixed(0)}
                                    </td>
                                    <td className="py-2 px-3 text-purple-700 font-semibold">
                                      ${row.commission?.toFixed(0)}
                                    </td>
                                    <td className="py-2 px-3 text-green-700 font-semibold">
                                      ${row.payout?.toFixed(0)}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {commissionTab === "category" && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-4">
                          Revenue by Service Category
                        </h4>
                        <div className="grid md:grid-cols-2 gap-6">
                          <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                              <Pie
                                data={commissionReport.categoryBreakdown}
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                dataKey="gross"
                                label={({ category, gross }) =>
                                  `${category}: $${Number(gross).toFixed(0)}`
                                }
                              >
                                {commissionReport.categoryBreakdown.map(
                                  (_: any, i: number) => (
                                    <Cell
                                      key={i}
                                      fill={
                                        [
                                          "#2563EB",
                                          "#7C3AED",
                                          "#059669",
                                          "#D97706",
                                          "#DC2626",
                                          "#0891B2",
                                          "#9333EA",
                                          "#16A34A",
                                        ][i % 8]
                                      }
                                    />
                                  ),
                                )}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  {[
                                    "Category",
                                    "Bookings",
                                    "Gross",
                                    "Commission",
                                  ].map((h) => (
                                    <th
                                      key={h}
                                      className="text-left py-2 px-3 font-semibold text-gray-600"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {commissionReport.categoryBreakdown.map(
                                  (row: any) => (
                                    <tr
                                      key={row.category}
                                      className="border-b border-gray-100 hover:bg-gray-50"
                                    >
                                      <td className="py-2 px-3 font-medium">
                                        {row.category}
                                      </td>
                                      <td className="py-2 px-3">
                                        {row.bookings}
                                      </td>
                                      <td className="py-2 px-3 text-blue-700 font-semibold">
                                        ${row.gross?.toFixed(0)}
                                      </td>
                                      <td className="py-2 px-3 text-purple-700 font-semibold">
                                        ${row.commission?.toFixed(0)}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {commissionTab === "providers" && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-4">
                          Top 10 Providers by Revenue
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                {[
                                  "Provider",
                                  "Tier",
                                  "Rate",
                                  "Bookings",
                                  "Gross",
                                  "Commission",
                                  "Payout",
                                ].map((h) => (
                                  <th
                                    key={h}
                                    className="text-left py-2 px-3 font-semibold text-gray-600"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {commissionReport.providerBreakdown.map(
                                (row: any, i: number) => (
                                  <tr
                                    key={row.provider}
                                    className="border-b border-gray-100 hover:bg-gray-50"
                                  >
                                    <td className="py-2 px-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-400 text-xs">
                                          #{i + 1}
                                        </span>
                                        <span className="font-medium">
                                          {row.provider}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                        {row.tier}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                        {row.rate}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3">
                                      {row.bookings}
                                    </td>
                                    <td className="py-2 px-3 text-blue-700 font-semibold">
                                      ${row.gross?.toFixed(0)}
                                    </td>
                                    <td className="py-2 px-3 text-purple-700">
                                      ${row.commission?.toFixed(0)}
                                    </td>
                                    <td className="py-2 px-3 text-green-700 font-semibold">
                                      ${row.payout?.toFixed(0)}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {commissionTab === "customers" && (
                      <div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          {[
                            {
                              tier: "New 🥉",
                              desc: "First booking — 10% off",
                              color: "bg-gray-50 border-gray-200",
                            },
                            {
                              tier: "Regular 🥈",
                              desc: "5+ bookings — 7% off",
                              color: "bg-blue-50 border-blue-200",
                            },
                            {
                              tier: "VIP 🥇",
                              desc: "$500+ — 5% cashback",
                              color: "bg-yellow-50 border-yellow-200",
                            },
                            {
                              tier: "Champion 💎",
                              desc: "$2000+ — 8% cashback",
                              color: "bg-purple-50 border-purple-200",
                            },
                          ].map((t) => (
                            <div
                              key={t.tier}
                              className={`rounded-xl border p-4 ${t.color}`}
                            >
                              <div className="font-bold text-gray-900">
                                {t.tier}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {t.desc}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                {[
                                  "Customer",
                                  "Tier",
                                  "Bookings",
                                  "Spent",
                                  "Discount",
                                  "Cashback",
                                ].map((h) => (
                                  <th
                                    key={h}
                                    className="text-left py-2 px-3 font-semibold text-gray-600"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {commissionReport.customerReport.map(
                                (row: any) => (
                                  <tr
                                    key={row.email}
                                    className="border-b border-gray-100 hover:bg-gray-50"
                                  >
                                    <td className="py-2 px-3">
                                      <div className="font-medium">
                                        {row.name}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {row.email}
                                      </div>
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                        {row.tier}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3">
                                      {row.bookings}
                                    </td>
                                    <td className="py-2 px-3 font-semibold text-gray-900">
                                      ${row.totalSpent?.toFixed(0)}
                                    </td>
                                    <td className="py-2 px-3 text-green-700 font-semibold">
                                      {row.discount}
                                    </td>
                                    <td className="py-2 px-3 text-orange-700 font-semibold">
                                      ${row.cashbackEarned}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {!commissionReport && !commissionLoading && (
                <div className="p-12 text-center text-gray-500">
                  Click "Generate Report" to load financial breakdown
                </div>
              )}
              {commissionLoading && (
                <div className="p-12 text-center text-gray-500">
                  ⏳ Generating report...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── EXPORT MODAL ─── */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !exportBusy && setExportOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-gray-200">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Download size={20} /> Export Full Report
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Includes summary, bookings, payments, users, services, and
                  reviews — all in one CSV file.
                </p>
              </div>
              <button
                onClick={() => !exportBusy && setExportOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                disabled={exportBusy}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Time Range
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "all", label: "All Time" },
                    { id: "7d", label: "Last 7 Days" },
                    { id: "30d", label: "Last 30 Days" },
                    { id: "90d", label: "Last 90 Days" },
                    { id: "year", label: "Last Year" },
                    { id: "custom", label: "Custom" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p.id as any)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                        exportPreset === p.id
                          ? "bg-[#2563EB] text-white border-[#2563EB]"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {exportPreset !== "all" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      From
                    </label>
                    <input
                      type="date"
                      value={exportFrom}
                      onChange={(e) => {
                        setExportFrom(e.target.value);
                        setExportPreset("custom");
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      To
                    </label>
                    <input
                      type="date"
                      value={exportTo}
                      onChange={(e) => {
                        setExportTo(e.target.value);
                        setExportPreset("custom");
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
                📋 The exported file will contain <b>6 sections</b>: Summary,
                Bookings, Payments, Users, Services, Reviews — filtered by your
                selected range.
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setExportOpen(false)}
                disabled={exportBusy}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleFullExport()}
                disabled={exportBusy}
                className="px-5 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
              >
                {exportBusy ? (
                  "Generating..."
                ) : (
                  <>
                    <Download size={14} /> Download Full Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
