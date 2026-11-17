import type { Metadata } from "next";
import { InstallStatus } from "@/design-screens/InstallStatus";

export const metadata: Metadata = {
  title: "Install widget · Saidloop",
};

export default function Page() {
  return <InstallStatus />;
}
