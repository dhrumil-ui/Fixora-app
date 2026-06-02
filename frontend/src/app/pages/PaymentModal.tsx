// frontend/src/app/pages/PaymentModal.tsx
import { useEffect, useState } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getStripe } from "../lib/stripe";
import PaymentReceiptModal from "../pages/PaymentReceiptModal";
import { useAuthStore } from "../auth.store";

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  "http://localhost:5001";

type Props = {
  open: boolean;
  bookingId: string | null;
  amount: number;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
};

/**
 * Inner form using Stripe hooks - must be inside <Elements>
 */
function StripeCheckoutForm({
  onSuccess,
  onClose,
  paymentId,
  amount,
  currency,
}: {
  onSuccess: (receiptData: any) => void;
  onClose: () => void;
  paymentId: string;
  amount: number;
  currency: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError("");

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/customer/dashboard`,
      },
    });

    if (stripeError) {
      setError(stripeError.message || "Payment failed");
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      try {
        const res = await fetch(`${API_BASE}/api/payments/confirm`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_id: paymentId,
            stripe_intent_id: paymentIntent.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Confirmation failed");

        // Pass receipt data back
        onSuccess({
          paymentId: String(paymentId).slice(-8).toUpperCase(),
          bookingId: data.booking_id
            ? String(data.booking_id).slice(-8).toUpperCase()
            : "—",
          serviceName: data.service_name || "—",
          providerName: data.provider_name || "—",
          customerEmail: data.customer_email || "",
          amount,
          bookingDate: data.booking_date || "",
          bookingTime: data.booking_time || "",
        });
      } catch (err: any) {
        setError(err.message || "Confirmation failed");
      } finally {
        setLoading(false);
      }
    } else {
      setError("Payment did not complete");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-gray-200 p-4 bg-white">
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: { applePay: "auto", googlePay: "auto" },
            terms: { card: "never" },
          }}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <div className="text-xs font-bold text-blue-700 mb-1">🧪 TEST MODE</div>
        <div className="text-sm text-blue-800">
          Use test card:{" "}
          <code className="bg-white px-2 py-0.5 rounded font-mono text-xs">
            4242 4242 4242 4242
          </code>
        </div>
        <div className="text-xs text-blue-700 mt-1">
          Any future date, any CVC, any ZIP
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded-xl border border-gray-200 px-5 py-3 font-semibold hover:bg-gray-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="rounded-xl bg-[#2563EB] px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading
            ? "Processing..."
            : `Pay ${currency.toUpperCase()} $${amount.toFixed(2)}`}
        </button>
      </div>
    </form>
  );
}

/**
 * Main modal - creates Payment Intent then renders Elements
 */
export default function PaymentModal({
  open,
  bookingId,
  amount,
  currency,
  onClose,
  onSuccess,
}: Props) {
  const [clientSecret, setClientSecret] = useState<string>("");
  const [paymentId, setPaymentId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [receiptData, setReceiptData] = useState<any>(null);
  const [payMethod, setPayMethod] = useState<"card" | "cash">("card");
  const [cashSubmitting, setCashSubmitting] = useState(false);

  // ── Cashback ──
  const me = useAuthStore((s) => s.me);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const cashbackBalance = Number(me?.cashback_balance || 0);
  const [useCashback, setUseCashback] = useState(false);
  const [cashbackInput, setCashbackInput] = useState("");
  // Max usable = balance, but cap at amount-$0.50 for card (stripe min) or amount for cash
  const cashbackMax = Math.max(
    0,
    Math.min(
      cashbackBalance,
      payMethod === "card" ? Math.max(0, amount - 0.5) : amount,
    ),
  );
  const cashbackApplied = useCashback
    ? Math.min(Number(cashbackInput || 0), cashbackMax)
    : 0;
  const netAmount = Math.max(
    0,
    Math.round((amount - cashbackApplied) * 100) / 100,
  );

  async function submitCash() {
    setCashSubmitting(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/api/bookings/${bookingId}/pay-cash`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apply_cashback: cashbackApplied }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed");
      // Refresh balance after spend+earn
      try {
        await refreshMe();
      } catch {
        /* ignore */
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to mark cash payment");
    } finally {
      setCashSubmitting(false);
    }
  }

  useEffect(() => {
    if (!open || !bookingId) {
      setClientSecret("");
      setPaymentId("");
      setError("");
      return;
    }
    if (payMethod !== "card") {
      setClientSecret("");
      setPaymentId("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/payments/intent`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: bookingId,
            method: "card",
            apply_cashback: cashbackApplied,
          }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Failed to create payment");
        if (cancelled) return;
        setClientSecret(data.client_secret);
        setPaymentId(data.payment_id);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load payment");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, bookingId, payMethod, cashbackApplied]);

  if (!open && !receiptData) return null;

  const stripePromise = getStripe();

  // Show receipt modal after payment success
  if (receiptData) {
    return (
      <PaymentReceiptModal
        open={true}
        onClose={() => {
          setReceiptData(null);
          // Refresh balance after card success
          refreshMe().catch(() => {});
          onSuccess(); // refresh dashboard
        }}
        receipt={receiptData}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Complete Payment
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Secure payment powered by Stripe
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mb-5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="text-gray-700">
              {currency.toUpperCase()} ${amount.toFixed(2)}
            </span>
          </div>
          {cashbackApplied > 0 && (
            <div className="flex justify-between text-sm mt-1 text-amber-700">
              <span>💰 Cashback applied</span>
              <span className="font-semibold">
                −${cashbackApplied.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-200">
            <span className="text-gray-600">Amount due</span>
            <span className="font-bold text-gray-900">
              {currency.toUpperCase()} ${netAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Cashback toggle */}
        {cashbackBalance > 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-gradient-to-br from-yellow-50 to-amber-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">💰</span>
                <div>
                  <div className="text-sm font-bold text-amber-900">
                    Cashback Balance
                  </div>
                  <div className="text-xs text-amber-700">
                    ${cashbackBalance.toFixed(2)} available
                  </div>
                </div>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCashback}
                  onChange={(e) => {
                    setUseCashback(e.target.checked);
                    if (e.target.checked) {
                      setCashbackInput(String(cashbackMax.toFixed(2)));
                    } else {
                      setCashbackInput("");
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
            {useCashback && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-amber-900 mb-1">
                  Apply amount (max ${cashbackMax.toFixed(2)})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={cashbackMax}
                  value={cashbackInput}
                  onChange={(e) => setCashbackInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            )}
          </div>
        )}

        {/* Payment method toggle */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            type="button"
            onClick={() => setPayMethod("card")}
            className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm transition ${
              payMethod === "card"
                ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            💳 Pay by Card
          </button>
          <button
            type="button"
            onClick={() => setPayMethod("cash")}
            className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm transition ${
              payMethod === "cash"
                ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            💵 Pay by Cash
          </button>
        </div>

        {/* Cash flow */}
        {payMethod === "cash" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-semibold mb-1">Pay on arrival</div>
              <div className="text-amber-800">
                Pay the provider <b>${netAmount.toFixed(2)}</b> in cash when
                they arrive. Provider will mark the booking as paid after
                receiving.
              </div>
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                ⚠️ {error}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={cashSubmitting}
                className="rounded-xl border border-gray-200 px-5 py-2.5 font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitCash()}
                disabled={cashSubmitting}
                className="rounded-xl bg-[#2563EB] px-6 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {cashSubmitting ? "Confirming..." : "Confirm Cash Payment"}
              </button>
            </div>
          </div>
        )}

        {payMethod === "card" && loading && (
          <div className="text-center py-8 text-gray-500">
            Loading payment form...
          </div>
        )}

        {payMethod === "card" && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
            ⚠️ {error}
            <button onClick={onClose} className="ml-3 underline font-semibold">
              Close
            </button>
          </div>
        )}

        {payMethod === "card" && clientSecret && !loading && !error && (
          <Elements
            key={clientSecret}
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#2563EB",
                  borderRadius: "12px",
                },
              },
            }}
          >
            <StripeCheckoutForm
              onSuccess={(data) => setReceiptData(data)}
              onClose={onClose}
              paymentId={paymentId}
              amount={netAmount}
              currency={currency}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}
