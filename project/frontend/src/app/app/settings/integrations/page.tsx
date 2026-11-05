import type { Metadata } from "next";
import { Integrations } from "@/design-screens/Integrations";

export const metadata: Metadata = {
  title: "Integrations · Closeloop",
};

export default function Page() {
  return <Integrations />;
}
