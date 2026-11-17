import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppAuthGate } from "@/components/AppAuthGate";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppAuthGate>{children}</AppAuthGate>;
}
