import type { Metadata } from "next";
import { Team } from "@/design-screens/Team";

export const metadata: Metadata = {
  title: "Team · Saidloop",
};

export default function Page() {
  return <Team />;
}
