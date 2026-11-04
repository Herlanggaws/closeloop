"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

/** Auth gate only — each screen artboard includes its own sidebar chrome. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api<{ projects: { ID?: string; id?: string; Name?: string; name?: string }[] }>("/api/projects")
      .then((res) => {
        const p = res.projects?.[0];
        if (p) {
          const id = p.id || p.ID || "";
          localStorage.setItem("closeloop_project", id);
        }
        setReady(true);
      })
      .catch(() => router.replace("/login"));
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
