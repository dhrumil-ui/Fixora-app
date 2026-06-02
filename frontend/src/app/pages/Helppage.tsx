import { Link } from "react-router";
import { motion } from "motion/react";
import {
  HelpCircle,
  Search,
  ArrowLeft,
  ChevronDown,
  Mail,
  MessageCircle,
  Book,
  Shield,
  CreditCard,
  Calendar,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";

export function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState("all");

  const categories = [
    { id: "all", label: "All Topics", icon: Book },
    { id: "booking", label: "Booking", icon: Calendar },
    { id: "payment", label: "Payment", icon: CreditCard },
    { id: "account", label: "Account", icon: Users },
    { id: "provider", label: "For Providers", icon: Wrench },
    { id: "safety", label: "Safety", icon: Shield },
  ];

  const faqs = [
    {
      category: "booking",
      question: "How do I book a service?",
      answer:
        "Browse services, choose your preferred provider, select a date and time, confirm your booking details, and complete the payment. You'll receive a confirmation email with all the details.",
    },
    {
      category: "booking",
      question: "Can I reschedule or cancel my booking?",
      answer:
        "Yes, you can reschedule or cancel your booking up to 24 hours before the scheduled time. Go to 'My Bookings' in your dashboard to manage your appointments.",
    },
    {
      category: "booking",
      question: "How do I track my provider's arrival?",
      answer:
        "On your booking day, live tracking starts at 9 AM automatically. You can view your provider's real-time location on the tracking page in your customer dashboard.",
    },
    {
      category: "payment",
      question: "What payment methods are accepted?",
      answer:
        "We accept all major credit cards (Visa, Mastercard, American Express) and debit cards. All payments are processed securely through our encrypted payment system.",
    },
    {
      category: "payment",
      question: "When am I charged for a service?",
      answer:
        "Payment is captured when the service is completed. You'll receive a payment receipt via email immediately after the transaction.",
    },
    {
      category: "payment",
      question: "How do I request a refund?",
      answer:
        "If you're unsatisfied with a service, report an issue through 'My Bookings' and request a refund. Our admin team reviews refund requests and approves eligible cases.",
    },
    {
      category: "account",
      question: "How do I update my account information?",
      answer:
        "Go to your dashboard settings to update your name, email, phone number, and address. Changes are saved instantly.",
    },
    {
      category: "account",
      question: "How do I deactivate my account?",
      answer:
        "You can deactivate your account from your profile settings. If you change your mind, you can contact support to reactivate it.",
    },
    {
      category: "provider",
      question: "How do I become a service provider?",
      answer:
        "Sign up as a provider, complete your profile with your skills and experience, submit required documents, and wait for admin verification. Once approved, you can start accepting bookings.",
    },
    {
      category: "provider",
      question: "How much commission does Fixora charge?",
      answer:
        "Commission rates vary from 8% to 22% based on your activity level. New providers start at 8%, and rates adjust based on completed bookings and performance.",
    },
    {
      category: "provider",
      question: "When do I get paid?",
      answer:
        "Payouts are processed after the service is completed and the customer payment clears. You'll see your earnings in your provider dashboard.",
    },
    {
      category: "safety",
      question: "Are all providers verified?",
      answer:
        "Yes. Every provider on Fixora goes through identity verification, document review, and background checks before being approved. Look for the verified badge on provider profiles.",
    },
    {
      category: "safety",
      question: "What if there's an issue during service?",
      answer:
        "Report any issue immediately through the 'Service Issues' section in your booking. Providers can respond, and our admin team can approve refunds or resolve disputes.",
    },
    {
      category: "safety",
      question: "Is my personal information secure?",
      answer:
        "Absolutely. We use industry-standard encryption for all data transmission and storage. Your payment information is never stored on our servers. Read our Privacy Policy for full details.",
    },
  ];

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory =
      activeCategory === "all" || faq.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 bg-[#2563EB] rounded-full flex items-center justify-center mx-auto mb-6">
              <HelpCircle className="text-white" size={28} />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              How can we help?
            </h1>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Find answers to common questions or get in touch with our support
              team
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Search help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent shadow-sm"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Sidebar Categories */}
            <aside className="md:col-span-1">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wider">
                Categories
              </h3>
              <nav className="space-y-1">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? "bg-blue-50 text-[#2563EB]"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={16} />
                      {cat.label}
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* FAQ List */}
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {activeCategory === "all"
                    ? "Frequently Asked Questions"
                    : categories.find((c) => c.id === activeCategory)?.label}
                </h2>
                <span className="text-sm text-gray-500">
                  {filteredFaqs.length}{" "}
                  {filteredFaqs.length === 1 ? "result" : "results"}
                </span>
              </div>

              {filteredFaqs.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <p className="text-gray-500">
                    No articles found. Try a different search term.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFaqs.map((faq, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="border border-gray-200 rounded-xl overflow-hidden hover:border-[#2563EB] transition-colors"
                    >
                      <button
                        onClick={() =>
                          setOpenFaq(openFaq === index ? null : index)
                        }
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-semibold text-gray-900 pr-4">
                          {faq.question}
                        </span>
                        <ChevronDown
                          className={`text-gray-400 flex-shrink-0 transition-transform ${
                            openFaq === index ? "rotate-180" : ""
                          }`}
                          size={20}
                        />
                      </button>
                      {openFaq === index && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          className="px-5 pb-4 text-gray-600 border-t border-gray-100 pt-4"
                        >
                          {faq.answer}
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Still Need Help */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Still need help?
            </h2>
            <p className="text-gray-600 mb-8">
              Our friendly support team is here for you
            </p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <Link
                to="/contact"
                className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#2563EB] hover:shadow-md transition-all"
              >
                <MessageCircle
                  className="text-[#2563EB] mx-auto mb-3"
                  size={28}
                />
                <h3 className="font-bold text-gray-900 mb-1">Contact Us</h3>
                <p className="text-sm text-gray-600">
                  Get in touch with our team
                </p>
              </Link>
              <a
                href="mailto:support@fixora.com"
                className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#2563EB] hover:shadow-md transition-all"
              >
                <Mail className="text-[#2563EB] mx-auto mb-3" size={28} />
                <h3 className="font-bold text-gray-900 mb-1">Email Support</h3>
                <p className="text-sm text-gray-600">support@fixora.com</p>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
          <p>&copy; 2026 Fixora. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
