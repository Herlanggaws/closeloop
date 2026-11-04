import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { InstallWidget } from "@/design-screens/InstallWidget";

export const metadata: Metadata = {
  title: "Install widget · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <InstallWidget />
    </DesignFrame>
  );
}
