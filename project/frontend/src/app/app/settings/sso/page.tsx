import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { SSO } from "@/design-screens/SSO";

export const metadata: Metadata = {
  title: "SSO & audit · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <SSO />
    </DesignFrame>
  );
}
