import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "../auth.store";
import AIChatWidget from "./AIChatWidget";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const user = useAuthStore((s) => s.me);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const clear = useAuthStore((s) => s.clear);
  const loadingMe = useAuthStore((s) => s.loadingMe);

  const isLandingPage = location.pathname === "/";

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const logout = async () => {
    try {
      const API_BASE =
        ((import.meta as any).env?.VITE_API_BASE as string) ||
        "http://localhost:5001";
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
    clear();
    setMobileMenuOpen(false);
    navigate("/login");
  };

  const displayName = user?.full_name?.trim() || user?.email;
  const showCustomerLinks = user?.role === "customer";
  const showProviderLinks = user?.role === "provider";
  const showAdminLinks = user?.role === "admin";

  if (isLandingPage) return <Outlet />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo - always goes to home */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">
                Fixora
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              {(!user || user.role === "customer") && (
                <Link
                  to="/services"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Find Services
                </Link>
              )}

              {/* Role based nav links */}
              {showCustomerLinks && (
                <Link
                  to="/customer/dashboard"
                  className="text-gray-600 hover:text-gray-900"
                >
                  My Bookings
                </Link>
              )}
              {showProviderLinks && (
                <Link
                  to="/provider/dashboard"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Provider Dashboard
                </Link>
              )}
              {showAdminLinks && (
                <>
                  <Link
                    to="/services"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Browse Services
                  </Link>
                  <Link
                    to="/provider/dashboard"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Provider Dashboard
                  </Link>
                  <Link
                    to="/customer/dashboard"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Customer Dashboard
                  </Link>
                  <Link
                    to="/admin/dashboard"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Admin Dashboard
                  </Link>
                </>
              )}

              {/* Auth section - dynamic */}
              {loadingMe ? (
                <span className="text-gray-400 text-sm">Loading...</span>
              ) : !user ? (
                <>
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="bg-[#2563EB] text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-gray-700">
                    Hi, <span className="font-semibold">{displayName}</span>
                  </span>
                  <button
                    onClick={logout}
                    className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-2">
              {(!user || user.role === "customer") && (
                <Link
                  to="/services"
                  className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Find Services
                </Link>
              )}
              {showCustomerLinks && (
                <Link
                  to="/customer/dashboard"
                  className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  My Bookings
                </Link>
              )}
              {showProviderLinks && (
                <Link
                  to="/provider/dashboard"
                  className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Provider Dashboard
                </Link>
              )}
              {showAdminLinks && (
                <>
                  <Link
                    to="/services"
                    className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Browse Services
                  </Link>
                  <Link
                    to="/provider/dashboard"
                    className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Provider Dashboard
                  </Link>
                  <Link
                    to="/customer/dashboard"
                    className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Customer Dashboard
                  </Link>
                  <Link
                    to="/admin/dashboard"
                    className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Admin Dashboard
                  </Link>
                </>
              )}

              {!loadingMe && !user ? (
                <>
                  <Link
                    to="/login"
                    className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="block px-4 py-2 bg-[#2563EB] text-white rounded-lg text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              ) : !loadingMe && user ? (
                <div className="px-4 pt-2 space-y-2">
                  <div className="text-gray-700">
                    Hi, <span className="font-semibold">{displayName}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
      <AIChatWidget />
    </div>
  );
}
