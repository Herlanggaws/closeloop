import type { Metadata } from "next";
import { CreateProject } from "@/design-screens/CreateProject";

export const metadata: Metadata = {
  title: "Create project · Closeloop",
};

export default function Page() {
  return <CreateProject />;
}
