import type { ReactNode } from "react";
import Link from "next/link";
import { SaidloopLogo } from "@/components/SaidloopLogo";
import { MarketingFooter } from "@/components/MarketingFooter";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)]">
      <header className="sticky top-0 z-10 box-border flex h-[64px] w-full shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface)] px-6 sm:px-12 lg:px-20">
        <SaidloopLogo height={20} href="/" />
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="font-ds-ui text-[14px] font-medium text-[var(--text-secondary)] no-underline transition-opacity hover:opacity-80"
          >
            Log in
          </Link>
          <Link
            href="/?join=1"
            className="font-ds-ui rounded-[var(--radius-sm)] bg-[var(--surface-inverse)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-inverse)] no-underline transition-opacity hover:opacity-90"
          >
            Join waitlist
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-12 sm:px-8 sm:py-16 lg:max-w-[800px]">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
