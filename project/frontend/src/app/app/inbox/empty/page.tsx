import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { InboxEmpty } from "@/design-screens/InboxEmpty";

export const metadata: Metadata = {
  title: "Inbox · Empty · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <InboxEmpty />
    </DesignFrame>
  );
}
