import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  receipt: {
    paymentId: string;
    bookingId: string;
    serviceName: string;
    providerName: string;
    customerName?: string;
    customerEmail?: string;
    amount: number;
    bookingDate?: string;
    bookingTime?: string;
  };
};

export default function PaymentReceiptModal({ open, onClose, receipt }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const amountStr = `$${Number(receipt.amount).toFixed(2)}`;

  function handlePrint() {
    window.print();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          background: "white",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)",
            color: "white",
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>
            Payment Successful
          </div>
          <div style={{ marginTop: 6, opacity: 0.9, fontSize: 14 }}>
            A receipt has been sent to your email
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          <div
            style={{
              textAlign: "center",
              marginBottom: 20,
              paddingBottom: 20,
              borderBottom: "2px dashed #E5E7EB",
            }}
          >
            <div style={{ fontSize: 13, color: "#6B7280" }}>Total Paid</div>
            <div
              style={{
                fontSize: 40,
                fontWeight: 900,
                color: "#16A34A",
                marginTop: 4,
              }}
            >
              {amountStr}
            </div>
          </div>

          <div style={{ display: "grid", gap: 12, fontSize: 14 }}>
            <Row label="Service" value={receipt.serviceName || "—"} />
            <Row label="Provider" value={receipt.providerName || "—"} />
            {receipt.bookingDate && (
              <Row
                label="Booking"
                value={`${receipt.bookingDate}${receipt.bookingTime ? ` at ${receipt.bookingTime}` : ""}`}
              />
            )}
            <Row label="Booking ID" value={receipt.bookingId} mono />
            <Row label="Payment ID" value={receipt.paymentId} mono />
            {receipt.customerEmail && (
              <Row label="Receipt sent to" value={receipt.customerEmail} />
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button
              onClick={handlePrint}
              style={{
                flex: 1,
                padding: "12px 18px",
                border: "1px solid #D1D5DB",
                borderRadius: 12,
                background: "white",
                color: "#374151",
                fontWeight: 800,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              🖨️ Print
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 2,
                padding: "12px 18px",
                border: "none",
                borderRadius: 12,
                background: "#2563EB",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ color: "#6B7280" }}>{label}</span>
      <span
        style={{
          fontWeight: 700,
          color: "#111827",
          fontFamily: mono ? "monospace" : "inherit",
          fontSize: mono ? 13 : 14,
        }}
      >
        {value}
      </span>
    </div>
  );
}
