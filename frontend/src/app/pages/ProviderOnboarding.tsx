import React, { JSX, useState } from "react";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:5001";

type MeUser = {
  _id: string;
  full_name?: string;
  email?: string;
  provider_status?: string;
  provider_profile?: any;
};

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data as T;
}

export default function ProviderOnboarding(props: {
  me: MeUser | null;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const { me, onSaved } = props;

  const [phone, setPhone] = useState(me?.provider_profile?.phone || "");
  const [ssnLast4, setSsnLast4] = useState(
    me?.provider_profile?.ssn_last4 || "",
  );
  const [address1, setAddress1] = useState(
    me?.provider_profile?.address_line1 || "",
  );
  const [city, setCity] = useState(me?.provider_profile?.city || "");
  const [state, setState] = useState(me?.provider_profile?.state || "");
  const [zip, setZip] = useState(me?.provider_profile?.zip || "");
  const [photoUrl, setPhotoUrl] = useState(
    me?.provider_profile?.photo_url || "",
  );
  const [docUrl, setDocUrl] = useState(
    me?.provider_profile?.verification_doc_url || "",
  );
  const [bio, setBio] = useState(me?.provider_profile?.bio || "");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (
      !phone.trim() ||
      !/^\d{4}$/.test(String(ssnLast4).trim()) ||
      !address1.trim() ||
      !city.trim() ||
      !state.trim() ||
      !zip.trim()
    ) {
      setError(
        "Please fill required fields: Phone, SSN last4, Address, City, State, Zip.",
      );
      return;
    }

    setSaving(true);
    try {
      // ✅ Your backend should have one endpoint like this:
      // PUT /api/provider/profile  (or /api/provider/onboarding)
      await apiFetch("/api/provider/profile", {
        method: "PUT",
        body: JSON.stringify({
          phone: phone.trim(),
          ssn_last4: String(ssnLast4).trim(),
          address_line1: address1.trim(),
          city: city.trim(),
          state: state.trim(),
          zip: zip.trim(),
          photo_url: photoUrl.trim(),
          verification_doc_url: docUrl.trim(),
          bio: bio.trim(),
          submit: true,
        }),
      });

      await onSaved(); // reload dashboard data
    } catch (e2: any) {
      setError(e2?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateBio() {
    setAiLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:5001/api/ai/provider/bio", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: "",
          tone: "professional",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to generate");
      setBio(data.bio);
    } catch (e: any) {
      setError(e?.message || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <h1 style={{ margin: 0, fontSize: 34 }}>Complete Provider Profile</h1>
      <div style={{ marginTop: 6, color: "#667085" }}>
        Hi <b>{me?.full_name || "Provider"}</b> — you must complete this once
        before adding services.
      </div>

      {error ? (
        <div
          style={{
            marginTop: 16,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            padding: 12,
            borderRadius: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 14,
        }}
      >
        <form
          onSubmit={submit}
          style={{
            background: "white",
            border: "1px solid #EAECF0",
            borderRadius: 16,
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            Basic Details (Required)
          </div>

          <Field label="Phone *">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={input}
              placeholder="e.g. 2011234567"
            />
          </Field>

          <Field label="SSN Last 4 *">
            <input
              value={ssnLast4}
              onChange={(e) => setSsnLast4(e.target.value)}
              style={input}
              placeholder="1234"
              maxLength={4}
            />
          </Field>

          <Field label="Address Line 1 *">
            <input
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
              style={input}
              placeholder="12 Main St"
            />
          </Field>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
            }}
          >
            <Field label="City *">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={input}
                placeholder="Hoboken"
              />
            </Field>
            <Field label="State *">
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                style={input}
                placeholder="NJ"
              />
            </Field>
            <Field label="Zip *">
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                style={input}
                placeholder="07030"
              />
            </Field>
          </div>

          <div style={{ marginTop: 6, fontWeight: 800, fontSize: 18 }}>
            Verification (Optional for now)
          </div>

          <Field label="Photo URL">
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              style={input}
              placeholder="https://..."
            />
          </Field>

          <Field label="Verification Document URL">
            <input
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              style={input}
              placeholder="https://..."
            />
          </Field>

          <Field label="Bio (about yourself)">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell customers about your experience, specialties, availability..."
              rows={4}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #D1D5DB",
                borderRadius: 10,
                fontSize: 14,
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={() => void handleGenerateBio()}
              disabled={aiLoading}
              style={{
                marginTop: 8,
                padding: "8px 16px",
                background: aiLoading
                  ? "#A5B4FC"
                  : "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
                color: "white",
                border: "none",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: aiLoading ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {aiLoading ? "✨ Generating..." : "✨ Generate Bio with AI"}
            </button>
          </Field>

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: 6,
              background: saving ? "#94A3B8" : "#2563EB",
              color: "white",
              border: "none",
              padding: "12px 14px",
              borderRadius: 12,
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            {saving ? "Saving..." : "Submit Profile"}
          </button>
        </form>

        <div
          style={{
            background: "white",
            border: "1px solid #EAECF0",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 800 }}>What happens after submit?</div>
          <ul style={{ marginTop: 10, color: "#475467", lineHeight: 1.7 }}>
            <li>
              Status becomes <b>pending verification</b> (you can keep
              auto-approved for now).
            </li>
            <li>
              You can create your <b>first service</b>.
            </li>
            <li>
              Your services will appear in <b>Find Services</b>.
            </li>
          </ul>

          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: "#F8FAFC",
              borderRadius: 12,
              color: "#475467",
            }}
          >
            <b>Tip:</b> Later you can replace URL fields with real file upload
            (S3/Cloudinary).
          </div>
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#344054" }}>
        {props.label}
      </div>
      {props.children}
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid #D0D5DD",
  borderRadius: 12,
  padding: "12px 12px",
  outline: "none",
  fontSize: 14,
};
