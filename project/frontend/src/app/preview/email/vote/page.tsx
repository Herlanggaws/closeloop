import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { EmailVote } from "@/design-screens/EmailVote";

export const metadata: Metadata = {
  title: "Email · Vote · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <EmailVote />
    </DesignFrame>
  );
}
