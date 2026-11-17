"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseloopLogo } from "@/components/CloseloopLogo";
import { API_URL, api } from "@/lib/api";

type Peek = {
  email: string;
  role: string;
  org_name: string;
  expires_at: string;
  expired: boolean;
};

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";

  const [peek, setPeek] = useState<Peek | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid invite link");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const access = localStorage.getItem("closeloop_access");
    setSignedIn(!!access);

    fetch(`${API_URL}/api/invites/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error?.message || "Invite not found");
        }
        return data.invite as Peek;
      })
      .then((inv) => {
        if (!cancelled) setPeek(inv);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Invite not found");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    if (!token) return;
    setAccepting(true);
    setError("");
    try {
      await api(`/api/invites/${encodeURIComponent(token)}/accept`, { method: "POST" });
      router.replace("/app/inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
    } finally {
      setAccepting(false);
    }
  }

  function goAuth(path: string) {
    const next = `/invite/${token}`;
    router.push(`${path}?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F7F7]">
      <header className="flex h-16 items-center border-b border-[#17171714] bg-white px-8">
        <CloseloopLogo />
      </header>
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-4 py-12">
        <div className="rounded-2xl border border-[#17171714] bg-white p-8 shadow-[0_4px_4px_#1717170A]">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading invite…</p>
          ) : error && !peek ? (
            <p className="font-ds-ui text-sm text-[#DA314A]">{error}</p>
          ) : peek ? (
            <>
              <h1 className="font-ds-sans text-[24px] font-medium tracking-[-0.5px] text-[#171717]">
                Join {peek.org_name}
              </h1>
              <p className="mt-2 font-ds-ui text-[14px] text-[#737373]">
                You were invited as <strong className="text-[#171717]">{peek.role}</strong> (
                {peek.email}).
              </p>
              {peek.expired ? (
                <p className="mt-4 font-ds-ui text-sm text-[#DA314A]">
                  This invite has expired. Ask an owner to resend it.
                </p>
              ) : signedIn ? (
                <button
                  type="button"
                  disabled={accepting}
                  onClick={() => void accept()}
                  className="mt-6 inline-flex h-10 cursor-pointer items-center rounded-md bg-[#171717] px-4 font-ds-sans text-sm font-medium text-white disabled:opacity-50"
                >
                  {accepting ? "Joining…" : "Accept invite"}
                </button>
              ) : (
                <div className="mt-6 flex flex-col gap-2">
                  <p className="font-ds-ui text-[13px] text-[#737373]">
                    Sign in with {peek.email} to accept.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => goAuth("/login")}
                      className="inline-flex h-10 cursor-pointer items-center rounded-md bg-[#171717] px-4 font-ds-sans text-sm font-medium text-white"
                    >
                      Log in
                    </button>
                    <button
                      type="button"
                      onClick={() => goAuth("/signup")}
                      className="inline-flex h-10 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-4 font-ds-sans text-sm font-medium text-[#171717]"
                    >
                      Sign up
                    </button>
                  </div>
                </div>
              )}
              {error && <p className="mt-3 font-ds-ui text-sm text-[#DA314A]">{error}</p>}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
