import type { Metadata } from "next";
import { DocsPlatformPage } from "@/components/DocsPlatformPage";

export const metadata: Metadata = {
  title: "Android SDK · Saidloop",
  description: "Install the Saidloop Android SDK and start collecting in-app reports.",
};

export default function AndroidDocsPage() {
  return (
    <DocsPlatformPage
      platform="android"
      title="Android SDK"
      description="Add the Kotlin SDK, init with your public key, then shake or call show()."
    />
  );
}
