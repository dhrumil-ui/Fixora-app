import { useEffect, useState } from "react";
import { AlertTriangle, X, Info } from "lucide-react";

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  "http://localhost:5001";

type PolicyTier = {
  label: string;
  refund: string;
  tier: string;
};

type Preview = {
  booking_id: string;
  total_amount: number;
  payment_status: string;
  policy: {
    tiers: PolicyTier[];
    notes: string[];
  };
  preview: {
    policy_applied: string;
    refund_pct: number;
    refund_amount: number;
    hours_remaining: number;
    reason_label: string;
  };
};

const tierColor = (tier: string, applied: string) => {
  if (tier !== applied) return "bg-gray-50 border-gray-200 text-gray-600";
  if (tier === "full_refund")
    return "bg-green-50 border-green-300 text-green-800";
  if (tier === "partial_refund")
    return "bg-yellow-50 border-yellow-300 text-yellow-800";
  return "bg-red-50 border-red-300 text-red-800";
};

export default function CancellationModal({
  bookingId,
  onClose,
  onSuccess,
}: {
  bookingId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError("");
    fetch(`${API_BASE}/api/bookings/${bookingId}/cancellation-preview`, {
      credentials: "include",
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.message || "Failed to load policy");
        return data as Preview;
      })
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((e) => {
        if (!cancelled) setPreviewError(e.message || "Failed to load policy");
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Cancel failed");
      onSuccess();
      onClose();
    } catch (e: any) {
      setSubmitError(e.message || "Cancel failed");
    } finally {
      setSubmitting(false);
    }
  };

  const refundAmount = preview?.preview.refund_amount ?? 0;
  const refundPct = preview?.preview.refund_pct ?? 0;
  const isPaid = preview?.payment_status === "paid";
  const total = preview?.total_amount ?? 0;
  const lossAmount = isPaid ? Math.max(total - refundAmount, 0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-100 p-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Cancel Booking
              </h2>
              <p className="text-sm text-gray-600">
                Review the cancellation policy before confirming.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {loadingPreview && (
            <div className="text-center py-8 text-gray-500">
              Loading policy...
            </div>
          )}

          {previewError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {previewError}
            </div>
          )}

          {preview && (
            <>
              {/* Refund preview banner */}
              <div
                className={`rounded-xl border-2 px-5 py-4 ${
                  refundPct === 100
                    ? "border-green-300 bg-green-50"
                    : refundPct > 0
                      ? "border-yellow-300 bg-yellow-50"
                      : "border-red-300 bg-red-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Info
                    className={`h-5 w-5 mt-0.5 ${
                      refundPct === 100
                        ? "text-green-600"
                        : refundPct > 0
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {preview.preview.reason_label}
                    </p>
                    {isPaid ? (
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Booking total</span>
                          <span className="font-medium text-gray-900">
                            ${total.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Refund ({refundPct}%)
                          </span>
                          <span className="font-bold text-green-700">
                            ${refundAmount.toFixed(2)}
                          </span>
                        </div>
                        {lossAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Cancellation fee
                            </span>
                            <span className="font-medium text-red-700">
                              -${lossAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-gray-700">
                        No payment has been made yet, so no refund is needed.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Policy tiers */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Cancellation Policy
                </h3>
                <div className="space-y-2">
                  {preview.policy.tiers.map((t) => (
                    <div
                      key={t.tier}
                      className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${tierColor(
                        t.tier,
                        preview.preview.policy_applied,
                      )}`}
                    >
                      <span className="font-medium">{t.label}</span>
                      <span className="font-semibold">{t.refund}</span>
                    </div>
                  ))}
                </div>
                <ul className="mt-3 space-y-1 text-xs text-gray-600">
                  {preview.policy.notes.map((n, i) => (
                    <li key={i}>• {n}</li>
                  ))}
                </ul>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Reason for cancellation{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Help us improve — let us know why you're cancelling..."
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
                <div className="text-right text-xs text-gray-400 mt-1">
                  {reason.length}/500
                </div>
              </div>

              {submitError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Keep Booking
          </button>
          <button
            onClick={submit}
            disabled={submitting || loadingPreview || !!previewError}
            className="rounded-xl bg-red-600 px-6 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {submitting ? "Cancelling..." : "Confirm Cancellation"}
          </button>
        </div>
      </div>
    </div>
  );
}
