import type { Metadata } from "next";
import { DocsPlatformPage } from "@/components/DocsPlatformPage";

export const metadata: Metadata = {
  title: "iOS SDK · Saidloop",
  description: "Install the Saidloop iOS SDK via Swift Package Manager.",
};

export default function IosDocsPage() {
  return (
    <DocsPlatformPage
      platform="ios"
      title="iOS SDK"
      description="Add the Swift Package, start with your public key, then shake or call show()."
    />
  );
}
