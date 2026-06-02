import { Link } from "react-router";
import { motion } from "motion/react";
import {
  Users,
  Shield,
  Zap,
  Heart,
  Target,
  Award,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";

export function AboutPage() {
  const values = [
    {
      icon: Shield,
      title: "Trust & Safety",
      description:
        "Every provider is background-checked and verified. Your safety is our top priority.",
    },
    {
      icon: Zap,
      title: "Instant Booking",
      description:
        "Book services in minutes, not days. Our platform makes it effortless to get help when you need it.",
    },
    {
      icon: Heart,
      title: "Customer First",
      description:
        "We're obsessed with customer satisfaction. Every decision we make starts with how it affects you.",
    },
    {
      icon: Award,
      title: "Quality Assured",
      description:
        "We only partner with top-rated professionals who meet our strict quality standards.",
    },
  ];

  const stats = [
    { number: "1+", label: "Verified Providers" },
    { number: "5+", label: "Happy Customers" },
    { number: "3+", label: "Service Categories" },
    { number: "100%", label: "Satisfaction Promise" },
  ];

  return (
    <div className="min-h-screen bg-white">
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block bg-[#2563EB] text-white px-4 py-1 rounded-full text-sm font-semibold mb-4">
              About Fixora
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Transforming home services,
              <br />
              one booking at a time
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Fixora is on a mission to make quality home services accessible to
              everyone. We connect homeowners with skilled, trusted
              professionals — so you can focus on what matters most.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-blue-50 text-[#2563EB] px-4 py-2 rounded-full text-sm font-semibold mb-4">
                <Target size={16} />
                Our Mission
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Making home care effortless
              </h2>
              <p className="text-gray-600 mb-4">
                We believe everyone deserves access to reliable, high-quality
                home services without the hassle. That's why we built Fixora —
                to eliminate the friction between people who need help and the
                skilled professionals who can provide it.
              </p>
              <p className="text-gray-600">
                From plumbing emergencies to routine cleaning, our platform
                connects you with verified experts in your area who show up on
                time and get the job done right.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-gradient-to-br from-[#2563EB] to-blue-600 rounded-2xl p-8 text-white"
            >
              <div className="grid grid-cols-2 gap-6">
                {stats.map((stat, i) => (
                  <div key={i}>
                    <div className="text-4xl font-bold mb-2">{stat.number}</div>
                    <div className="text-blue-100 text-sm">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              What we stand for
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our core values guide every decision we make and every
              relationship we build.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 border border-gray-200 hover:border-[#2563EB] hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                  <value.icon className="text-[#2563EB]" size={24} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-sm text-gray-600">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 bg-[#2563EB] rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="text-white" size={28} />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Join the Fixora family
            </h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Whether you're looking to book a service or become a provider,
              we're here to help you succeed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/services"
                className="bg-[#2563EB] text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Browse Services
              </Link>
              <Link
                to="/signup"
                className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
              >
                Become a Provider
              </Link>
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
