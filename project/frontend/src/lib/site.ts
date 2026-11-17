import { PRODUCT_DOMAIN } from "@/lib/marketing-links";

export const SITE_URL = `https://${PRODUCT_DOMAIN}`;

export const SITE_NAME = "Saidloop";

export const SITE_TAGLINE = "Users report it. Your AI fixes it.";

export const SITE_DESCRIPTION =
  "Bug reports and ideas from inside your app, ready for Cursor or Claude Code over MCP. When the fix ships, Saidloop tells them it's done.";

export const MARKETING_PATHS = [
  "/",
  "/about",
  "/contact",
  "/changelog",
  "/docs",
  "/docs/web-widget",
  "/docs/android",
  "/docs/ios",
  "/docs/mobile",
  "/privacy",
  "/terms",
  "/dpa",
] as const;
