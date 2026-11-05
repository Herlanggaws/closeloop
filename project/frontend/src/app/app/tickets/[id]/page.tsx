import type { Metadata } from "next";
import { ReportDetail } from "@/design-screens/ReportDetail";

export const metadata: Metadata = {
  title: "Report detail · Closeloop",
};

export default function Page() {
  return <ReportDetail />;
}
