import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { WidgetLauncher } from "@/design-screens/WidgetLauncher";

export const metadata: Metadata = {
  title: "Widget launcher · Saidloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <WidgetLauncher />
    </DesignFrame>
  );
}
