import type { Metadata } from "next";
import { InstallWidget } from "@/design-screens/InstallWidget";

export const metadata: Metadata = {
  title: "Install widget · Closeloop",
};

export default function Page() {
  return <InstallWidget />;
}
