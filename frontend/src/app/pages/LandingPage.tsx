import { Link, useNavigate } from "react-router";
import {
  Search,
  Wrench,
  Zap,
  Sparkles,
  Home,
  Hammer,
  CheckCircle,
  Star,
  MapPin,
  Paintbrush,
  TreePine,
  Scissors,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuthStore } from "../auth.store";

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  "http://localhost:5001";

function LandingHeader() {
  const user = useAuthStore((s) => s.me);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

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

  if (!user) {
    return (
      <>
        <Link to="/login" className="text-gray-600 hover:text-gray-900">
          Login
        </Link>
        <Link
          to="/signup"
          className="bg-[#2563EB] text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sign Up
        </Link>
      </>
    );
  }

  const displayName = user.full_name?.trim() || user.email;
  const dashboardUrl =
    user.role === "provider"
      ? "/provider/dashboard"
      : user.role === "admin"
        ? "/admin/dashboard"
        : "/customer/dashboard";
  const dashboardLabel =
    user.role === "provider"
      ? "Provider Dashboard"
      : user.role === "admin"
        ? "Admin Dashboard"
        : "My Bookings";

  return (
    <>
      {user.role === "admin" ? (
        <>
          <Link
            to="/provider/dashboard"
            className="text-gray-600 hover:text-gray-900 hidden sm:block"
          >
            Provider Dashboard
          </Link>
          <Link
            to="/customer/dashboard"
            className="text-gray-600 hover:text-gray-900 hidden sm:block"
          >
            Customer Dashboard
          </Link>
          <Link
            to="/admin/dashboard"
            className="text-gray-600 hover:text-gray-900 hidden sm:block"
          >
            Admin Dashboard
          </Link>
        </>
      ) : (
        <Link
          to={dashboardUrl}
          className="text-gray-600 hover:text-gray-900 hidden sm:block"
        >
          {dashboardLabel}
        </Link>
      )}
      <span className="text-gray-700 hidden sm:block">
        Hi, <span className="font-semibold">{displayName}</span>
      </span>
      <button
        onClick={logout}
        className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
      >
        Logout
      </button>
    </>
  );
}

const STATIC_ICONS: Record<string, any> = {
  plumbing: Wrench,
  electrical: Zap,
  cleaning: Sparkles,
  appliance: Home,
  handyman: Hammer,
  carpent: Scissors,
  painting: Paintbrush,
  landscap: TreePine,
  grass: TreePine,
  garden: TreePine,
  repair: Wrench,
  roofing: Home,
  flooring: Home,
};

function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  for (const key of Object.keys(STATIC_ICONS)) {
    if (lower.includes(key)) return STATIC_ICONS[key];
  }
  return Wrench;
}

// ──────────────────────────────────────────────────────────
// Modal Component for Terms / Privacy
// ──────────────────────────────────────────────────────────
function LegalModal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-6 py-6 text-gray-700 text-sm leading-relaxed">
              {children}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end rounded-b-2xl bg-gray-50">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LandingPage() {
  const [searchService, setSearchService] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [categories, setCategories] = useState<
    {
      _id: string;
      category_name: string;
      icon?: string;
      booking_count?: number;
    }[]
  >([]);
  const navigate = useNavigate();
  const [topProviders, setTopProviders] = useState<any[]>([]);
  const [realReviews, setRealReviews] = useState<any[]>([]);
  const [totalProviders, setTotalProviders] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const user = useAuthStore((s) => s.me);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const [locationValue, setLocationValue] = useState("");

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("guest") === "1") return; // explicit guest mode

    const alreadyRedirected = sessionStorage.getItem("fixora_redirected");
    if (alreadyRedirected) return;

    sessionStorage.setItem("fixora_redirected", "1");

    if (user.role === "customer") {
      navigate("/customer/dashboard", { replace: true });
    } else if (user.role === "provider") {
      navigate("/provider/dashboard", { replace: true });
    } else if (user.role === "admin") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    fetch(`${API_BASE}/api/categories?sort=popular`)
      .then((r) => r.json())
      .then((d) =>
        setCategories(
          (d.categories || [])
            .filter((c: any) => c.is_active !== false)
            .map((c: any) => ({
              _id: c._id,
              category_name: c.category_name,
              icon: c.icon || "",
              booking_count: c.booking_count || 0,
            }))
            .sort(
              (a: any, b: any) =>
                (b.booking_count || 0) - (a.booking_count || 0) ||
                a.category_name.localeCompare(b.category_name),
            ),
        ),
      )
      .catch(() => {});
    fetch(`${API_BASE}/api/services`)
      .then((r) => r.json())
      .then((d) => {
        const services = d.services || [];
        const providerMap = new Map<string, any>();
        services.forEach((s: any) => {
          const p = s.provider_id;
          if (!p || !p._id) return;
          const pid = String(p._id);
          if (!providerMap.has(pid)) {
            providerMap.set(pid, {
              _id: pid,
              name: p.full_name || "Provider",
              title: s.service_name || "Service Professional",
              rating: Number(p.provider_profile?.rating_avg || 0),
              reviews: Number(p.provider_profile?.rating_count || 0),
              initials: (p.full_name || "P")
                .split(" ")
                .filter(Boolean)
                .map((w: string) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase(),
            });
          }
        });
        setTotalProviders(providerMap.size);
        const sorted = Array.from(providerMap.values())
          .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
          .slice(0, 3);
        setTopProviders(sorted);
      })
      .catch(() => {});

    // Load real reviews
    fetch(`${API_BASE}/api/reviews?page=1`)
      .then((r) => r.json())
      .then((d) => {
        const reviews = (d.reviews || [])
          .filter((r: any) => r.is_visible !== false && r.comment)
          .slice(0, 3);
        setRealReviews(reviews);
        setTotalReviews(d.total || 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!locationInputRef.current) return;
    const win = window as any;
    if (!win.google?.maps?.places) return;

    const autocomplete = new win.google.maps.places.Autocomplete(
      locationInputRef.current,
      {
        componentRestrictions: { country: "us" },
        types: ["address"],
      },
    );

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      setLocationValue(place.formatted_address || "");
    });
  }, []);

  const howItWorks =
    user?.role === "provider"
      ? [
          {
            step: "1",
            title: "Complete Your Profile",
            description:
              "Add your skills, experience and availability to get started",
          },
          {
            step: "2",
            title: "Get Job Requests",
            description: "Customers will find and book your services directly",
          },
          {
            step: "3",
            title: "Complete & Earn",
            description:
              "Deliver great service, get paid and build your reputation",
          },
        ]
      : [
          {
            step: "1",
            title: "Search & Select",
            description: "Browse verified professionals in your area",
          },
          {
            step: "2",
            title: "Book Instantly",
            description: "Choose a time slot and confirm your booking",
          },
          {
            step: "3",
            title: "Get It Done",
            description: "Professional service delivered at your doorstep",
          },
        ];

  const fallbackCategories = [
    { name: "Plumbing", Icon: Wrench },
    { name: "Electrical", Icon: Zap },
    { name: "Cleaning", Icon: Sparkles },
    { name: "Appliance Repair", Icon: Home },
    { name: "Handyman", Icon: Hammer },
  ];

  const fallbackProviders = [
    {
      name: "John Smith",
      title: "Plumbing Expert",
      rating: 4.9,
      reviews: 127,
      initials: "JS",
    },
    {
      name: "Sarah Johnson",
      title: "Electrical Specialist",
      rating: 4.8,
      reviews: 98,
      initials: "SJ",
    },
    {
      name: "Michael Chen",
      title: "Cleaning Professional",
      rating: 5.0,
      reviews: 215,
      initials: "MC",
    },
  ];

  const fallbackReviews = [
    {
      name: "Sarah Johnson",
      role: "Homeowner",
      rating: 5,
      text: "Found an amazing plumber within minutes! The booking process was seamless and the service was top-notch.",
      initials: "SJ",
    },
    {
      name: "Michael Chen",
      role: "Property Manager",
      rating: 5,
      text: "Fixora has become our go-to platform for all property maintenance needs. Reliable and professional every time.",
      initials: "MC",
    },
    {
      name: "Emily Rodriguez",
      role: "Business Owner",
      rating: 5,
      text: "The quality of service providers on Fixora is exceptional. Saved us so much time and hassle!",
      initials: "ER",
    },
  ];

  const displayProviders =
    topProviders.length > 0 ? topProviders : fallbackProviders;
  const displayReviews = realReviews.length > 0 ? realReviews : fallbackReviews;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="border-b border-gray-200"
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">
                Fixora
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/services"
                className="text-gray-600 hover:text-gray-900 hidden sm:block"
              >
                Browse Services
              </Link>
              <LandingHeader />
            </div>
          </div>
        </nav>
      </motion.header>

      {/* Hero Section */}
      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6"
            >
              Book Trusted Home Services Instantly
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg sm:text-xl text-gray-600 mb-8"
            >
              Connect with verified local professionals for all your home
              service needs
            </motion.p>

            {/* Stats */}
            {totalProviders > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex justify-center gap-8 mb-10"
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#2563EB]">
                    {totalProviders}+
                  </div>
                  <div className="text-sm text-gray-500">
                    Verified Providers
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#2563EB]">
                    {totalReviews}+
                  </div>
                  <div className="text-sm text-gray-500">Customer Reviews</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#2563EB]">
                    {categories.length}+
                  </div>
                  <div className="text-sm text-gray-500">
                    Service Categories
                  </div>
                </div>
              </motion.div>
            )}

            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 max-w-4xl mx-auto shadow-sm"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    size={20}
                  />
                  <input
                    type="text"
                    placeholder="What service do you need?"
                    value={searchService}
                    onChange={(e) => setSearchService(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  />
                </div>
                <div className="flex-1 relative">
                  <MapPin
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10"
                    size={20}
                  />
                  <input
                    ref={locationInputRef}
                    type="text"
                    placeholder="Your location"
                    value={locationValue}
                    onChange={(e) => setLocationValue(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  />
                </div>
                <Link
                  to={(() => {
                    const params = new URLSearchParams();
                    if (searchService) params.set("search", searchService);
                    if (locationValue) params.set("location", locationValue);
                    const qs = params.toString();
                    return `/services${qs ? `?${qs}` : ""}`;
                  })()}
                  className="bg-[#2563EB] text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  Search
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Service Categories — Real Data */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12"
          >
            Popular Services
          </motion.h2>

          <div
            className={`grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 ${categories.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
          >
            {(categories.length > 0
              ? categories
              : fallbackCategories.map((c) => ({
                  _id: c.name,
                  category_name: c.name,
                  icon: "",
                }))
            ).map((category, index) => {
              const Icon = getCategoryIcon(category.category_name);
              return (
                <motion.div
                  key={category._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Link
                    to={`/services?category=${encodeURIComponent(category.category_name)}`}
                    className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#2563EB] transition-all group block h-full"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors"
                    >
                      {(() => {
                        const IconComponent = getCategoryIcon(
                          category.category_name,
                        );
                        return (
                          <IconComponent size={24} className="text-[#2563EB]" />
                        );
                      })()}
                    </motion.div>
                    <h3 className="font-semibold text-gray-900">
                      {category.category_name}
                    </h3>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12"
          >
            How It Works
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {howItWorks.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="text-center"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="w-16 h-16 bg-[#2563EB] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4"
                >
                  {item.step}
                </motion.div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600">{item.description}</p>
              </motion.div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-center mt-12"
          >
            {(!user || user.role === "provider") && (
              <Link
                to={user ? "/provider/dashboard" : "/signup"}
                className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <CheckCircle size={20} />
                Become a Service Provider
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Top Rated Providers — Real Data */}
      {(!user || user.role === "customer") && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4"
            >
              Top Rated Providers
            </motion.h2>
            <p className="text-center text-gray-600 mb-12">
              Trusted professionals with verified reviews
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {displayProviders.map((provider, index) => (
                <motion.div
                  key={provider._id || index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#2563EB] hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-[#2563EB] rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {provider.initials}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">
                        {provider.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {provider.title}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span
                          key={s}
                          className={`text-lg ${s <= Math.round(provider.rating) ? "text-yellow-400" : "text-gray-300"}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="font-bold text-gray-900">
                      {provider.rating > 0
                        ? Number(provider.rating).toFixed(1)
                        : "New"}
                    </span>
                    <span className="text-gray-500 text-sm">
                      ({provider.reviews} reviews)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>✅ Verified Provider</span>
                    <Link
                      to="/services"
                      className="text-[#2563EB] font-semibold hover:underline"
                    >
                      Book Now →
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials — Real Reviews */}
      {(!user || user.role === "customer") && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12"
            >
              What Our Customers Say
            </motion.h2>
            <div className="grid md:grid-cols-3 gap-8">
              {displayReviews.map((review: any, index: number) => {
                const isReal = !!review.customer_id;
                const name = isReal
                  ? review.customer_id?.full_name || "Customer"
                  : review.name;
                const role = isReal
                  ? review.service_id?.service_name || "Customer"
                  : review.role;
                const rating = isReal ? review.rating : review.rating;
                const text = isReal ? review.comment : review.text;
                const initials =
                  name
                    .split(" ")
                    .filter(Boolean)
                    .map((w: string) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || (isReal ? "" : review.initials);

                return (
                  <motion.div
                    key={review._id || index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.2 }}
                    whileHover={{ y: -5 }}
                    className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
                  >
                    <div className="flex gap-1 mb-4">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={18}
                          className={
                            s <= rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-gray-200 text-gray-200"
                          }
                        />
                      ))}
                    </div>
                    <p className="text-gray-700 mb-6">"{text}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#2563EB] rounded-full flex items-center justify-center text-white font-semibold">
                        {initials}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{name}</p>
                        <p className="text-sm text-gray-500">{role}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">F</span>
                </div>
                <span className="text-xl font-semibold">Fixora</span>
              </div>
              <p className="text-gray-400">
                Your trusted platform for home services
              </p>
              {totalProviders > 0 && (
                <div className="mt-4 space-y-1 text-sm text-gray-400">
                  <div>✅ {totalProviders}+ Verified Providers</div>
                  <div>⭐ {totalReviews}+ Customer Reviews</div>
                  <div>🏠 {categories.length}+ Service Categories</div>
                </div>
              )}
            </div>
            <div>
              <h4 className="font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-gray-400">
                {categories.length > 0
                  ? categories.slice(0, 5).map((cat) => (
                      <li key={cat._id}>
                        <Link
                          to={`/services?category=${encodeURIComponent(cat.category_name)}`}
                          className="hover:text-white transition-colors"
                        >
                          {cat.category_name}
                        </Link>
                      </li>
                    ))
                  : ["Plumbing", "Electrical", "Cleaning", "Handyman"].map(
                      (s) => (
                        <li key={s}>
                          <Link
                            to={`/services?category=${encodeURIComponent(s)}`}
                            className="hover:text-white transition-colors"
                          >
                            {s}
                          </Link>
                        </li>
                      ),
                    )}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link
                    to="/about"
                    className="hover:text-white transition-colors"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="hover:text-white transition-colors"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    to="/careers"
                    className="hover:text-white transition-colors"
                  >
                    Careers
                  </Link>
                </li>
                <li>
                  <Link
                    to="/blog"
                    className="hover:text-white transition-colors"
                  >
                    Blog
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link
                    to="/help"
                    className="hover:text-white transition-colors"
                  >
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link
                    to="/safety"
                    className="hover:text-white transition-colors"
                  >
                    Safety
                  </Link>
                </li>
                <li>
                  <button
                    onClick={() => setShowTerms(true)}
                    className="hover:text-white transition-colors text-gray-400 text-left cursor-pointer"
                  >
                    Terms
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setShowPrivacy(true)}
                    className="hover:text-white transition-colors text-gray-400 text-left cursor-pointer"
                  >
                    Privacy
                  </button>
                </li>
                <li>
                  <Link
                    to="/admin/dashboard"
                    className="hover:text-white transition-colors"
                  >
                    Admin
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2026 Fixora. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ────────────────────────────────────────────────────── */}
      {/* Terms of Service Modal */}
      {/* ────────────────────────────────────────────────────── */}
      <LegalModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        title="Terms of Service"
      >
        <div className="space-y-4">
          <p className="text-gray-500 text-xs">Last updated: January 2026</p>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              1. Acceptance of Terms
            </h3>
            <p>
              By accessing or using Fixora ("the Platform"), you agree to be
              bound by these Terms of Service. If you do not agree to these
              terms, please do not use our services.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              2. Platform Description
            </h3>
            <p>
              Fixora is an online marketplace connecting customers with
              independent home service providers. We facilitate connections but
              do not directly provide the services offered on the Platform.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              3. User Accounts
            </h3>
            <p>
              To use certain features, you must create an account. You are
              responsible for maintaining the confidentiality of your account
              credentials and for all activities under your account.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              4. Booking & Payments
            </h3>
            <p>
              All bookings are subject to provider availability. Payment is
              processed through our secure payment system. Platform commission
              rates apply as disclosed at time of booking.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              5. Cancellations & Refunds
            </h3>
            <p>
              Cancellations must be made at least 24 hours before the scheduled
              service. Refund eligibility is determined by our dispute
              resolution process and reviewed by the admin team.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              6. Provider Responsibilities
            </h3>
            <p>
              Service providers must be verified, maintain professional
              standards, complete accepted bookings, and comply with all
              applicable laws and regulations.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              7. Liability
            </h3>
            <p>
              Fixora acts as a platform facilitator only. We are not liable for
              the quality of services provided by independent contractors. Users
              engage with providers at their own risk.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              8. Changes to Terms
            </h3>
            <p>
              We reserve the right to modify these terms at any time. Continued
              use of the Platform after changes constitutes acceptance of the
              updated terms.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              9. Contact
            </h3>
            <p>
              For questions regarding these Terms, please contact us at{" "}
              <a
                href="mailto:legal@fixora.com"
                className="text-[#2563EB] hover:underline"
              >
                legal@fixora.com
              </a>
              .
            </p>
          </section>
        </div>
      </LegalModal>

      {/* ────────────────────────────────────────────────────── */}
      {/* Privacy Policy Modal */}
      {/* ────────────────────────────────────────────────────── */}
      <LegalModal
        isOpen={showPrivacy}
        onClose={() => setShowPrivacy(false)}
        title="Privacy Policy"
      >
        <div className="space-y-4">
          <p className="text-gray-500 text-xs">Last updated: January 2026</p>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              1. Information We Collect
            </h3>
            <p>
              We collect information you provide directly: name, email, phone
              number, service address, payment information, and any content you
              share on the Platform such as reviews or messages.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              2. How We Use Your Information
            </h3>
            <ul className="list-disc ml-5 space-y-1">
              <li>Connect customers with service providers</li>
              <li>Process payments and manage bookings</li>
              <li>Send notifications about your bookings</li>
              <li>Improve Platform functionality and user experience</li>
              <li>Prevent fraud and ensure safety</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              3. Location Data
            </h3>
            <p>
              We collect real-time location data when providers are en route to
              service appointments. This helps customers track arrival time.
              Location sharing starts at 9 AM on booking day and stops upon
              payment completion.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              4. Information Sharing
            </h3>
            <p>
              We share information between matched customers and providers only
              to complete bookings. We do not sell your personal information to
              third parties. We may disclose data when required by law.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              5. Data Security
            </h3>
            <p>
              We implement industry-standard security measures including
              encrypted passwords, secure payment processing, and protected API
              endpoints. However, no system is 100% secure.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              6. Cookies & Tracking
            </h3>
            <p>
              We use cookies to maintain login sessions, remember preferences,
              and analyze Platform usage. You can control cookie settings
              through your browser.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              7. Your Rights
            </h3>
            <ul className="list-disc ml-5 space-y-1">
              <li>Access and download your personal data</li>
              <li>Update or correct your information</li>
              <li>Deactivate your account at any time</li>
              <li>Request deletion of your data</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              8. Children's Privacy
            </h3>
            <p>
              Fixora is not intended for users under 18. We do not knowingly
              collect information from minors.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2 text-base">
              9. Contact Us
            </h3>
            <p>
              For privacy-related questions, contact our Data Protection Officer
              at{" "}
              <a
                href="mailto:privacy@fixora.com"
                className="text-[#2563EB] hover:underline"
              >
                privacy@fixora.com
              </a>
              .
            </p>
          </section>
        </div>
      </LegalModal>
    </div>
  );
}
