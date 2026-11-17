import type { Metadata } from "next";
import { DocsPlatformPage } from "@/components/DocsPlatformPage";

export const metadata: Metadata = {
  title: "Web widget",
  description: "Install the Saidloop web widget with a single script tag.",
};

export default function WebWidgetDocsPage() {
  return (
    <DocsPlatformPage
      platform="web"
      title="Web widget"
      description="Drop one script on your site. Reports land in your inbox with screenshot and context."
    />
  );
}
