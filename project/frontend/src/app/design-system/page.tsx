import type { Metadata } from "next";
import { Foundation } from "./Foundation";

export const metadata: Metadata = {
  title: "Design System · Closeloop",
  description: "Closeloop design system foundations — color, type, spacing, radius, elevation, and components.",
};

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen overflow-x-auto bg-[var(--bg-page)]">
      <div className="mx-auto w-[1440px]">
        <Foundation />
      </div>
    </main>
  );
}
