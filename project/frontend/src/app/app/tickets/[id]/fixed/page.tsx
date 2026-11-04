import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { MarkFixed } from "@/design-screens/MarkFixed";

export const metadata: Metadata = {
  title: "Mark fixed · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <MarkFixed />
    </DesignFrame>
  );
}
