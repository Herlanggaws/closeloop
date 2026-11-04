"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./ui";

const items = [
  { href: "/app/inbox", label: "Inbox" },
  { href: "/app/settings", label: "Project settings" },
  { href: "/app/onboarding", label: "Install" },
];

export function Sidebar({ projectName = "Project" }: { projectName?: string }) {
  const path = usePathname();
  return (
    <aside className="flex h-screen w-[248px] flex-col border-r border-line bg-surface">
      <div className="border-b border-line px-4 py-4">
        <Logo />
        <p className="mt-3 truncate text-sm text-muted">{projectName}</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-[10px] px-3 py-2 text-sm ${active ? "bg-neutral-100 font-medium text-ink" : "text-muted hover:bg-neutral-50 hover:text-ink"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
