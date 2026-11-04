import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { CreateProject } from "@/design-screens/CreateProject";

export const metadata: Metadata = {
  title: "Create project · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <CreateProject />
    </DesignFrame>
  );
}
