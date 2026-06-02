import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { Mail, Lock, User, Phone, Briefcase, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { apiPost } from "../lib/api";

type UserRole = "customer" | "provider" | "admin";

export function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [selectedRole, setSelectedRole] = useState<UserRole>("customer");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Phone validation
    if (formData.phone.length !== 10) {
      setErrors((prev) => ({
        ...prev,
        phone: "Phone must be exactly 10 digits",
      }));
      return;
    }

    // Password validation
    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/;
    if (!strongPassword.test(formData.password)) {
      setErrors((prev) => ({
        ...prev,
        password:
          "Min 8 chars with uppercase, lowercase, number & special character",
      }));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: "Passwords do not match",
      }));
      return;
    }

    try {
      const payload = {
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: selectedRole,
      };
      const res = await apiPost<{ message: string }>(
        "/api/auth/register",
        payload,
      );
      alert(res.message || "Account created. Please verify email.");
      navigate("/login");
    } catch (err: any) {
      alert(err.message || "Register failed");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Phone: only allow digits, max 10
    if (name === "phone") {
      if (!/^\d*$/.test(value)) return; // block non-digits
      if (value.length > 10) return; // block more than 10
      setErrors((prev) => ({
        ...prev,
        phone:
          value.length > 0 && value.length < 10
            ? "Phone must be exactly 10 digits"
            : "",
      }));
    }

    // Password strength
    if (name === "password") {
      const strongPassword =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/;
      setErrors((prev) => ({
        ...prev,
        password:
          value && !strongPassword.test(value)
            ? "Min 8 chars with uppercase, lowercase, number & special character"
            : "",
      }));
    }

    // Confirm password
    if (name === "confirmPassword") {
      setErrors((prev) => ({
        ...prev,
        confirmPassword:
          value !== formData.password ? "Passwords do not match" : "",
      }));
    }

    setFormData({ ...formData, [name]: value });
  };

  const roles = [
    {
      type: "customer" as UserRole,
      icon: User,
      title: "Customer",
      description: "Book home services",
      color: "#2563EB",
    },
    {
      type: "provider" as UserRole,
      icon: Briefcase,
      title: "Service Provider",
      description: "Offer your services",
      color: "#2563EB",
    },
    {
      type: "admin" as UserRole,
      icon: ShieldCheck,
      title: "Admin",
      description: "Manage platform",
      color: "#2563EB",
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-[#2563EB] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">F</span>
            </div>
            <span className="text-2xl font-semibold text-gray-900">Fixora</span>
          </Link>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-3xl font-bold text-gray-900 mb-2"
          >
            Create an account
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-gray-600"
          >
            Join thousands of satisfied customers
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white rounded-2xl shadow-lg p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="9876543210"
                  maxLength={10}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent ${errors.phone ? "border-red-400" : "border-gray-300"}`}
                  required
                />
              </div>
              {errors.phone && (
                <p className="mt-1 text-xs text-red-500">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent ${errors.password ? "border-red-400" : "border-gray-300"}`}
                  required
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent ${errors.confirmPassword ? "border-red-400" : "border-gray-300"}`}
                  required
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Join as
              </label>
              <div className="flex justify-center">
                <div className="grid w-full max-w-sm grid-cols-2 gap-4">
                  {roles
                    .filter((r) => r.type !== "admin")
                    .map((r, index) => {
                      const Icon = r.icon;
                      const active = selectedRole === r.type;

                      return (
                        <motion.button
                          key={r.type}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.25,
                            delay: 0.1 + index * 0.05,
                          }}
                          type="button"
                          onClick={() => setSelectedRole(r.type)}
                          className={`p-5 rounded-xl border-2 transition-all text-center flex flex-col items-center justify-center
                ${active ? "border-[#2563EB] bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                        >
                          <Icon
                            size={26}
                            className={`${active ? "text-[#2563EB]" : "text-gray-400"} mb-2`}
                          />
                          <p
                            className={`text-sm font-semibold ${active ? "text-[#2563EB]" : "text-gray-700"}`}
                          >
                            {r.title}
                          </p>
                        </motion.button>
                      );
                    })}
                </div>
              </div>
            </div>
            <div className="flex items-start">
              <input
                type="checkbox"
                id="terms-agreement"
                title="Agree to Terms of Service and Privacy Policy"
                className="mt-1 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                required
              />
              <label
                htmlFor="terms-agreement"
                className="ml-2 text-sm text-gray-600"
              >
                I agree to the{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowTerms(true);
                  }}
                  className="text-[#2563EB] hover:underline"
                >
                  Terms of Service
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowPrivacy(true);
                  }}
                  className="text-[#2563EB] hover:underline"
                >
                  Privacy Policy
                </button>
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-[#2563EB] text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Account
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link to="/login" className="text-[#2563EB] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Terms of Service
              </h2>
              <button
                onClick={() => setShowTerms(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-gray-600 space-y-4 leading-relaxed">
              <p className="text-xs text-gray-400">
                Effective Date: January 1, 2025
              </p>

              <p>
                <strong className="text-gray-800">1. Agreement to Terms</strong>
                <br />
                By creating an account on Fixora, you confirm that you are at
                least 18 years old and agree to be bound by these Terms of
                Service. If you are registering on behalf of a business, you
                represent that you have authority to bind that business.
              </p>

              <p>
                <strong className="text-gray-800">
                  2. Description of Service
                </strong>
                <br />
                Fixora is an online marketplace that connects customers seeking
                home services (such as plumbing, electrical work, cleaning, and
                repairs) with independent service providers. Fixora acts as an
                intermediary only and does not directly employ service providers
                or guarantee the quality of any service.
              </p>

              <p>
                <strong className="text-gray-800">3. User Accounts</strong>
                <br />
                You are responsible for maintaining the confidentiality of your
                login credentials. You agree to notify Fixora immediately of any
                unauthorized access to your account. Fixora is not liable for
                any loss resulting from unauthorized use of your account.
              </p>

              <p>
                <strong className="text-gray-800">
                  4. Bookings and Payments
                </strong>
                <br />
                All bookings and payments are processed through the Fixora
                platform. Prices are set by service providers. Payment is due
                upon completion of the service unless otherwise agreed. Fixora
                charges a platform fee for facilitating transactions.
              </p>

              <p>
                <strong className="text-gray-800">
                  5. Cancellations and Refunds
                </strong>
                <br />
                Customers may cancel bookings subject to the provider's
                cancellation policy. Refund requests must be submitted within 7
                days of service completion. Fixora reserves the right to make
                final refund decisions after reviewing disputes.
              </p>

              <p>
                <strong className="text-gray-800">
                  6. Provider Responsibilities
                </strong>
                <br />
                Service providers must be properly licensed and insured for the
                services they offer. Providers agree to arrive on time, complete
                work as described, and treat customers professionally. Fixora
                may suspend or terminate provider accounts for violations.
              </p>

              <p>
                <strong className="text-gray-800">7. Prohibited Conduct</strong>
                <br />
                Users may not: post false or misleading information, harass
                other users, attempt to bypass Fixora's payment system, use the
                platform for unlawful purposes, or interfere with the platform's
                operation.
              </p>

              <p>
                <strong className="text-gray-800">
                  8. Limitation of Liability
                </strong>
                <br />
                Fixora is not liable for any property damage, personal injury,
                or financial loss resulting from services performed by
                providers. Our total liability to you shall not exceed the
                amount paid through the platform in the 30 days preceding the
                claim.
              </p>

              <p>
                <strong className="text-gray-800">9. Dispute Resolution</strong>
                <br />
                In the event of a dispute between a customer and provider,
                Fixora will attempt to mediate in good faith. Users agree to
                attempt resolution through Fixora's dispute process before
                pursuing legal action.
              </p>

              <p>
                <strong className="text-gray-800">10. Changes to Terms</strong>
                <br />
                Fixora reserves the right to modify these Terms at any time. We
                will notify users of material changes via email. Continued use
                of the platform after changes constitutes acceptance.
              </p>

              <p>
                <strong className="text-gray-800">11. Contact Us</strong>
                <br />
                For questions regarding these Terms, please contact us at:
                <br />
                📧 legal@fixora.com
                <br />
                📍 Fixora Inc., United States
              </p>
            </div>
            <button
              onClick={() => setShowTerms(false)}
              className="mt-6 w-full bg-[#2563EB] text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Privacy Policy
              </h2>
              <button
                onClick={() => setShowPrivacy(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-gray-600 space-y-4 leading-relaxed">
              <p className="text-xs text-gray-400">
                Effective Date: January 1, 2025
              </p>

              <p>
                <strong className="text-gray-800">
                  1. Information We Collect
                </strong>
                <br />
                We collect the following personal information when you use
                Fixora:
                <br />• <strong>Account Information:</strong> Full name, email
                address, phone number, and password
                <br />• <strong>Profile Information:</strong> Address, profile
                photo, and service preferences
                <br />• <strong>Transaction Data:</strong> Booking history,
                payment records, and service details
                <br />• <strong>Usage Data:</strong> Pages visited, features
                used, and device information
              </p>

              <p>
                <strong className="text-gray-800">
                  2. How We Use Your Information
                </strong>
                <br />
                We use your information to:
                <br />
                • Create and manage your Fixora account
                <br />
                • Connect you with appropriate service providers
                <br />
                • Process payments and send receipts
                <br />
                • Send booking confirmations and service reminders
                <br />
                • Improve our platform and customer experience
                <br />• Comply with legal obligations
              </p>

              <p>
                <strong className="text-gray-800">
                  3. Information Sharing
                </strong>
                <br />
                We share your information only in the following circumstances:
                <br />• <strong>With Providers:</strong> Your name, address, and
                booking details are shared with your chosen service provider
                <br />• <strong>With Customers:</strong> Provider profiles and
                ratings are visible to customers
                <br />• <strong>Legal Requirements:</strong> We may disclose
                data if required by law
                <br />
                We do not sell your personal information to third parties.
              </p>

              <p>
                <strong className="text-gray-800">4. Data Security</strong>
                <br />
                We implement industry-standard security measures including:
                <br />
                • Encrypted data transmission (HTTPS/TLS)
                <br />
                • Hashed passwords (bcrypt)
                <br />
                • Secure cookie-based authentication
                <br />
                • Regular security audits
                <br />
                However, no method of transmission over the internet is 100%
                secure.
              </p>

              <p>
                <strong className="text-gray-800">
                  5. Cookies and Tracking
                </strong>
                <br />
                Fixora uses cookies solely for authentication and session
                management. We do not use tracking cookies for advertising. You
                may disable cookies in your browser, but this may affect
                platform functionality.
              </p>

              <p>
                <strong className="text-gray-800">6. Your Rights</strong>
                <br />
                You have the right to:
                <br />
                • Access your personal information at any time
                <br />
                • Update or correct your information via account settings
                <br />
                • Request deletion of your account and associated data
                <br />
                • Opt out of non-essential communications
                <br />
                To exercise these rights, contact us at privacy@fixora.com
              </p>

              <p>
                <strong className="text-gray-800">7. Data Retention</strong>
                <br />
                We retain your personal data for as long as your account is
                active. Upon account deletion, we will delete your data within
                30 days, except where retention is required by law (e.g.,
                financial records).
              </p>

              <p>
                <strong className="text-gray-800">8. Children's Privacy</strong>
                <br />
                Fixora is not intended for use by individuals under the age of
                18. We do not knowingly collect personal information from
                minors. If we discover a minor has registered, we will delete
                the account immediately.
              </p>

              <p>
                <strong className="text-gray-800">
                  9. Changes to This Policy
                </strong>
                <br />
                We may update this Privacy Policy periodically. We will notify
                you of significant changes via email at least 7 days before they
                take effect. Your continued use of Fixora after the effective
                date constitutes acceptance.
              </p>

              <p>
                <strong className="text-gray-800">10. Contact Us</strong>
                <br />
                For privacy concerns or data requests, please contact:
                <br />
                📧 privacy@fixora.com
                <br />
                📍 Fixora Inc., United States
              </p>
            </div>
            <button
              onClick={() => setShowPrivacy(false)}
              className="mt-6 w-full bg-[#2563EB] text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700"
            >
              I Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
