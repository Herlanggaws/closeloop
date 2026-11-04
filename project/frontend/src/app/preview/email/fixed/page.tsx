import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { EmailFixed } from "@/design-screens/EmailFixed";

export const metadata: Metadata = {
  title: "Email · Fixed · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <EmailFixed />
    </DesignFrame>
  );
}
