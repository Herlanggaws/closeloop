import type { Metadata } from "next";
import { Billing } from "@/design-screens/Billing";

export const metadata: Metadata = {
  title: "Billing · Saidloop",
};

export default function Page() {
  return <Billing />;
}
