import type { Metadata } from "next";
import { MergeDuplicates } from "@/design-screens/MergeDuplicates";

export const metadata: Metadata = {
  title: "Merge duplicates · Closeloop",
};

export default function Page() {
  return <MergeDuplicates />;
}
