import type { Metadata } from "next";
import { SSO } from "@/design-screens/SSO";

export const metadata: Metadata = {
  title: "SSO & audit · Closeloop",
};

export default function Page() {
  return <SSO />;
}
