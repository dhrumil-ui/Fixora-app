import { Link, useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

export function VerifyEmail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const email = params.get("email") || "";
  const token = params.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"success" | "error" | "missing">(
    "missing",
  );
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function run() {
      if (!email || !token) {
        setStatus("missing");
        setMessage(
          "Verification link is incomplete. Please open the link from your email again.",
        );
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/api/auth/verify-link?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
        );
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setStatus("error");
          setMessage(data?.message || "Verification failed.");
        } else {
          setStatus("success");
          setMessage(data?.message || "Email verified successfully ✅");
        }
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message || "Network error while verifying email.");
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [email, token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-[#2563EB] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">F</span>
            </div>
            <span className="text-2xl font-semibold text-gray-900">Fixora</span>
          </Link>

          <h2 className="text-2xl font-bold text-gray-900">
            Email Verification
          </h2>
          <p className="text-gray-600 mt-2">
            {loading
              ? "Verifying your email, please wait..."
              : "Verification result"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {loading ? (
            <p className="text-center text-gray-700">Loading...</p>
          ) : (
            <>
              <div
                className={`rounded-lg p-4 text-sm ${
                  status === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {message}
              </div>

              <button
                onClick={() => navigate("/login")}
                className="w-full mt-5 bg-[#2563EB] text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Login
              </button>

              <div className="mt-6 text-center text-sm text-gray-600">
                Back to{" "}
                <Link to="/login" className="text-[#2563EB] hover:underline">
                  Login
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
