import type { Metadata } from "next";
import { InstallWidget } from "@/design-screens/InstallWidget";

export const metadata: Metadata = {
  title: "Install widget · Saidloop",
};

export default function Page() {
  return <InstallWidget />;
}
