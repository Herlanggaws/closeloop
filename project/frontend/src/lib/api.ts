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
  localStorage.removeItem("closeloop_project");
  localStorage.removeItem("closeloop_public_key");
}

export function clearProjectSelection() {
  localStorage.removeItem("closeloop_project");
  localStorage.removeItem("closeloop_public_key");
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        access_token?: string;
      };
      if (!res.ok || !data.access_token) return false;
      setAccessToken(data.access_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function redirectToLogin() {
  clearSession();
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  window.location.replace("/login");
}

function isAuthPath(path: string) {
  return path.startsWith("/api/auth/");
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  if (!isAuthPath(path) && path.startsWith("/api/") && !token()) {
    redirectToLogin();
    throw new Error("Not signed in");
  }

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

  if (res.status === 401 && !retried && !isAuthPath(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return api<T>(path, init, true);
    redirectToLogin();
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const err = data as ApiError;
    throw new Error(err.error?.message || res.statusText);
  }
  return data as T;
}

export { API_URL };
