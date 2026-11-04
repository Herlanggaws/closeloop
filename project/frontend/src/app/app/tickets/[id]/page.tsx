import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { ReportDetail } from "@/design-screens/ReportDetail";

export const metadata: Metadata = {
  title: "Report detail · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <ReportDetail />
    </DesignFrame>
  );
}
