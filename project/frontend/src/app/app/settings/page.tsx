import type { Metadata } from "next";
import { ProjectSettings } from "@/design-screens/ProjectSettings";

export const metadata: Metadata = {
  title: "Project settings · Saidloop",
};

export default function Page() {
  return <ProjectSettings />;
}
