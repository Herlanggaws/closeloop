"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { SaidloopLogo } from "@/components/SaidloopLogo";

type ConfirmState =
  | { status: "loading" }
  | { status: "ok"; boardSlug: string; email: string }
  | { status: "error"; message: string };

function ConfirmBody() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const [state, setState] = useState<ConfirmState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Missing suggestion confirmation token." });
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/api/public/ideas/confirm?t=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error?.message || "Could not confirm suggestion");
        }
        const suggestion = body.suggestion as { board_slug: string; email: string };
        return suggestion;
      })
      .then((suggestion) => {
        if (cancelled) return;
        setState({
          status: "ok",
          boardSlug: suggestion.board_slug,
          email: suggestion.email,
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Could not confirm suggestion",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto w-full max-w-[440px] rounded-2xl border border-[#17171714] bg-white p-8 text-center">
      {state.status === "loading" ? (
        <p className="font-ds-ui text-sm text-[#737373]">Confirming your idea…</p>
      ) : null}
      {state.status === "ok" ? (
        <>
          <h1 className="font-ds-sans text-xl font-medium text-[#171717]">Idea submitted</h1>
          <p className="mt-2 font-ds-ui text-[13.5px] text-[#737373]">
            Thanks{state.email ? `, ${state.email}` : ""}. We&apos;ll show it after the team
            publishes.
          </p>
          <Link
            href={`/board/${encodeURIComponent(state.boardSlug)}`}
            className="mt-6 inline-flex h-9 items-center rounded-md bg-[#171717] px-4 font-ds-sans text-[13px] font-medium text-white no-underline"
          >
            Back to board
          </Link>
        </>
      ) : null}
      {state.status === "error" ? (
        <>
          <h1 className="font-ds-sans text-xl font-medium text-[#171717]">Link not valid</h1>
          <p className="mt-2 font-ds-ui text-[13.5px] text-[#737373]">{state.message}</p>
          <Link
            href="/"
            className="mt-6 inline-flex h-9 items-center rounded-md border border-[#1717171F] bg-white px-4 font-ds-sans text-[13px] font-medium text-[#171717] no-underline"
          >
            Go home
          </Link>
        </>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#F7F7F7] px-6 py-12">
      <SaidloopLogo href="/" height={20} />
      <Suspense fallback={<p className="font-ds-ui text-sm text-[#737373]">Loading…</p>}>
        <ConfirmBody />
      </Suspense>
    </div>
  );
}
