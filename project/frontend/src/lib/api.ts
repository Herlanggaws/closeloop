const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type ApiError = { error: { code: string; message: string } };

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("closeloop_access");
}

export function setAccessToken(t: string) {
  localStorage.setItem("closeloop_access", t);
}

export function clearSession() {
  localStorage.removeItem("closeloop_access");
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const t = token();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as ApiError;
    throw new Error(err.error?.message || res.statusText);
  }
  return data as T;
}

export { API_URL };
