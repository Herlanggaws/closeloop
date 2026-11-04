import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { WidgetLauncher } from "@/design-screens/WidgetLauncher";

export const metadata: Metadata = {
  title: "Widget launcher · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <WidgetLauncher />
    </DesignFrame>
  );
}
