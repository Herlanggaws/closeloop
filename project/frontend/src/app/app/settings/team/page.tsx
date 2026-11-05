import type { Metadata } from "next";
import { Team } from "@/design-screens/Team";

export const metadata: Metadata = {
  title: "Team · Closeloop",
};

export default function Page() {
  return <Team />;
}
