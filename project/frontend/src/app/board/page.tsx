import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { BoardIdeas } from "@/design-screens/BoardIdeas";

export const metadata: Metadata = {
  title: "Ideas · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <BoardIdeas />
    </DesignFrame>
  );
}
