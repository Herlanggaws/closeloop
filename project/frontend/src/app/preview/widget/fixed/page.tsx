import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { FixedBanner } from "@/design-screens/FixedBanner";

export const metadata: Metadata = {
  title: "Fixed banner · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <FixedBanner />
    </DesignFrame>
  );
}
