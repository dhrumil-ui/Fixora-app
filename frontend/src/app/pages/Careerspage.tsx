import { Link } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Rocket,
  TrendingUp,
  Users,
  Globe,
  Coffee,
  Code2,
  Mail,
} from "lucide-react";

type JobOpening = {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
};

const OPENINGS: JobOpening[] = [
  {
    id: "frontend-engineer",
    title: "Senior Frontend Engineer",
    department: "Engineering",
    location: "Remote (US)",
    type: "Full-time",
    description:
      "Build the customer and provider experiences that thousands of homeowners rely on every day. React, TypeScript, and a sharp eye for UX.",
  },
  {
    id: "backend-engineer",
    title: "Backend Engineer",
    department: "Engineering",
    location: "New York, NY",
    type: "Full-time",
    description:
      "Design and scale the services that power bookings, payments, and notifications. Node.js, MongoDB, and distributed systems experience preferred.",
  },
  {
    id: "customer-success",
    title: "Customer Success Manager",
    department: "Operations",
    location: "Remote (US)",
    type: "Full-time",
    description:
      "Be the voice of Fixora for our customers. Resolve issues, gather feedback, and turn one-time bookings into long-term relationships.",
  },
  {
    id: "operations-manager",
    title: "Provider Operations Manager",
    department: "Operations",
    location: "Hybrid (NY/NJ)",
    type: "Full-time",
    description:
      "Own the end-to-end provider lifecycle: onboarding, verification, performance management, and growth. Help us scale our network thoughtfully.",
  },
  {
    id: "marketing-lead",
    title: "Marketing Lead",
    department: "Marketing",
    location: "Remote (US)",
    type: "Full-time",
    description:
      "Drive acquisition across paid, organic, and partnerships. We're looking for someone who balances data with creative instinct.",
  },
  {
    id: "product-designer",
    title: "Product Designer",
    department: "Design",
    location: "Remote (US)",
    type: "Contract",
    description:
      "Shape the next generation of our customer and provider apps. Strong portfolio with real shipped work required.",
  },
];

const BENEFITS = [
  {
    icon: Rocket,
    title: "Ownership",
    description:
      "Take ideas from concept to launch. No layers of approval, no design-by-committee, no waiting for permission.",
  },
  {
    icon: TrendingUp,
    title: "Equity for everyone",
    description:
      "Every full-time employee gets meaningful equity. We win together.",
  },
  {
    icon: Globe,
    title: "Remote-first",
    description:
      "Work from where you do your best work. Quarterly team gatherings to stay connected.",
  },
  {
    icon: Code2,
    title: "Modern stack",
    description:
      "Work with tools you'd actually pick: TypeScript, React, Node, MongoDB. Greenfield code, no legacy baggage.",
  },
  {
    icon: Coffee,
    title: "Flexible time off",
    description:
      "Unlimited PTO with a 3-week minimum. Recharge when you need to.",
  },
  {
    icon: Users,
    title: "Real impact",
    description:
      "Small team, big mission. Your work directly shapes how millions get help at home.",
  },
];

export function CareersPage() {
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
              Careers at Fixora
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Help us reshape home services
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We're building the platform that makes finding trustworthy home
              services as easy as ordering a ride. Join a small, ambitious team
              with a long roadmap and a lot of impact.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why Fixora */}
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
              Why work at Fixora
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We invest in our team because great work comes from people who
              feel supported, challenged, and trusted.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((b, idx) => {
              const Icon = b.icon;
              return (
                <motion.div
                  key={b.title}
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
                    {b.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {b.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open positions */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Open positions
            </h2>
            <p className="text-gray-600">
              {OPENINGS.length} open role{OPENINGS.length === 1 ? "" : "s"}{" "}
              across our team. Don't see your fit? We'd still love to hear from
              you.
            </p>
          </motion.div>

          <div className="space-y-4">
            {OPENINGS.map((job, idx) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: idx * 0.04 }}
              >
                <JobCard job={job} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Don't see a fit */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Mail className="w-12 h-12 text-[#2563EB] mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Don't see your role?
          </h2>
          <p className="text-gray-600 mb-6">
            We're always interested in hearing from talented people. Send us a
            note about what you do and why Fixora.
          </p>
          <a
            href="mailto:careers@fixora.com?subject=General%20Application"
            className="inline-block bg-[#2563EB] text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Get in touch
          </a>
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

function JobCard({ job }: { job: JobOpening }) {
  const applyHref = `mailto:careers@fixora.com?subject=${encodeURIComponent(
    `Application: ${job.title}`,
  )}&body=${encodeURIComponent(
    `Hi Fixora team,\n\nI'd like to apply for the ${job.title} role.\n\nA bit about me:\n\n[Your background here]\n\nResume / portfolio:\n\n[Links]\n\nThanks!`,
  )}`;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-[#2563EB] hover:shadow-md transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-[#2563EB] uppercase tracking-wide">
              {job.department}
            </span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{job.title}</h3>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            {job.description}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {job.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Briefcase size={14} />
              {job.type}
            </span>
          </div>
        </div>
        <a
          href={applyHref}
          className="shrink-0 bg-[#2563EB] text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm text-center"
        >
          Apply
        </a>
      </div>
    </div>
  );
}
