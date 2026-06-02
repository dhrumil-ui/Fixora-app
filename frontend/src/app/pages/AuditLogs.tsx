import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:5001";

type AuditLog = {
  _id: string;
  actor_email: string;
  actor_role: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: any;
  ip_address?: string;
  createdAt: string;
};

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data as T;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (actionFilter) params.set("action", actionFilter);

      const data = await apiFetch<{
        logs: AuditLog[];
        totalPages: number;
      }>(`/api/admin/audit-logs?${params}`);
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter]);

  async function loadActions() {
    try {
      const data = await apiFetch<{ actions: string[] }>(
        "/api/admin/audit-logs/actions",
      );
      setActions(data.actions || []);
    } catch {
      // ignore errors silently
    }
  }

  useEffect(() => {
    void loadActions();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void load();
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function actionBadgeColor(action: string) {
    if (action.includes("DELETE")) return { bg: "#FEF2F2", fg: "#B91C1C" };
    if (action.includes("DEACTIVATE")) return { bg: "#FEF3C7", fg: "#92400E" };
    if (action.includes("RESOLVE") || action.includes("APPROVE"))
      return { bg: "#ECFDF3", fg: "#166534" };
    if (action.includes("REFUND")) return { bg: "#EFF6FF", fg: "#1D4ED8" };
    return { bg: "#F3F4F6", fg: "#374151" };
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 18 }}>
        <h1
          style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#111827" }}
        >
          Audit Logs
        </h1>
        <div style={{ marginTop: 4, color: "#6B7280" }}>
          Track every admin action. Read-only.
        </div>
      </div>

      <div
        style={{
          background: "white",
          border: "1px solid #E5E7EB",
          borderRadius: 18,
          padding: 16,
          marginBottom: 16,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by admin email or action..."
          style={{
            flex: 1,
            minWidth: 240,
            padding: "10px 14px",
            border: "1px solid #D1D5DB",
            borderRadius: 10,
            fontSize: 14,
            outline: "none",
          }}
        />
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          style={{
            padding: "10px 14px",
            border: "1px solid #D1D5DB",
            borderRadius: 10,
            fontSize: 14,
            outline: "none",
            minWidth: 200,
          }}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          background: "white",
          border: "1px solid #E5E7EB",
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {error && (
          <div
            style={{
              background: "#FEF2F2",
              color: "#991B1B",
              padding: 12,
              borderBottom: "1px solid #FECACA",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 24, color: "#6B7280" }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 24, color: "#6B7280" }}>
            No audit logs yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "#F9FAFB",
                  color: "#6B7280",
                  fontSize: 13,
                }}
              >
                <th style={th}>When</th>
                <th style={th}>Admin</th>
                <th style={th}>Action</th>
                <th style={th}>Target</th>
                <th style={th}>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const c = actionBadgeColor(l.action);
                const detailsStr =
                  l.details && Object.keys(l.details).length
                    ? JSON.stringify(l.details)
                    : "";
                return (
                  <tr key={l._id} style={{ borderTop: "1px solid #E5E7EB" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>
                        {new Date(l.createdAt).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                        {new Date(l.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{l.actor_email}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                        {l.actor_role}
                      </div>
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          background: c.bg,
                          color: c.fg,
                        }}
                      >
                        {l.action}
                      </span>
                      {detailsStr && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: "#6B7280",
                            fontFamily: "monospace",
                            maxWidth: 300,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={detailsStr}
                        >
                          {detailsStr}
                        </div>
                      )}
                    </td>
                    <td style={td}>
                      {l.target_type ? (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {l.target_type}
                          </div>
                          {l.target_id && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#9CA3AF",
                                fontFamily: "monospace",
                              }}
                            >
                              {String(l.target_id).slice(-8)}
                            </div>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ ...td, fontSize: 12, color: "#6B7280" }}>
                      {l.ip_address || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div
            style={{
              padding: 16,
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, color: "#6B7280" }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: "8px 14px",
                  border: "1px solid #D1D5DB",
                  borderRadius: 10,
                  background: "white",
                  cursor: page === 1 ? "not-allowed" : "pointer",
                  opacity: page === 1 ? 0.4 : 1,
                  fontWeight: 700,
                }}
              >
                ‹ Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: "8px 14px",
                  border: "1px solid #D1D5DB",
                  borderRadius: 10,
                  background: "white",
                  cursor: page === totalPages ? "not-allowed" : "pointer",
                  opacity: page === totalPages ? 0.4 : 1,
                  fontWeight: 700,
                }}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontWeight: 800,
};

const td: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  verticalAlign: "top",
  color: "#111827",
};
