import type { Metadata } from "next";
import { SSOAudit } from "@/design-screens/SSOAudit";

export const metadata: Metadata = {
  title: "SSO & audit · Saidloop",
};

export default function Page() {
  return <SSOAudit />;
}
