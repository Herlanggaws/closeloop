import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { ConnectMCP } from "@/design-screens/ConnectMCP";

export const metadata: Metadata = {
  title: "Connect MCP · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame>
      <ConnectMCP />
    </DesignFrame>
  );
}
