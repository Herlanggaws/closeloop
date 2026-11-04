import { ReactNode } from "react";

/** Centers a 1440-wide pen artboard for pixel-perfect review. */
export function DesignFrame({
  children,
  height = 900,
  className = "",
}: {
  children: ReactNode;
  height?: number | "auto";
  className?: string;
}) {
  return (
    <main className={`min-h-screen overflow-x-auto bg-[var(--bg-page)] ${className}`}>
      <div
        className="mx-auto w-[1440px]"
        style={height === "auto" ? undefined : { minHeight: height }}
      >
        {children}
      </div>
    </main>
  );
}
