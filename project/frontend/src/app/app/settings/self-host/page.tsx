import type { Metadata } from "next";
import { SelfHost } from "@/design-screens/SelfHost";

export const metadata: Metadata = {
  title: "Self-host · Saidloop",
};

export default function Page() {
  return <SelfHost />;
}
