import type { Metadata } from "next";
import { LandingPageDesign } from "./LandingPage";
import { GoogleOneTap } from "@/components/GoogleOneTap";

export const metadata: Metadata = {
  title: "Closeloop — Users report it. Your AI fixes it.",
  description:
    "Bug reports and ideas from inside your app, ready for Cursor or Claude Code over MCP. When the fix ships, Closeloop tells them it's done.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-auto bg-[var(--bg-page)]">
      <GoogleOneTap />
      <div className="mx-auto w-[1440px]">
        <LandingPageDesign />
      </div>
    </main>
  );
}
