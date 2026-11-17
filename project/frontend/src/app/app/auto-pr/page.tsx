import type { Metadata } from "next";
import { AutoPR } from "@/design-screens/AutoPR";

export const metadata: Metadata = {
  title: "Auto PR runs · Saidloop",
};

export default function Page() {
  return <AutoPR />;
}
