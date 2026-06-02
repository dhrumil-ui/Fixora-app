import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { LandingPage } from "./pages/LandingPage";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { RoleSelection } from "./pages/RoleSelection";
import { ServiceListing } from "./pages/ServiceListing";
import ProviderProfile from "./pages/ProviderProfile";
import { CustomerDashboard } from "./pages/CustomerDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Layout } from "./components/Layout";
import { VerifyEmail } from "./pages/VerifyEmail";
import ProviderDashboard from "./pages/ProviderDashboard";
import { useAuthStore } from "./auth.store";
import TrackingPage from "./pages/TrackingPage";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { AboutPage } from "./pages/Aboutpage";
import { ContactPage } from "./pages/Contactpage";
import { HelpPage } from "./pages/Helppage";
import { BlogPage } from "./pages/Blogpage";
import { CareersPage } from "./pages/Careerspage";
import { SafetyPage } from "./pages/Safetypage";
import AuditLogs from "./pages/AuditLogs";

function PublicRoute() {
  const me = useAuthStore((s) => s.me);
  const loading = useAuthStore((s) => s.loadingMe);

  if (loading) return null;

  if (me) {
    if (me.role === "provider")
      return <Navigate to="/provider/dashboard" replace />;
    if (me.role === "admin") return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/customer/dashboard" replace />;
  }

  return <Outlet />;
}

function RequireRole({
  role,
}: {
  role:
    | "provider"
    | "customer"
    | "admin"
    | ("provider" | "customer" | "admin")[];
}) {
  const me = useAuthStore((s) => s.me);
  const loading = useAuthStore((s) => s.loadingMe);

  if (loading) return null;
  if (!me) return <Navigate to="/login" replace />;

  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(me.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

function AuthLoader({ children }: { children: React.ReactNode }) {
  const refreshMe = useAuthStore((s) => s.refreshMe);

  useEffect(() => {
    refreshMe();
  }, []);

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthLoader>
        <Layout />
      </AuthLoader>
    ),
    children: [
      { index: true, Component: LandingPage },
      { path: "services/:category?", Component: ServiceListing },
      { path: "provider/:id", Component: ProviderProfile },
      { path: "verify-email", Component: VerifyEmail },
      { path: "track/:bookingId", Component: TrackingPage },
      { path: "forgot-password", Component: ForgotPassword },
      { path: "reset-password", Component: ResetPassword },
      { path: "about", Component: AboutPage },
      { path: "contact", Component: ContactPage },
      { path: "help", Component: HelpPage },
      { path: "blog", Component: BlogPage },
      { path: "careers", Component: CareersPage },
      { path: "safety", Component: SafetyPage },
      {
        element: <PublicRoute />,
        children: [
          { path: "login", Component: Login },
          { path: "signup", Component: Signup },
          { path: "role-selection", Component: RoleSelection },
        ],
      },
      {
        element: <RequireRole role={["customer", "admin"]} />,
        children: [
          { path: "customer/dashboard", Component: CustomerDashboard },
        ],
      },
      {
        element: <RequireRole role={["provider", "admin"]} />,
        children: [
          { path: "provider/dashboard", Component: ProviderDashboard },
        ],
      },
      {
        element: <RequireRole role="admin" />,
        children: [
          { path: "admin/dashboard", Component: AdminDashboard },
          { path: "admin/audit-logs", element: <AuditLogs /> },
        ],
      },
    ],
  },
]);
