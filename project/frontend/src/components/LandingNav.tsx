"use client";

import { useEffect, useState } from "react";
import { SaidloopLogo } from "@/components/SaidloopLogo";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#platforms", label: "Platforms" },
  { href: "#mcp", label: "MCP" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "Docs" },
] as const;

type Props = {
  onJoinWaitlist: () => void;
};

export function LandingNav({ onJoinWaitlist }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav
      id="nav"
      data-pencil-name="Nav"
      aria-label="Primary"
      className="box-border relative z-40 flex h-[60px] w-full shrink-0 items-center justify-between border-b border-solid border-[#17171714] bg-white px-5 sm:h-[67.5px] sm:px-10 lg:px-[max(80px,calc((100%-1280px)/2))]"
    >
      <SaidloopLogo height={22} />

      <div
        data-pencil-name="Links"
        className="hidden w-fit shrink-0 flex-row items-start justify-start gap-8 lg:flex"
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            data-pencil-name={link.label}
            className="box-border cursor-pointer text-left font-ds-ui text-[14px] font-normal tracking-[-0.2px] text-[#737373] no-underline transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] [white-space:nowrap]"
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="flex w-fit shrink-0 flex-row items-center justify-start gap-2">
        <button
          type="button"
          onClick={onJoinWaitlist}
          data-pencil-name="Join waitlist"
          className="box-border hidden h-9 w-fit shrink-0 cursor-pointer flex-row items-center justify-center gap-2 rounded-[6px] border-0 bg-[#171717] px-4 shadow-[0px_4px_4px_#1717170A] no-underline transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:flex"
        >
          <span className="box-border text-left font-ds-sans text-[14px] font-medium tracking-[-0.2px] text-white [white-space:nowrap]">
            Join the waitlist
          </span>
        </button>

        <button
          type="button"
          className="box-border flex h-11 w-11 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent text-[#171717] lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      {menuOpen ? (
        <div
          id="mobile-nav-menu"
          className="absolute left-0 top-full flex w-full flex-col gap-1 border-b border-solid border-[#17171714] bg-white px-5 py-4 shadow-[0px_12px_32px_#17171714] lg:hidden"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className="box-border flex min-h-11 items-center rounded-[8px] px-3 font-ds-ui text-[15px] font-normal tracking-[-0.2px] text-[#171717] no-underline transition-colors hover:bg-[#F5F5F5]"
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              closeMenu();
              onJoinWaitlist();
            }}
            className="mt-2 box-border flex h-11 w-full cursor-pointer items-center justify-center rounded-[6px] border-0 bg-[#171717] font-ds-sans text-[14px] font-medium tracking-[-0.2px] text-white shadow-[0px_4px_4px_#1717170A]"
          >
            Join the waitlist
          </button>
        </div>
      ) : null}
    </nav>
  );
}
