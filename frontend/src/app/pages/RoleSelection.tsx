import { Link, useNavigate } from "react-router";
import { User, Briefcase } from "lucide-react";

export function RoleSelection() {
  const navigate = useNavigate();

  const handleRoleSelect = (role: "customer" | "provider") => {
    if (role === "customer") {
      navigate("/customer/dashboard");
    } else {
      navigate("/provider/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-[#2563EB] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">F</span>
            </div>
            <span className="text-2xl font-semibold text-gray-900">Fixora</span>
          </Link>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Choose Your Role</h2>
          <p className="text-gray-600">Select how you want to use Fixora</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Customer Role */}
          <button
            onClick={() => handleRoleSelect("customer")}
            className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all border-2 border-transparent hover:border-[#2563EB] text-left group"
          >
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#2563EB] transition-colors">
              <User size={32} className="text-[#2563EB] group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">I'm a Customer</h3>
            <p className="text-gray-600 mb-6">
              Looking for trusted professionals to help with home services and repairs
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></div>
                Browse verified service providers
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></div>
                Book services instantly
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></div>
                Track bookings and payments
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></div>
                Leave reviews and ratings
              </li>
            </ul>
          </button>

          {/* Provider Role */}
          <button
            onClick={() => handleRoleSelect("provider")}
            className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all border-2 border-transparent hover:border-[#22C55E] text-left group"
          >
            <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#22C55E] transition-colors">
              <Briefcase size={32} className="text-[#22C55E] group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">I'm a Service Provider</h3>
            <p className="text-gray-600 mb-6">
              Ready to offer my professional services and grow my business
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#22C55E] rounded-full"></div>
                Get job requests from customers
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#22C55E] rounded-full"></div>
                Manage your availability
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#22C55E] rounded-full"></div>
                Track earnings and payments
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#22C55E] rounded-full"></div>
                Build your reputation
              </li>
            </ul>
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="text-[#2563EB] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
