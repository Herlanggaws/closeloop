"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, clearProjectSelection, clearSession } from "@/lib/api";

type ProjectRow = { id?: string; ID?: string };

function projectIdOf(p: ProjectRow) {
  return p.id || p.ID || "";
}

/** Auth gate only — each screen artboard includes its own sidebar chrome. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const access = localStorage.getItem("closeloop_access");
    if (!access) {
      clearSession();
      router.replace("/login");
      return;
    }

    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        clearSession();
        router.replace("/login");
      }
    }, 8000);

    api<{ projects: ProjectRow[] }>("/api/projects")
      .then((res) => {
        if (cancelled) return;

        const projects = res.projects || [];
        const onOnboarding = pathname?.startsWith("/app/onboarding");

        if (projects.length === 0) {
          clearProjectSelection();
          setReady(true);
          if (!onOnboarding) {
            router.replace("/app/onboarding");
          }
          return;
        }

        // Allow creating another project without forcing a selection back.
        if (onOnboarding && pathname === "/app/onboarding") {
          setReady(true);
          return;
        }

        const stored = localStorage.getItem("closeloop_project") || "";
        const match = projects.find((p) => projectIdOf(p) === stored);
        const chosen = match || projects[0];
        const id = projectIdOf(chosen);
        if (id) localStorage.setItem("closeloop_project", id);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        router.replace("/login");
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-page)] font-ds-ui text-sm text-[var(--text-secondary)]">
        Loading…
      </div>
    );
  }

  return children;
}
