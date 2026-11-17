import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { BoardRoadmap } from "@/design-screens/BoardRoadmap";

export const metadata: Metadata = {
  title: "Roadmap · Saidloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <BoardRoadmap />
    </DesignFrame>
  );
}
