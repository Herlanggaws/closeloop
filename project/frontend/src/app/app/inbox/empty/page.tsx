import type { Metadata } from "next";
import { InboxEmpty } from "@/design-screens/InboxEmpty";

export const metadata: Metadata = {
  title: "Inbox · Empty · Saidloop",
};

export default function Page() {
  return <InboxEmpty />;
}
