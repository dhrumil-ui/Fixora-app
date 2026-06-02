const API_BASE =
  (import.meta.env.VITE_API_BASE as string) || "http://localhost:5001";

async function parseJsonSafe(res: Response) {
  // Some endpoints may return empty body (204) or non-json
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function parseError(res: Response) {
  const data: any = await parseJsonSafe(res);
  const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
  throw new Error(msg);
}

function buildUrl(path: string) {
  // allow passing full URL too
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "GET",
    credentials: "include", // ✅ send cookie
  });
  if (!res.ok) await parseError(res);
  return (await parseJsonSafe(res)) as T;
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    credentials: "include", // ✅ send cookie
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res);
  return (await parseJsonSafe(res)) as T;
}

export async function apiPatch<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "PATCH",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res);
  return (await parseJsonSafe(res)) as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) await parseError(res);
  return (await parseJsonSafe(res)) as T;
}
