import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { MergeDuplicates } from "@/design-screens/MergeDuplicates";

export const metadata: Metadata = {
  title: "Merge duplicates · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <MergeDuplicates />
    </DesignFrame>
  );
}
