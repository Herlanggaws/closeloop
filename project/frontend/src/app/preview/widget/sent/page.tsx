import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { ReportSent } from "@/design-screens/ReportSent";

export const metadata: Metadata = {
  title: "Report sent · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <ReportSent />
    </DesignFrame>
  );
}
