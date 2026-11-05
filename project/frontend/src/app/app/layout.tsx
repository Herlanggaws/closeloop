"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

/** Auth gate only — each screen artboard includes its own sidebar chrome. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const token = localStorage.getItem("closeloop_access");
    if (!token) {
      router.replace("/login");
      return;
    }

    const timeout = window.setTimeout(() => {
      if (!cancelled) router.replace("/login");
    }, 8000);

    api<{ projects: { id?: string; ID?: string }[] }>("/api/projects")
      .then((res) => {
        if (cancelled) return;
        const p = res.projects?.[0];
        if (p) {
          localStorage.setItem("closeloop_project", p.id || p.ID || "");
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-page)] font-ds-ui text-sm text-[var(--text-secondary)]">
        Loading…
      </div>
    );
  }

  return children;
}
