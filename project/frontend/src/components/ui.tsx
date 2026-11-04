import Link from "next/link";
import { ReactNode } from "react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-semibold tracking-tight text-ink ${className}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-sm text-white">C</span>
      Closeloop
    </Link>
  );
}

export function Button({
  children,
  href,
  variant = "primary",
  className = "",
  ...props
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium transition disabled:opacity-50";
  const styles = {
    primary: "bg-ink text-white hover:bg-neutral-800",
    secondary: "border border-line bg-surface text-ink hover:bg-neutral-50",
    ghost: "text-muted hover:text-ink",
  }[variant];
  if (href) {
    return (
      <Link href={href} className={`${base} ${styles} ${className}`}>
        {children}
      </Link>
    );
  }
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-blue-50 text-info",
    in_progress: "bg-orange-50 text-warning",
    fixed: "bg-green-50 text-success",
    wont_fix: "bg-neutral-100 text-muted",
    duplicate: "bg-purple-50 text-purple-700",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] || "bg-neutral-100"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-neutral-400 ${props.className || ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-neutral-400 ${props.className || ""}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[16px] border border-line bg-surface p-6 shadow-sm ${className}`}>{children}</div>;
}
