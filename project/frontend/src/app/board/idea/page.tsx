import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { BoardDetail } from "@/design-screens/BoardDetail";

export const metadata: Metadata = {
  title: "Idea detail · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <BoardDetail />
    </DesignFrame>
  );
}
