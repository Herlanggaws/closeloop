import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { PublicBoard } from "@/design-screens/PublicBoard";

export const metadata: Metadata = {
  title: "Public board · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <PublicBoard />
    </DesignFrame>
  );
}
