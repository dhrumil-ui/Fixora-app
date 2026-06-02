import { Link } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ShieldCheck,
  UserCheck,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  FileCheck,
  Lock,
  Eye,
  Phone,
} from "lucide-react";

const PILLARS = [
  {
    icon: UserCheck,
    title: "Verified providers",
    description:
      "Every provider passes identity verification before they can accept jobs. License and insurance documents are reviewed by our team.",
  },
  {
    icon: FileCheck,
    title: "Background checks",
    description:
      "Providers in regulated trades complete third-party background screening. We re-verify periodically to keep records current.",
  },
  {
    icon: CreditCard,
    title: "Secure payments",
    description:
      "All payments are processed through Fixora. We never share your card details with providers, and refunds are handled by us directly.",
  },
  {
    icon: Lock,
    title: "Data protection",
    description:
      "Your personal information is encrypted in transit and at rest. We never sell your data, and you control what providers can see.",
  },
  {
    icon: MessageSquare,
    title: "In-app communication",
    description:
      "Keep messages and quotes inside Fixora. We retain a record so we can step in if a dispute ever arises.",
  },
  {
    icon: Eye,
    title: "Real-time tracking",
    description:
      "Know when your provider is on the way. Booking status updates keep you informed at every step, from accepted to completed.",
  },
];

const CUSTOMER_TIPS = [
  "Confirm your provider's name and photo match the one shown in the app before letting them in.",
  "Keep all conversations and quotes inside Fixora — we can't help resolve issues that happened outside the platform.",
  "Never pay providers in cash or via outside apps. All payments must go through Fixora.",
  "Use the in-app rating and review after every job — your feedback protects future customers.",
  "If something feels off, end the appointment and contact our Trust & Safety team immediately.",
];

const PROVIDER_TIPS = [
  "Verify the booking address and customer name in the app before traveling to a job.",
  "Document the work area with photos before and after for your protection.",
  "Use in-app chat for any change requests so there's a written record.",
  "Report unsafe working conditions or harassment immediately — your safety matters as much as the customer's.",
  "Keep your insurance and license documents up to date in your profile.",
];

export function SafetyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to home
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <span className="inline-block bg-[#2563EB] text-white px-4 py-1 rounded-full text-sm font-semibold mb-4">
              Trust & Safety
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Built for safety, designed for trust
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Letting someone into your home is a big deal. Here's how we work
              to make every Fixora booking safe for customers and providers
              alike.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              How we keep Fixora safe
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our approach to safety runs through every part of the platform —
              from how we verify providers to how we handle your payments.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PILLARS.map((p, idx) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-[#2563EB] hover:shadow-md transition-all"
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                    <Icon size={22} className="text-[#2563EB]" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {p.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {p.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tips - two columns */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Safety tips
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              A few simple practices keep every booking smoother for everyone
              involved.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-2xl p-8 border border-gray-200"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <ShieldCheck size={20} className="text-[#2563EB]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  For customers
                </h3>
              </div>
              <ul className="space-y-3">
                {CUSTOMER_TIPS.map((tip, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-sm text-gray-700 leading-relaxed"
                  >
                    <span className="text-[#2563EB] font-bold mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-2xl p-8 border border-gray-200"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <ShieldCheck size={20} className="text-[#2563EB]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  For providers
                </h3>
              </div>
              <ul className="space-y-3">
                {PROVIDER_TIPS.map((tip, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-sm text-gray-700 leading-relaxed"
                  >
                    <span className="text-[#2563EB] font-bold mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Report a concern */}
      <section className="py-16 bg-gradient-to-br from-red-50 to-orange-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-100 rounded-full mb-4">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Need to report a concern?
          </h2>
          <p className="text-gray-600 mb-6">
            If you ever feel unsafe or witness misconduct, contact our Trust &
            Safety team right away. We respond within 24 hours and within 1 hour
            for urgent reports.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:safety@fixora.com?subject=Safety%20Report"
              className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              <AlertTriangle size={18} />
              Report a concern
            </a>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              <Phone size={18} />
              Contact support
            </Link>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            For emergencies, please call 911 or your local emergency services
            first.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
          <p>&copy; 2026 Fixora. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
