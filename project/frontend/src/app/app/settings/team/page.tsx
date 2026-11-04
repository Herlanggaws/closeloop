import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { Team } from "@/design-screens/Team";

export const metadata: Metadata = {
  title: "Team · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <Team />
    </DesignFrame>
  );
}
