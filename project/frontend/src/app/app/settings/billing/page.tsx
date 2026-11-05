import type { Metadata } from "next";
import { Billing } from "@/design-screens/Billing";

export const metadata: Metadata = {
  title: "Billing · Closeloop",
};

export default function Page() {
  return <Billing />;
}
