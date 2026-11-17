import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Log in · Saidloop",
  description: "Log in to Saidloop to triage reports and close the loop with your agents.",
};

export default function LoginPage() {
  return <AuthShell mode="login" />;
}
