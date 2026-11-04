import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Log in · Closeloop",
  description: "Log in to Closeloop to triage reports and close the loop with your agents.",
};

export default function LoginPage() {
  return <AuthShell mode="login" />;
}
