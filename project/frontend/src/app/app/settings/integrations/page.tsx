import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { Integrations } from "@/design-screens/Integrations";

export const metadata: Metadata = {
  title: "Integrations · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <Integrations />
    </DesignFrame>
  );
}
