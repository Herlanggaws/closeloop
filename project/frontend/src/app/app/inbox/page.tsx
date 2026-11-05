import type { Metadata } from "next";
import { Inbox } from "@/design-screens/Inbox";

export const metadata: Metadata = {
  title: "Inbox · Closeloop",
};

export default function Page() {
  return <Inbox />;
}
