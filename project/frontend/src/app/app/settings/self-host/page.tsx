import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { SelfHost } from "@/design-screens/SelfHost";

export const metadata: Metadata = {
  title: "Self-host · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <SelfHost />
    </DesignFrame>
  );
}
