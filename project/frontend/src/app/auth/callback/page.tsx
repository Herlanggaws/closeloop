"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAccessToken } from "@/lib/api";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("access_token");
    const isNew = searchParams.get("new") === "1";
    const error = searchParams.get("error");

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (token) {
      setAccessToken(token);
      router.replace(isNew ? "/app/onboarding" : "/app/inbox");
      return;
    }

    router.replace("/login");
  }, [router, searchParams]);

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--surface)] font-ds-ui text-[14px] text-[var(--text-secondary)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent)]" />
        <span>Completing Google sign in…</span>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-[var(--surface)] font-ds-ui text-[14px] text-[var(--text-secondary)]">
          Signing in…
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
