import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { MobileReport } from "@/design-screens/MobileReport";

export const metadata: Metadata = {
  title: "Mobile report · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <MobileReport />
    </DesignFrame>
  );
}
