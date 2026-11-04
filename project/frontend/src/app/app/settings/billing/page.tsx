import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { Billing } from "@/design-screens/Billing";

export const metadata: Metadata = {
  title: "Billing · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <Billing />
    </DesignFrame>
  );
}
