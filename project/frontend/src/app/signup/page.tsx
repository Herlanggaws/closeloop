import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your Saidloop account. Free plan, no card needed.",
};

export default function SignupPage() {
  return <AuthShell mode="signup" />;
}
