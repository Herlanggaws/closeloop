import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { EmailWaitlist } from "@/design-screens/EmailWaitlist";

export const metadata: Metadata = {
  title: "Email · Waitlist · Saidloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <EmailWaitlist />
    </DesignFrame>
  );
}
