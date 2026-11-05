import type { Metadata } from "next";
import { McpServer } from "@/design-screens/McpServer";

export const metadata: Metadata = {
  title: "MCP server · Closeloop",
};

export default function Page() {
  return <McpServer />;
}
