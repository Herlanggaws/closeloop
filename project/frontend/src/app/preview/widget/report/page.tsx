import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { ReportForm } from "@/design-screens/ReportForm";

export const metadata: Metadata = {
  title: "Report form · Saidloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <ReportForm />
    </DesignFrame>
  );
}
