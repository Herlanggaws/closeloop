import type { Metadata } from "next";
import { ManagePublicBoard } from "@/design-screens/ManagePublicBoard";

export const metadata: Metadata = {
  title: "Public board · Saidloop",
};

export default function Page() {
  return <ManagePublicBoard />;
}
