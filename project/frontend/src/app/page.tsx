import type { Metadata } from "next";
import { Suspense } from "react";
import { LandingShell } from "@/components/LandingShell";
import { LandingJsonLd } from "@/components/LandingJsonLd";
import { GoogleOneTap } from "@/components/GoogleOneTap";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
};

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--bg-page)]">
      <LandingJsonLd />
      <GoogleOneTap />
      <div className="w-full">
        <Suspense fallback={null}>
          <LandingShell />
        </Suspense>
      </div>
    </main>
  );
}
