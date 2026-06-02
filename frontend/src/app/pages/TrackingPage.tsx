import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { useBookingLive } from "../hooks/useLiveData";

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  "http://localhost:5001";
const MAPS_KEY =
  ((import.meta as any).env?.VITE_GOOGLE_MAPS_KEY as string) || "";

const mapContainerStyle = { width: "100%", height: "400px" };
const defaultCenter = { lat: 40.7128, lng: -74.006 };

export default function TrackingPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [providerLocation, setProviderLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [arrived, setArrived] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [bookingInfo, setBookingInfo] = useState<{
    date?: string;
    time?: string;
    providerName?: string;
    serviceName?: string;
    status?: string;
    payment_status?: string;
  } | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_KEY,
  });

  // ✅ Single socket connection via singleton hook — no raw io() needed
  const { connected } = useBookingLive(bookingId, "customer", {
    onLocationUpdate: ({ lat, lng }) => {
      setProviderLocation({ lat, lng }); // ✅ was setPosition (doesn't exist)
    },
    onProviderArrived: () => setArrived(true),
  });

  // ── Load booking info + poll for payment ──
  useEffect(() => {
    async function checkBooking() {
      try {
        const res = await fetch(`${API_BASE}/api/bookings/${bookingId}`, {
          credentials: "include",
        });
        const data = await res.json();
        const b = data?.booking;

        if (b) {
          setBookingInfo({
            date: b.date,
            time: b.time,
            providerName: b.provider_id?.full_name || "Provider",
            serviceName: b.service_id?.service_name || "Service",
            status: b.status,
            payment_status: b.payment_status,
          });

          if (b.payment_status === "paid" || b.status === "completed") {
            setPaymentDone(true);
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        }
      } catch (error) {
        console.error("checkBooking error:", error);
      }
    }

    void checkBooking();
    intervalRef.current = setInterval(checkBooking, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [bookingId]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* ── Header ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Live Tracking
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Tracking your service provider
              </p>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                connected
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? "bg-green-500 animate-pulse" : "bg-red-500"
                }`}
              />
              {connected ? "Connected" : "Connecting..."}
            </div>
          </div>
        </div>

        {/* ── Booking Info ── */}
        {bookingInfo && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
            <div className="text-sm font-bold text-blue-700 mb-2">
              📅 Booking Details
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-blue-600">
              <div>
                👤{" "}
                <span className="font-semibold">
                  {bookingInfo.providerName}
                </span>
              </div>
              <div>
                🔧{" "}
                <span className="font-semibold">{bookingInfo.serviceName}</span>
              </div>
              <div>
                📅 <span className="font-semibold">{bookingInfo.date}</span>
              </div>
              <div>
                ⏰ <span className="font-semibold">{bookingInfo.time}</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-blue-500">
              Provider automatically shares location from 9:00 AM on your
              booking day
            </div>
          </div>
        )}

        {/* ── Payment Done ── */}
        {paymentDone ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center mb-4">
            <div className="text-5xl mb-3">✅</div>
            <div className="text-xl font-bold text-green-700">
              Service Completed!
            </div>
            <div className="text-sm text-green-600 mt-2">
              Payment received — tracking has ended
            </div>
            <button
              onClick={() => navigate("/customer/dashboard")}
              className="mt-5 px-6 py-2.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* ── Arrived Banner ── */}
            {arrived && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 text-center">
                <div className="text-3xl mb-2">🎉</div>
                <div className="font-bold text-green-700 text-lg">
                  Provider has arrived!
                </div>
                <div className="text-sm text-green-600 mt-1">
                  Your service provider is at your location
                </div>
              </div>
            )}

            {/* ── Map ── */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={providerLocation || defaultCenter}
                  zoom={15}
                >
                  {providerLocation && (
                    <Marker
                      position={providerLocation}
                      label={{ text: "🔧", fontSize: "24px" }}
                    />
                  )}
                </GoogleMap>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-gray-500">
                  Loading map...
                </div>
              )}
            </div>

            {/* ── Status ── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              {providerLocation ? (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                    🔧
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">
                      Provider is on the way
                    </div>
                    <div className="text-sm text-gray-500">
                      Live location updating...
                    </div>
                  </div>
                  <div className="ml-auto w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl">
                    ⏳
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">
                      Waiting for provider
                    </div>
                    <div className="text-sm text-gray-500">
                      Provider location will appear at 9:00 AM on your booking
                      day
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Payment pending notice ── */}
            <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 mb-4">
              <div className="text-sm font-bold text-yellow-700 mb-1">
                💳 Tracking ends when
              </div>
              <div className="text-sm text-yellow-600">
                Location sharing automatically stops once your payment is
                confirmed
              </div>
            </div>
          </>
        )}

        {/* ── Back button ── */}
        {!paymentDone && (
          <button
            onClick={() => navigate("/customer/dashboard")}
            className="w-full py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            ← Back to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
