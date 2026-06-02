import { Link } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Wrench,
  Sparkles,
  Zap,
  Home,
  Hammer,
  Shield,
} from "lucide-react";

type BlogPost = {
  id: string;
  category: string;
  categoryIcon: typeof Wrench;
  categoryColor: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  author: string;
};

const POSTS: BlogPost[] = [
  {
    id: "signs-ac-needs-repair",
    category: "HVAC",
    categoryIcon: Zap,
    categoryColor: "bg-orange-100 text-orange-700",
    title: "5 Signs Your AC Needs Repair Before Summer Hits",
    excerpt:
      "Strange noises, weak airflow, or rising energy bills? Catching these early warning signs can save you hundreds in emergency repairs when the heat arrives.",
    date: "Apr 28, 2026",
    readTime: "5 min read",
    author: "Fixora Team",
  },
  {
    id: "choose-reliable-plumber",
    category: "Plumbing",
    categoryIcon: Wrench,
    categoryColor: "bg-blue-100 text-blue-700",
    title: "How to Choose a Reliable Plumber: A Homeowner's Checklist",
    excerpt:
      "Not all plumbers are created equal. Learn the seven questions to ask before hiring, what licenses to verify, and how to spot red flags in quotes.",
    date: "Apr 22, 2026",
    readTime: "7 min read",
    author: "Sarah Mitchell",
  },
  {
    id: "deep-cleaning-checklist",
    category: "Cleaning",
    categoryIcon: Sparkles,
    categoryColor: "bg-emerald-100 text-emerald-700",
    title: "The Ultimate Spring Deep Cleaning Checklist",
    excerpt:
      "From baseboards to ceiling fans, this room-by-room guide covers the spots most people miss. Tackle it in one weekend or break it across the month.",
    date: "Apr 15, 2026",
    readTime: "6 min read",
    author: "Fixora Team",
  },
  {
    id: "smart-home-electrical-upgrades",
    category: "Electrical",
    categoryIcon: Zap,
    categoryColor: "bg-yellow-100 text-yellow-700",
    title: "Smart Home Electrical Upgrades That Actually Pay Off",
    excerpt:
      "Smart switches, EV chargers, and whole-home surge protection: which upgrades deliver real value, and which are just expensive gadgets in disguise.",
    date: "Apr 08, 2026",
    readTime: "8 min read",
    author: "James Carter",
  },
  {
    id: "lawn-care-by-season",
    category: "Landscaping",
    categoryIcon: Home,
    categoryColor: "bg-green-100 text-green-700",
    title: "Lawn Care Calendar: What to Do Each Season",
    excerpt:
      "A healthy lawn isn't accidental. Here's the month-by-month playbook professionals use to keep grass lush from spring through fall.",
    date: "Mar 30, 2026",
    readTime: "6 min read",
    author: "Maria Lopez",
  },
  {
    id: "diy-vs-pro",
    category: "Handyman",
    categoryIcon: Hammer,
    categoryColor: "bg-purple-100 text-purple-700",
    title: "DIY or Hire a Pro? A Practical Decision Framework",
    excerpt:
      "Some jobs are perfect weekend projects. Others end in tears, code violations, or insurance claims. Here's how to decide before you pick up the drill.",
    date: "Mar 24, 2026",
    readTime: "5 min read",
    author: "Fixora Team",
  },
];

export function BlogPage() {
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
              Fixora Blog
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Tips, guides, and insights for your home
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Practical advice from professionals you can trust. From quick
              fixes to long-term maintenance, we share what actually works.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured post */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <FeaturedPost post={POSTS[0]} />
          </motion.div>
        </div>
      </section>

      {/* Grid of posts */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            More articles
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {POSTS.slice(1).map((post, idx) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
              >
                <PostCard post={post} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter / CTA */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Shield className="w-12 h-12 text-[#2563EB] mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Need help with your home?
          </h2>
          <p className="text-gray-600 mb-6">
            Browse vetted professionals in your area and book a service in
            minutes.
          </p>
          <Link
            to="/services"
            className="inline-block bg-[#2563EB] text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Browse Services
          </Link>
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

function FeaturedPost({ post }: { post: BlogPost }) {
  const Icon = post.categoryIcon;
  return (
    <article className="grid md:grid-cols-2 gap-8 bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-[#2563EB] hover:shadow-lg transition-all">
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 min-h-[280px] flex items-center justify-center p-8">
        <Icon className="w-32 h-32 text-white/30" strokeWidth={1.5} />
      </div>
      <div className="p-8 flex flex-col justify-center">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${post.categoryColor}`}
          >
            <Icon size={12} />
            {post.category}
          </span>
          <span className="text-xs font-semibold text-[#2563EB] uppercase tracking-wide">
            Featured
          </span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 leading-tight">
          {post.title}
        </h3>
        <p className="text-gray-600 mb-5 leading-relaxed">{post.excerpt}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar size={14} />
            {post.date}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} />
            {post.readTime}
          </span>
          <span className="ml-auto text-gray-700 font-medium">
            {post.author}
          </span>
        </div>
      </div>
    </article>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  const Icon = post.categoryIcon;
  return (
    <article className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-[#2563EB] hover:shadow-md transition-all h-full flex flex-col">
      <div className="bg-gradient-to-br from-gray-100 to-gray-200 h-44 flex items-center justify-center">
        <Icon className="w-16 h-16 text-gray-400" strokeWidth={1.5} />
      </div>
      <div className="p-6 flex flex-col flex-1">
        <span
          className={`self-start inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${post.categoryColor}`}
        >
          <Icon size={12} />
          {post.category}
        </span>
        <h3 className="text-lg font-bold text-gray-900 mb-2 leading-snug">
          {post.title}
        </h3>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed flex-1">
          {post.excerpt}
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-500 pt-3 border-t border-gray-100">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {post.date}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {post.readTime}
          </span>
        </div>
      </div>
    </article>
  );
}
