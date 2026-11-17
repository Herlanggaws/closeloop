import type { Metadata } from "next";
import { SSO } from "@/design-screens/SSO";

export const metadata: Metadata = {
  title: "SSO & audit · Saidloop",
};

export default function Page() {
  return <SSO />;
}
