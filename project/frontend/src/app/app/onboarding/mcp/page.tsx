import type { Metadata } from "next";
import { ConnectMCP } from "@/design-screens/ConnectMCP";

export const metadata: Metadata = {
  title: "Connect MCP · Saidloop",
};

export default function Page() {
  return <ConnectMCP />;
}
