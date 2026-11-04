import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { ProjectSettings } from "@/design-screens/ProjectSettings";

export const metadata: Metadata = {
  title: "Project settings · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame height="auto">
      <ProjectSettings />
    </DesignFrame>
  );
}
